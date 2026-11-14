"""
apps/guios/test/test_openalex_pipeline.py
───────────────────────────────────────────────────────────────────────────────
Pruebas de integración del pipeline OpenAlex -> Inferencia -> Persistencia en GUIOS.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import TestCase

from apps.guios.models import Dimension, Evaluation, EvaluationFactor, Factor, Subfactor
from apps.guios.services.ai.literature_evidence import (
    build_literature_prompts,
    map_literature_response,
)
from apps.guios.services.ai.manager import AIService
from apps.guios.services.literature.openalex import AcademicWork
from apps.guios.tasks import execute_evaluation_literature_ai_task


class OpenAlexPipelineTestCase(TestCase):
    def setUp(self):
        self.dimension = Dimension.objects.create(name="Tecnológica", order=1)
        self.factor = Factor.objects.create(
            dimension=self.dimension,
            name="Compatibilidad",
            systemic_importance=3,
            expert_importance=3,
            literature_importance_base=3,
            scope=Factor.SCOPE_EXTERNAL,
            order=1,
        )
        self.subfactor1 = Subfactor.objects.create(
            factor=self.factor,
            description="El software interactúa con protocolos estándar OIDC y SAML.",
            base_citations_count=2,
            keywords_ia="oidc, saml, estándares",
            order=1,
        )
        self.subfactor2 = Subfactor.objects.create(
            factor=self.factor,
            description="El software soporta exportación e interoperabilidad.",
            base_citations_count=3,
            keywords_ia="export, interoperabilidad",
            order=2,
        )
        self.evaluation = Evaluation.objects.create(
            software_name="Keycloak",
            software_category="Seguridad",
            org_name="Universidad Nacional",
            org_sector="Educación Superior",
            ai_enabled=True,
        )

        self.mock_academic_works = [
            AcademicWork(
                openalex_id="https://openalex.org/W100",
                doi="10.4018/ijsppc.2020070104",
                doi_url="https://doi.org/10.4018/ijsppc.2020070104",
                title="A Review on Identity and Access Management Server (KeyCloak)",
                publication_year=2020,
                venue_name="International Journal of Space-Based Computing",
                cited_by_count=15,
                abstract="KeyCloak is an open source IAM server supporting standard protocols like OIDC and SAML.",
            )
        ]

    def test_build_literature_prompts_with_academic_works(self):
        subfactors_data = [
            {
                "id": self.subfactor1.id,
                "factor_id": self.factor.id,
                "factor_name": self.factor.name,
                "description": self.subfactor1.description,
                "keywords_ia": self.subfactor1.keywords_ia,
            }
        ]
        system_prompt, user_prompt = build_literature_prompts(
            software_name="Keycloak",
            software_category="Seguridad",
            software_repo_url=None,
            software_description="IAM Solution",
            org_sector="Educación",
            org_description="SSO",
            subfactors_data=subfactors_data,
            academic_works=[w.to_dict() for w in self.mock_academic_works],
        )
        self.assertIn("ARTÍCULOS CIENTÍFICOS DISPONIBLES", user_prompt)
        self.assertIn("10.4018/ijsppc.2020070104", user_prompt)
        self.assertIn("A Review on Identity and Access Management Server (KeyCloak)", user_prompt)

    def test_map_literature_response_verifies_openalex_dois(self):
        subfactors_data = [
            {
                "id": self.subfactor1.id,
                "factor_id": self.factor.id,
                "factor_name": self.factor.name,
            }
        ]
        # Respuesta del LLM mapeando el artículo real y uno inventado
        model_output = {
            "sources": [
                {
                    "subfactor_id": self.subfactor1.id,
                    "factor_id": self.factor.id,
                    "doi": "10.4018/ijsppc.2020070104",
                    "title": "A Review on Identity and Access Management Server (KeyCloak)",
                    "url": "https://doi.org/10.4018/ijsppc.2020070104",
                    "snippet": "El artículo analiza la integración de Keycloak con protocolos estándar.",
                },
                {
                    "subfactor_id": self.subfactor1.id,
                    "factor_id": self.factor.id,
                    "doi": "10.9999/inventado.999",  # DOI inventado que NO está en OpenAlex
                    "title": "Fake Paper",
                    "url": "https://doi.org/10.9999/inventado.999",
                    "snippet": "Fake snippet.",
                },
            ],
            "ratings": [
                {
                    "subfactor_id": self.subfactor1.id,
                    "rating": 4,
                    "justification": "Cumple holgadamente.",
                }
            ],
            "importances": [
                {
                    "factor_id": self.factor.id,
                    "suggested_id": 4,
                    "justification": "Crucial para la universidad.",
                }
            ],
        }

        mapped = map_literature_response(
            data=model_output,
            subfactors_data=subfactors_data,
            academic_works=[w.to_dict() for w in self.mock_academic_works],
        )

        self.assertEqual(mapped["evidence_origin"], "openalex")
        # Solo debe haber aceptado 1 cita (la verificada con OpenAlex) y descartado la inventada
        self.assertEqual(mapped["citations_by_subfactor"][self.subfactor1.id], 1)
        sources = mapped["sources_by_factor"][self.factor.id]
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["doi"], "10.4018/ijsppc.2020070104")

    def test_sources_carry_subfactor_description_and_origin(self):
        subfactors_data = [{
            "id": self.subfactor1.id,
            "factor_id": self.factor.id,
            "factor_name": self.factor.name,
            "description": self.subfactor1.description,
            "keywords_ia": "",
        }]
        model_output = {"sources": [{
            "subfactor_id": self.subfactor1.id,
            "doi": "10.4018/ijsppc.2020070104",
            "title": "x",
            "snippet": "Soporta OIDC y SAML.",
        }]}
        mapped = map_literature_response(
            model_output, subfactors_data, [w.to_dict() for w in self.mock_academic_works]
        )
        source = mapped["sources_by_factor"][self.factor.id][0]
        self.assertEqual(source["subfactor_description"], self.subfactor1.description)
        self.assertEqual(source["match_origin"], "model")

    def test_backfill_needs_more_than_one_loose_keyword(self):
        weak_work = AcademicWork(
            openalex_id="https://openalex.org/W200",
            doi="10.1000/weak",
            doi_url="https://doi.org/10.1000/weak",
            title="Keycloak deployment notes",
            publication_year=2021,
            venue_name="Journal",
            cited_by_count=1,
            abstract="Keycloak was installed and export was mentioned once.",
        )
        subfactors_data = [{
            "id": self.subfactor2.id,
            "factor_id": self.factor.id,
            "factor_name": self.factor.name,
            "description": self.subfactor2.description,
            "keywords_ia": self.subfactor2.keywords_ia,
        }]
        mapped = map_literature_response({"sources": []}, subfactors_data, [weak_work.to_dict()])
        # Solo coincide "export": una palabra suelta no atribuye el artículo.
        self.assertEqual(mapped["citations_by_subfactor"][self.subfactor2.id], 0)

        strong_work = AcademicWork(
            openalex_id="https://openalex.org/W201",
            doi="10.1000/strong",
            doi_url="https://doi.org/10.1000/strong",
            title="Keycloak export and interoperabilidad",
            publication_year=2022,
            venue_name="Journal",
            cited_by_count=1,
            abstract="Keycloak export interoperabilidad con otros sistemas.",
        )
        mapped = map_literature_response({"sources": []}, subfactors_data, [strong_work.to_dict()])
        self.assertEqual(mapped["citations_by_subfactor"][self.subfactor2.id], 1)
        source = mapped["sources_by_factor"][self.factor.id][0]
        self.assertEqual(source["match_origin"], "keyword_backfill")
        self.assertIn("No fue validada por el modelo", source["snippet"])

    @patch("apps.guios.services.ai.manager.OpenAlexClient.search_works")
    def test_celery_task_executes_pipeline_with_real_dois(self, mock_search_works):
        mock_search_works.return_value = self.mock_academic_works

        # Mock del proveedor primario para devolver mapeo consistente
        mock_provider = MagicMock()
        mock_provider.search_literature_and_citations.return_value = {
            "citations_by_subfactor": {self.subfactor1.id: 1, self.subfactor2.id: 0},
            "sources_by_factor": {
                self.factor.id: [
                    {
                        "subfactor_id": self.subfactor1.id,
                        "doi": "10.4018/ijsppc.2020070104",
                        "title": "A Review on Identity and Access Management Server (KeyCloak)",
                        "url": "https://doi.org/10.4018/ijsppc.2020070104",
                        "snippet": "Soporta OIDC y SAML en entornos universitarios.",
                    }
                ]
            },
            "ratings_by_subfactor": {
                self.subfactor1.id: {"rating": 4, "justification": "Soporte completo OIDC."},
                self.subfactor2.id: {"rating": 3, "justification": "Interoperabilidad básica."},
            },
            "importance_by_factor": {
                self.factor.id: {"suggested_id": 4, "justification": "Fundamental para SSO."}
            },
            "provider_info": "Azure OpenAI (gpt-5-mini)",
            "evidence_origin": "openalex",
        }

        with patch("apps.guios.tasks.ai_service.primary_provider", mock_provider):
            result = execute_evaluation_literature_ai_task(self.evaluation.id)

        self.assertTrue(result["success"])
        self.assertEqual(result["ai_status"], Evaluation.AI_STATUS_COMPLETED)

        # Verificar persistencia en base de datos
        self.evaluation.refresh_from_db()
        self.assertEqual(self.evaluation.ai_status, Evaluation.AI_STATUS_COMPLETED)

        eval_factor = EvaluationFactor.objects.get(evaluation=self.evaluation, factor=self.factor)
        self.assertEqual(eval_factor.citations_count, 1)
        self.assertTrue(len(eval_factor.ai_literature_sources) > 0)
        self.assertEqual(eval_factor.ai_literature_sources[0]["doi"], "10.4018/ijsppc.2020070104")

    def test_reports_include_openalex_sources(self):
        from apps.guios.services.reports import EvaluationPDFReport, EvaluationExcelReport

        EvaluationFactor.objects.create(
            evaluation=self.evaluation,
            factor=self.factor,
            systemic_importance_snapshot=3,
            subfactors_count_snapshot=2,
            citations_count=1,
            citation_ratio=Decimal("0.50"),
            literature_importance_calculated=2,
            expert_importance_snapshot=3,
            decisor_importance=3,
            relative_importance=3,
            is_relevant=True,
            scope_used=Factor.SCOPE_EXTERNAL,
            ai_literature_sources=[
                {
                    "subfactor_id": self.subfactor1.id,
                    "doi": "10.4018/ijsppc.2020070104",
                    "title": "A Review on Identity and Access Management Server (KeyCloak)",
                    "url": "https://doi.org/10.4018/ijsppc.2020070104",
                    "snippet": "Soporta OIDC y SAML en entornos universitarios.",
                }
            ],
        )

        # Generar PDF
        pdf_buffer = EvaluationPDFReport.generate(self.evaluation)
        self.assertGreater(pdf_buffer.getbuffer().nbytes, 1000)

        # Generar Excel
        excel_buffer = EvaluationExcelReport.generate(self.evaluation)
        self.assertGreater(excel_buffer.getbuffer().nbytes, 1000)

    def test_build_literature_prompts_ignores_organization_context_for_consistency(self):
        subfactors_data = [
            {
                "id": self.subfactor1.id,
                "factor_id": self.factor.id,
                "factor_name": self.factor.name,
                "description": self.subfactor1.description,
                "keywords_ia": self.subfactor1.keywords_ia,
            }
        ]
        sys_a, usr_a = build_literature_prompts(
            software_name="Keycloak",
            software_category="Seguridad",
            software_repo_url=None,
            software_description="Gestión de identidad y acceso.",
            org_sector="Banca",
            org_description="Transferencias financieras críticas",
            subfactors_data=subfactors_data,
            academic_works=[],
        )
        sys_b, usr_b = build_literature_prompts(
            software_name="Keycloak",
            software_category="Seguridad",
            software_repo_url=None,
            software_description="Gestión de identidad y acceso.",
            org_sector="Salud",
            org_description="Historias clínicas hospitalarias",
            subfactors_data=subfactors_data,
            academic_works=[],
        )
        self.assertEqual(sys_a, sys_b)
        self.assertEqual(usr_a, usr_b)
        self.assertNotIn("Transferencias financieras", usr_a)
        self.assertNotIn("Historias clínicas", usr_a)

    def test_consistent_openalex_snapshot_reused_across_different_organizations(self):
        from apps.guios.models import AIAssistanceLog
        from apps.guios.services.ai.azure_provider import AzureAIProvider
        from apps.guios.services.evaluation import calculate_evaluation_literature

        azure_primary = AzureAIProvider(
            api_key="test-key",
            endpoint="https://lab.services.ai.azure.com/models",
            model_name="gpt-5-mini",
        )
        fake_openalex = MagicMock()
        fake_openalex.year_from = 2020
        fake_openalex.year_to = 2025
        fake_openalex.search_works.return_value = self.mock_academic_works

        expected_lit = {
            "citations_by_subfactor": {self.subfactor1.id: 1, self.subfactor2.id: 0},
            "sources_by_factor": {
                self.factor.id: [
                    {
                        "subfactor_id": self.subfactor1.id,
                        "doi": "10.4018/ijsppc.2020070104",
                        "title": "A Review on Identity and Access Management Server (KeyCloak)",
                        "url": "https://doi.org/10.4018/ijsppc.2020070104",
                        "snippet": "Respalda OIDC y SAML en Keycloak.",
                        "publication_year": 2022,
                    }
                ]
            },
            "ratings_by_subfactor": {},
            "importance_by_factor": {},
            "provider_info": "Azure OpenAI (gpt-5-mini)",
            "evidence_origin": "openalex",
        }

        service = AIService(primary_provider=azure_primary, openalex_client=fake_openalex)

        with patch.object(
            azure_primary,
            "search_literature_and_citations",
            return_value=expected_lit,
        ) as mock_llm:
            first_result = service.search_literature_and_citations(self.evaluation)
            calculate_evaluation_literature(
                evaluation_id=self.evaluation.id,
                ai_citations_by_subfactor=first_result["citations_by_subfactor"],
                ai_sources_by_factor=first_result["sources_by_factor"],
            )

            eval_other_org = Evaluation.objects.create(
                software_name="Keycloak CE",
                software_category="Seguridad",
                org_name="Banco Central",
                org_sector="Banca",
                org_description="Banca digital institucional",
                ai_enabled=True,
            )
            # Reutilización vía caché en memoria de AIService
            second_result = service.search_literature_and_citations(eval_other_org)
            self.assertEqual(second_result["citations_by_subfactor"], first_result["citations_by_subfactor"])
            self.assertEqual(second_result["sources_by_factor"], first_result["sources_by_factor"])
            self.assertEqual(second_result["evidence_origin"], "openalex_consistent_snapshot")
            self.assertTrue(second_result["snapshot_reused"])

            # Reutilización vía snapshot persistido en base de datos (nueva instancia AIService)
            fresh_service = AIService(primary_provider=azure_primary, openalex_client=fake_openalex)
            eval_third_org = Evaluation.objects.create(
                software_name="Keycloak Enterprise",
                software_category="Seguridad",
                org_name="Ministerio TIC",
                org_sector="Gobierno",
                ai_enabled=True,
            )
            third_result = fresh_service.search_literature_and_citations(eval_third_org)
            self.assertEqual(third_result["citations_by_subfactor"], first_result["citations_by_subfactor"])
            self.assertEqual(third_result["sources_by_factor"], first_result["sources_by_factor"])
            self.assertTrue(third_result["snapshot_reused"])

            # Ni OpenAlex ni el LLM deben invocarse en la 2da y 3ra evaluación
            self.assertEqual(fake_openalex.search_works.call_count, 1)
            self.assertEqual(mock_llm.call_count, 1)
            self.assertTrue(
                AIAssistanceLog.objects.filter(
                    evaluation=eval_third_org,
                    request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                    status=AIAssistanceLog.STATUS_SUCCESS,
                ).exists()
            )

