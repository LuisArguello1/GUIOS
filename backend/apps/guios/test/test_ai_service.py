"""
apps/guios/test/test_ai_service.py
───────────────────────────────────────────────────────────────────────────────
Pruebas unitarias y de integración para la arquitectura de Inteligencia Artificial (GUIOS):
- Proveedor Heurístico de Contingencia (Fallback).
- Fallback automático del AIService ante fallas del motor primario.
- Trazabilidad y registro inmutable en AIAssistanceLog.
- Tarea Celery execute_evaluation_literature_ai_task.
- Endpoints REST de asistencia IA y consulta de logs de auditoría.
"""
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.guios.models import (
    Dimension,
    Factor,
    Subfactor,
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    AIAssistanceLog,
)
from apps.guios.services.ai import (
    HeuristicAIProvider,
    AIService,
)
from apps.guios.services.ai.azure_provider import (
    AZURE_LITERATURE_MAX_COMPLETION_TOKENS,
    AZURE_SHORT_MAX_COMPLETION_TOKENS,
    AZURE_VERDICT_MAX_COMPLETION_TOKENS,
    AzureAIProvider,
)
from apps.guios.services.ai.base import BaseAIProvider
from apps.guios.services.ai.cohere_provider import CohereAIProvider
from apps.guios.services.ai.json_payload import require_json_object
from apps.guios.services.ai.literature_evidence import (
    build_literature_prompts,
    map_literature_response,
)
from apps.guios.services.ai.verdict_narrative import (
    build_predetermined_narrative,
    build_verdict_prompts,
    parse_verdict_narrative,
)
from apps.guios.services.evaluation import calculate_evaluation_literature
from apps.guios.tasks import execute_evaluation_literature_ai_task

User = get_user_model()


class FailingAIProvider(BaseAIProvider):
    """Proveedor mock que siempre lanza error para comprobar la contingencia."""
    def search_literature_and_citations(self, *args, **kwargs):
        raise RuntimeError("Quota exceeded (429) simulated in primary provider")

    def suggest_factor_importance(self, *args, **kwargs):
        raise TimeoutError("Gemini API Timeout simulated")

    def suggest_subfactor_rating(self, *args, **kwargs):
        raise ConnectionError("Network unreachable")

    def suggest_factor_ratings(self, *args, **kwargs):
        raise ConnectionError("Network unreachable")

    def generate_executive_summary_and_verdict(self, *args, **kwargs):
        raise RuntimeError("Model unavailable")


class LiteratureEvidenceTests(TestCase):
    """El conteo de citas sale de fuentes reales mapeadas, no de un número estimado."""

    def setUp(self):
        self.subfactors = [
            {
                "id": 10,
                "factor_id": 2,
                "factor_name": "Compatibilidad",
                "description": "El software lee formatos existentes.",
                "keywords_ia": "odf docx",
            }
        ]

    def test_prompt_forbids_invented_counts(self):
        system_prompt, user_prompt = build_literature_prompts(
            software_name="LibreOffice",
            software_category="Ofimática",
            software_repo_url="https://www.libreoffice.org",
            software_description="Suite ofimática",
            org_sector="Educación",
            org_description="Universidad pública",
            subfactors_data=self.subfactors,
        )
        self.assertIn("No estimas", system_prompt)
        self.assertIn("en español", system_prompt)
        self.assertIn("No uses inglés", user_prompt)
        self.assertIn("subfactor_id", user_prompt)
        self.assertNotIn("base_c_i", user_prompt)
        self.assertNotIn("CALIFICACIÓN DE CUMPLIMIENTO", user_prompt)
        self.assertNotIn("IMPORTANCIA DEL DECISOR", user_prompt)

    def test_counts_only_real_mapped_sources(self):
        mapped = map_literature_response(
            {
                "subfactors": [{"id": 10, "citations_count": 99}],
                "sources": [
                    {
                        "subfactor_id": 10,
                        "factor_id": 2,
                        "title": "Adopción de LibreOffice en universidades",
                        "url": "https://ejemplo.org/articulo",
                        "doi": "10.1016/j.jss.2024.0001",
                        "snippet": "Este texto de ejemplo no debe contar como evidencia.",
                    },
                    {
                        "subfactor_id": 10,
                        "factor_id": 2,
                        "title": "Migración ofimática en la administración pública",
                        "url": "https://revistas.ejemplo-real.edu/libreoffice",
                        "doi": "",
                        "snippet": "El estudio documenta la lectura de archivos ODF y OOXML.",
                    },
                    {
                        "subfactor_id": 10,
                        "factor_id": 999,
                        "title": "Misma evidencia contada una sola vez",
                        "url": "https://revistas.ejemplo-real.edu/libreoffice",
                        "doi": "",
                        "snippet": "El estudio documenta la lectura de archivos ODF y OOXML.",
                    },
                    {
                        "subfactor_id": 10,
                        "factor_id": 2,
                        "title": "Caso de interoperabilidad documental",
                        "url": "",
                        "doi": "10.5555/floss.2021.14",
                        "snippet": "Reporta compatibilidad de formatos en el despliegue de LibreOffice.",
                    },
                ],
            },
            self.subfactors,
        )
        self.assertEqual(mapped["citations_by_subfactor"][10], 2)
        self.assertEqual(len(mapped["sources_by_factor"][2]), 2)

    def test_string_none_doi_is_stored_empty(self):
        mapped = map_literature_response(
            {
                "sources": [
                    {
                        "subfactor_id": 10,
                        "title": "Sitio oficial de LibreOffice",
                        "url": "https://www.libreoffice.org/about-us/",
                        "doi": "None",
                        "snippet": "La suite abre y guarda archivos DOCX, XLSX y PPTX.",
                    }
                ]
            },
            self.subfactors,
        )
        self.assertEqual(mapped["citations_by_subfactor"][10], 1)
        self.assertEqual(mapped["sources_by_factor"][2][0]["doi"], "")

    def test_ratings_are_kept_apart_from_citation_counts(self):
        mapped = map_literature_response(
            {
                "sources": [],
                "ratings": [
                    {
                        "subfactor_id": 10,
                        "rating": 4,
                        "justification": "El software cubre el criterio de compatibilidad de formatos.",
                    },
                    {
                        "subfactor_id": 10,
                        "rating": 9,
                        "justification": "Esta nota está fuera de la escala y no debe guardarse.",
                    },
                    {
                        "subfactor_id": 99,
                        "rating": 3,
                        "justification": "Este subfactor no pertenece al bloque enviado.",
                    },
                ],
            },
            self.subfactors,
        )
        self.assertEqual(mapped["citations_by_subfactor"][10], 0)
        self.assertEqual(mapped["ratings_by_subfactor"][10]["rating"], 4)
        self.assertNotIn(99, mapped["ratings_by_subfactor"])

    def test_factor_importance_is_mapped_in_spanish_payload(self):
        mapped = map_literature_response(
            {
                "sources": [],
                "importances": [
                    {
                        "factor_id": 2,
                        "suggested_id": 4,
                        "justification": "En educación la compatibilidad condiciona la adopción del software.",
                    },
                    {
                        "factor_id": 2,
                        "suggested_id": 8,
                        "justification": "Esta nota está fuera de la escala y no debe guardarse.",
                    },
                ],
            },
            self.subfactors,
        )
        self.assertEqual(mapped["importance_by_factor"][2]["suggested_id"], 4)
        self.assertNotIn(8, mapped["importance_by_factor"])

    def test_openalex_works_omitted_by_the_model_still_count_when_they_match(self):
        mapped = map_literature_response(
            {"sources": []},
            self.subfactors,
            academic_works=[{
                "doi": "10.1145/1111",
                "doi_url": "https://doi.org/10.1145/1111",
                "title": "Adopción de LibreOffice y compatibilidad de formatos",
                "abstract": "El estudio revisa odf y docx en migraciones ofimáticas.",
            }],
        )
        self.assertEqual(mapped["citations_by_subfactor"][10], 1)
        self.assertEqual(mapped["sources_by_factor"][2][0]["doi"], "10.1145/1111")

    def test_unrelated_openalex_work_does_not_count(self):
        mapped = map_literature_response(
            {"sources": []},
            self.subfactors,
            academic_works=[{
                "doi": "10.9999/quimica",
                "title": "Espectroscopia de compuestos orgánicos",
                "abstract": "Laboratorio de química analítica y reactivos.",
            }],
        )
        self.assertEqual(mapped["citations_by_subfactor"][10], 0)


class VerdictNarrativeTests(TestCase):
    def test_prompt_keeps_the_calculated_recommendation(self):
        system_prompt, user_prompt = build_verdict_prompts(
            software_name="LibreOffice",
            software_category="Ofimática",
            software_description="Suite ofimática",
            org_name="UNEMI",
            org_sector="Educación",
            org_description="Universidad pública",
            recommendation="C",
            explanation_text="Se sugiere analizar la adopción y posponerla.",
            factors=[{
                "factor": "Soporte",
                "pm": 2.0,
                "foda": "Debilidad",
                "ir": 4,
                "alcance": "internal",
                "supera_umbral": False,
            }],
        )
        self.assertIn("No la cambies", system_prompt)
        self.assertIn("No uses inglés", system_prompt)
        self.assertIn("Recomendación C", user_prompt)
        self.assertIn("Soporte", user_prompt)
        self.assertIn("Qué sostiene la adopción", user_prompt)
        self.assertIn("280 y 380 palabras", user_prompt)

    def test_empty_model_text_falls_back_to_predetermined_fields(self):
        parsed = parse_verdict_narrative({"executive_summary": "", "mitigation_plan": ""})
        fallback = build_predetermined_narrative(
            software_name="LibreOffice",
            org_name="UNEMI",
            org_sector="Educación",
            recommendation="B",
            explanation_text="Es posible adoptar, con matices.",
            factors=[{"factor": "Formación", "pm": 2.0, "foda": "Debilidad", "ir": 2, "supera_umbral": False}],
        )
        summary = parsed["executive_summary"] or fallback["executive_summary"]
        plan = parsed["mitigation_plan"] or fallback["mitigation_plan"]
        self.assertIn("Es posible adoptar, con matices.", summary)
        self.assertIn("Formación", plan)


class AIServiceTestCase(TestCase):
    """Pruebas del servicio de IA, contingencia y tareas en background."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            email='eval_ai@test.com',
            password='TestPassword123!',
            first_name='Admin',
            last_name='AI',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Crear dimensión, factores y subfactores de prueba
        self.dim = Dimension.objects.create(name="Dimensión Tecnológica", order=1)
        self.factor1 = Factor.objects.create(
            dimension=self.dim,
            name="Fiabilidad y Calidad",
            scope="internal",
            systemic_importance=4,
            order=1,
        )
        self.factor2 = Factor.objects.create(
            dimension=self.dim,
            name="Soporte y Comunidad",
            scope="both",
            systemic_importance=3,
            order=2,
        )

        self.subfactor1 = Subfactor.objects.create(
            factor=self.factor1,
            description="El software cuenta con pruebas automáticas y estabilidad demostrada.",
            base_citations_count=3,
            keywords_ia="fiabilidad estabilidad tests",
        )
        self.subfactor2 = Subfactor.objects.create(
            factor=self.factor2,
            description="Existe documentación oficial y foros de ayuda activos.",
            base_citations_count=2,
            keywords_ia="comunidad soporte documentacion",
        )

        self.evaluation = Evaluation.objects.create(
            software_name="PostgreSQL Test",
            software_category="Base de Datos",
            org_name="Hospital Universitario",
            org_sector="Salud",
            org_description="Gestión de historias clínicas y alta concurrencia",
            created_by=self.user,
        )
        offline = AIService(
            primary_provider=HeuristicAIProvider(),
            safety_provider=HeuristicAIProvider(),
        )
        for target in (
            "apps.guios.tasks.ai_service",
            "apps.guios.api.views.evaluation_views.ai_service",
        ):
            patcher = patch(target, offline)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_heuristic_provider_literature_search(self):
        """Verifica que el proveedor heurístico genere conteo de citas y fuentes."""
        provider = HeuristicAIProvider()
        subfactors_data = [
            {
                "id": self.subfactor1.id,
                "factor_id": self.factor1.id,
                "factor_name": self.factor1.name,
                "description": self.subfactor1.description,
                "keywords_ia": self.subfactor1.keywords_ia,
                "base_citations_count": 3,
            }
        ]
        result = provider.search_literature_and_citations(
            software_name="PostgreSQL",
            software_category="Base de Datos",
            software_repo_url=None,
            software_description="RDBMS open source",
            subfactors_data=subfactors_data,
        )
        self.assertEqual(result["citations_by_subfactor"][self.subfactor1.id], 3)
        self.assertEqual(result["sources_by_factor"], {})
        self.assertEqual(result["evidence_origin"], "catalog_baseline")
        self.assertNotIn("10.1016/j.jss.2020.110592", str(result))
        self.assertIn("sin fuentes inventadas", result["provider_info"])

    def test_ai_service_fallback_on_primary_failure(self):
        """Verifica que si el proveedor primario falla, AIService active el fallback y registre los logs correspondientes."""
        failing_primary = FailingAIProvider()
        heuristic_provider = HeuristicAIProvider()
        service = AIService(primary_provider=failing_primary, secondary_provider=heuristic_provider)

        result = service.search_literature_and_citations(evaluation=self.evaluation)

        # Debe retornar resultado exitoso gracias al fallback
        self.assertIn("citations_by_subfactor", result)

        # Deben haberse creado logs: 1 de error del primario y 1 exitoso del fallback
        logs = AIAssistanceLog.objects.filter(evaluation=self.evaluation)
        self.assertGreaterEqual(logs.count(), 2)
        error_log = logs.filter(status=AIAssistanceLog.STATUS_ERROR).first()
        success_log = logs.filter(status=AIAssistanceLog.STATUS_SUCCESS).first()

        self.assertIsNotNone(error_log)
        self.assertIn("Quota exceeded", error_log.error_message)
        self.assertIsNotNone(success_log)
        self.assertIn("FALLBACK", success_log.error_message)

    def test_ai_service_three_tier_fallback(self):
        """Verifica que si Primario y Secundario fallan, el safety provider (heurístico) responda con éxito."""
        failing_primary = FailingAIProvider()
        failing_secondary = FailingAIProvider()
        safety_provider = HeuristicAIProvider()

        service = AIService(
            primary_provider=failing_primary,
            secondary_provider=failing_secondary,
            safety_provider=safety_provider,
        )

        result = service.search_literature_and_citations(evaluation=self.evaluation)
        self.assertIn("citations_by_subfactor", result)

        logs = AIAssistanceLog.objects.filter(evaluation=self.evaluation)
        self.assertEqual(logs.count(), 3)  # 2 errores + 1 éxito safety
        self.assertEqual(logs.filter(status=AIAssistanceLog.STATUS_ERROR).count(), 2)
        self.assertEqual(logs.filter(status=AIAssistanceLog.STATUS_SUCCESS).count(), 1)


    def test_celery_task_literature_ai(self):
        """Verifica la ejecución de la tarea Celery (ejecución sincrónica en test)."""
        res = execute_evaluation_literature_ai_task(self.evaluation.id)
        self.assertTrue(res["success"])

        self.evaluation.refresh_from_db()
        self.assertEqual(self.evaluation.ai_status, Evaluation.AI_STATUS_COMPLETED)
        self.assertIsNotNone(self.evaluation.q1_threshold)
        self.assertIsNotNone(self.evaluation.q4_threshold)

    def test_api_calculate_literature_with_use_ai(self):
        """Verifica el endpoint calculate-literature con use_ai=True."""
        url = f"/api/v1/guios/evaluations/{self.evaluation.id}/calculate-literature/"
        response = self.client.post(url, {"use_ai": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("q1_threshold", response.data)
        self.assertIn("factors", response.data)

    def test_api_ai_suggest_importance(self):
        """Verifica la acción ai-suggest-importance para un factor."""
        # Inicializar literatura primero
        execute_evaluation_literature_ai_task(self.evaluation.id)

        url = f"/api/v1/guios/evaluations/{self.evaluation.id}/ai-suggest-importance/"
        response = self.client.post(url, {"factor_id": self.factor1.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("suggested_id", response.data)
        self.assertIn("justification", response.data)
        self.assertIn(response.data["suggested_id"], [1, 2, 3, 4])

        # Verificar persistencia en EvaluationFactor
        eval_factor = EvaluationFactor.objects.get(evaluation=self.evaluation, factor=self.factor1)
        self.assertEqual(eval_factor.ai_suggested_id, response.data["suggested_id"])

    def test_api_ai_suggest_rating(self):
        """Verifica la acción ai-suggest-rating para un subfactor."""
        execute_evaluation_literature_ai_task(self.evaluation.id)

        url = f"/api/v1/guios/evaluations/{self.evaluation.id}/ai-suggest-rating/"
        response = self.client.post(url, {"subfactor_id": self.subfactor1.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("suggested_rating", response.data)
        self.assertIn(response.data["suggested_rating"], [1, 2, 3, 4])

        eval_subfactor = EvaluationSubfactor.objects.get(evaluation=self.evaluation, subfactor=self.subfactor1)
        self.assertEqual(eval_subfactor.ai_suggested_rating, response.data["suggested_rating"])

    def test_api_ai_suggest_factor_ratings_only_covers_that_factor(self):
        """La sugerencia manual califica los subfactores del factor pedido y no cierra la nota."""
        execute_evaluation_literature_ai_task(self.evaluation.id)

        url = f"/api/v1/guios/evaluations/{self.evaluation.id}/ai-suggest-factor-ratings/"
        response = self.client.post(url, {"factor_id": self.factor1.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["subfactor_id"] for item in response.data["ratings"]}
        self.assertEqual(returned_ids, {self.subfactor1.id})

        touched = EvaluationSubfactor.objects.get(evaluation=self.evaluation, subfactor=self.subfactor1)
        self.assertEqual(touched.ai_suggested_rating, 3)
        self.assertIsNone(touched.rating)
        untouched = EvaluationSubfactor.objects.get(evaluation=self.evaluation, subfactor=self.subfactor2)
        self.assertIsNone(untouched.ai_suggested_rating)

    def test_detail_restores_suggestions_from_ai_logs(self):
        """El detalle recupera el texto de la sugerencia desde el log si las columnas quedaron vacías."""
        execute_evaluation_literature_ai_task(self.evaluation.id)

        importance = self.client.post(
            f"/api/v1/guios/evaluations/{self.evaluation.id}/ai-suggest-importance/",
            {"factor_id": self.factor1.id},
            format="json",
        )
        ratings = self.client.post(
            f"/api/v1/guios/evaluations/{self.evaluation.id}/ai-suggest-factor-ratings/",
            {"factor_id": self.factor1.id},
            format="json",
        )
        self.assertEqual(importance.status_code, status.HTTP_200_OK)
        self.assertEqual(ratings.status_code, status.HTTP_200_OK)

        EvaluationFactor.objects.filter(evaluation=self.evaluation, factor=self.factor1).update(
            ai_suggested_id=None,
            ai_id_justification="",
        )
        EvaluationSubfactor.objects.filter(evaluation=self.evaluation, subfactor=self.subfactor1).update(
            ai_suggested_rating=None,
            ai_rating_justification="",
        )

        detail = self.client.get(f"/api/v1/guios/evaluations/{self.evaluation.id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        factor = next(item for item in detail.data["factors"] if item["factor_id"] == self.factor1.id)
        subfactor = next(item for item in detail.data["subfactors"] if item["subfactor_id"] == self.subfactor1.id)
        self.assertEqual(factor["ai_suggested_id"], importance.data["suggested_id"])
        self.assertEqual(factor["ai_id_justification"], importance.data["justification"])
        stored = ratings.data["ratings"][0]
        self.assertEqual(subfactor["ai_suggested_rating"], stored["suggested_rating"])
        self.assertEqual(subfactor["ai_rating_justification"], stored["justification"])

    def test_api_ai_logs(self):
        """Verifica la acción ai-logs que lista la auditoría inmutable."""
        # Generar una interacción de IA
        execute_evaluation_literature_ai_task(self.evaluation.id)

        url = f"/api/v1/guios/evaluations/{self.evaluation.id}/ai-logs/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertIn("request_type", response.data[0])
        self.assertIn("status", response.data[0])

    def test_ai_log_viewset_list_and_detail(self):
        """Verifica el ViewSet global /api/v1/guios/ai-logs/ con listado y detalle."""
        execute_evaluation_literature_ai_task(self.evaluation.id)
        log = AIAssistanceLog.objects.filter(evaluation=self.evaluation).first()
        self.assertIsNotNone(log)

        # 1. List
        list_url = "/api/v1/guios/ai-logs/"
        res_list = self.client.get(list_url)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        # Paginado
        results = res_list.data.get("results", res_list.data)
        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0]["software_name"], "PostgreSQL Test")

        # 2. Filter por evaluation_id
        res_filtered = self.client.get(f"{list_url}?evaluation_id={self.evaluation.id}")
        self.assertEqual(res_filtered.status_code, status.HTTP_200_OK)

        # 3. Detail
        detail_url = f"/api/v1/guios/ai-logs/{log.id}/"
        res_detail = self.client.get(detail_url)
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertIn("request_payload", res_detail.data)
        self.assertIn("response_payload", res_detail.data)
        self.assertEqual(res_detail.data["id"], log.id)

        # 4. Detail 404
        res_404 = self.client.get("/api/v1/guios/ai-logs/999999/")
        self.assertEqual(res_404.status_code, status.HTTP_404_NOT_FOUND)


class ScriptedAIProvider(BaseAIProvider):
    """Doble de prueba: o falla con un mensaje, o devuelve el payload indicado."""

    def __init__(
        self,
        *,
        fail_message: str | None = None,
        literature: dict | None = None,
        importance: dict | None = None,
        rating: dict | None = None,
        verdict: dict | None = None,
    ):
        self.fail_message = fail_message
        self.literature = literature or {
            "citations_by_subfactor": {},
            "sources_by_factor": {},
            "provider_info": "scripted",
        }
        self.importance = importance or {"suggested_id": 4, "justification": "Desde el nivel de respaldo."}
        self.rating = rating or {"suggested_rating": 3, "justification": "Desde el nivel de respaldo."}
        self.verdict = verdict or {
            "executive_summary": "Resumen del nivel de respaldo.",
            "mitigation_plan": "Plan del nivel de respaldo.",
        }
        self.calls: list[str] = []
        self.literature_sizes: list[int] = []

    def _reply(self, kind: str, payload: dict) -> dict:
        self.calls.append(kind)
        if self.fail_message:
            raise RuntimeError(self.fail_message)
        return payload

    def search_literature_and_citations(self, *args, **kwargs):
        self.literature_sizes.append(len(kwargs.get("subfactors_data") or []))
        return self._reply("literature", self.literature)

    def suggest_factor_importance(self, *args, **kwargs):
        return self._reply("importance", self.importance)

    def suggest_subfactor_rating(self, *args, **kwargs):
        return self._reply("rating", self.rating)

    def suggest_factor_ratings(self, *args, **kwargs):
        subfactors = kwargs.get("subfactors") or []
        ratings = {
            int(item["id"]): {
                "rating": 3,
                "justification": "Desde el nivel de respaldo para este factor.",
            }
            for item in subfactors
        }
        return self._reply("factor_ratings", {"ratings": ratings, "evidence_origin": "scripted"})

    def generate_executive_summary_and_verdict(self, *args, **kwargs):
        return self._reply("verdict", self.verdict)


def _completion(content: str, finish_reason: str, captured: dict):
    class Completions:
        def create(self, **kwargs):
            captured.update(kwargs)
            message = SimpleNamespace(content=content)
            return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason=finish_reason)])

    return SimpleNamespace(chat=SimpleNamespace(completions=Completions()))


class CascadeResilienceTests(AIServiceTestCase):
    """La cascada registra cada nivel y no se salta anillos por un JSON inválido."""

    def test_four_levels_are_logged_when_every_api_fails(self):
        service = AIService(
            primary_provider=ScriptedAIProvider(fail_message="azure down"),
            secondary_provider=ScriptedAIProvider(fail_message="groq down"),
            tertiary_provider=ScriptedAIProvider(fail_message="cohere down"),
            safety_provider=HeuristicAIProvider(),
        )

        result = service.search_literature_and_citations(self.evaluation)

        self.assertEqual(result["evidence_origin"], "catalog_baseline")
        self.assertEqual(result["citations_by_subfactor"][self.subfactor1.id], 3)
        self.assertEqual(result["sources_by_factor"], {})
        logs = AIAssistanceLog.objects.filter(evaluation=self.evaluation)
        self.assertEqual(logs.count(), 4)
        self.assertEqual(logs.filter(status=AIAssistanceLog.STATUS_ERROR).count(), 3)
        success = logs.get(status=AIAssistanceLog.STATUS_SUCCESS)
        self.assertIn("FALLBACK", success.error_message)
        self.assertEqual(success.response_payload["provider"], "HeuristicAIProvider")
        self.assertEqual(success.response_payload["cascade_level"], "heurístico")
        self.assertIn("provider_info", success.response_payload)

    def test_tertiary_answers_when_primary_and_secondary_fail(self):
        tertiary = ScriptedAIProvider(literature={
            "citations_by_subfactor": {self.subfactor1.id: 7},
            "sources_by_factor": {},
            "provider_info": "Cohere (command-r-plus-08-2024)",
        })
        service = AIService(
            primary_provider=ScriptedAIProvider(fail_message="azure down"),
            secondary_provider=ScriptedAIProvider(fail_message="groq down"),
            tertiary_provider=tertiary,
            safety_provider=HeuristicAIProvider(),
        )

        result = service.search_literature_and_citations(self.evaluation)

        self.assertEqual(result["citations_by_subfactor"][self.subfactor1.id], 7)
        self.assertEqual(result["provider"], "ScriptedAIProvider")
        self.assertEqual(tertiary.calls, ["literature"])
        logs = AIAssistanceLog.objects.filter(evaluation=self.evaluation)
        self.assertEqual(logs.filter(status=AIAssistanceLog.STATUS_ERROR).count(), 2)
        self.assertEqual(logs.filter(status=AIAssistanceLog.STATUS_SUCCESS).count(), 1)

    def test_importance_fallback_is_audited(self):
        secondary = ScriptedAIProvider(importance={
            "suggested_id": 4,
            "justification": "Marco regulatorio bancario.",
        })
        service = AIService(
            primary_provider=ScriptedAIProvider(fail_message="objeto JSON vacío"),
            secondary_provider=secondary,
            safety_provider=HeuristicAIProvider(),
        )

        result = service.suggest_factor_importance(self.evaluation, self.factor1, is_suggested=2)

        self.assertEqual(result["suggested_id"], 4)
        self.assertEqual(result["cascade_level"], "secundario")
        self.assertEqual(secondary.calls, ["importance"])
        logs = AIAssistanceLog.objects.filter(
            evaluation=self.evaluation,
            request_type=AIAssistanceLog.REQ_FACTOR_IMPORTANCE,
        )
        self.assertEqual(logs.filter(status=AIAssistanceLog.STATUS_ERROR).count(), 1)
        success = logs.get(status=AIAssistanceLog.STATUS_SUCCESS)
        self.assertIn("FALLBACK", success.error_message)
        self.assertEqual(success.response_payload["justification"], "Marco regulatorio bancario.")

    def test_invalid_verdict_json_still_tries_the_next_api(self):
        secondary = ScriptedAIProvider(verdict={
            "executive_summary": "Dictamen de Groq.",
            "mitigation_plan": "Plan de Groq.",
        })
        service = AIService(
            primary_provider=ScriptedAIProvider(fail_message="json_validate_failed"),
            secondary_provider=secondary,
            safety_provider=HeuristicAIProvider(),
        )

        result = service.generate_executive_summary_and_verdict(
            evaluation=self.evaluation,
            recommendation="B",
            explanation_text="Es posible adoptar, con matices.",
            weaknesses=[],
            strengths=[],
            ir_summary=[],
            factors=[],
        )

        self.assertEqual(result["executive_summary"], "Dictamen de Groq.")
        self.assertEqual(secondary.calls, ["verdict"])
        self.assertNotIn("Contingencia local", result["executive_summary"])

    def test_azure_failure_splits_the_catalog_for_the_next_api(self):
        for index in range(11):
            Subfactor.objects.create(
                factor=self.factor1,
                description=f"Criterio adicional de contingencia {index}.",
                base_citations_count=1,
                order=index + 3,
            )
        azure = AzureAIProvider(
            api_key="test-key",
            endpoint="https://lab.services.ai.azure.com/models",
            model_name="gpt-5-mini",
        )
        azure_sizes: list[int] = []

        def fail_literature(*args, **kwargs):
            azure_sizes.append(len(kwargs["subfactors_data"]))
            raise RuntimeError("azure down")

        azure.search_literature_and_citations = fail_literature
        secondary = ScriptedAIProvider()
        service = AIService(
            primary_provider=azure,
            secondary_provider=secondary,
            tertiary_provider=ScriptedAIProvider(fail_message="cohere no debe entrar"),
            safety_provider=HeuristicAIProvider(),
        )

        service.search_literature_and_citations(self.evaluation)

        self.assertEqual(azure_sizes, [13])
        self.assertEqual(sum(secondary.literature_sizes), 13)
        self.assertGreater(len(secondary.literature_sizes), 1)
        self.assertTrue(all(size <= 12 for size in secondary.literature_sizes))
        self.assertEqual(secondary.calls, ["literature"] * len(secondary.literature_sizes))
        error_logs = AIAssistanceLog.objects.filter(
            evaluation=self.evaluation,
            status=AIAssistanceLog.STATUS_ERROR,
        )
        self.assertEqual(error_logs.count(), 1)
        self.assertIn("azure down", error_logs.get().error_message)

    def test_literature_search_does_not_prefill_factor_or_subfactor_suggestions(self):
        service = AIService(
            primary_provider=ScriptedAIProvider(literature={
                "citations_by_subfactor": {self.subfactor1.id: 2},
                "sources_by_factor": {},
                "ratings_by_subfactor": {
                    self.subfactor1.id: {
                        "rating": 4,
                        "justification": "PostgreSQL cifra el tránsito con TLS de forma nativa.",
                    },
                },
                "importance_by_factor": {
                    self.factor1.id: {
                        "suggested_id": 4,
                        "justification": "En salud la fiabilidad del motor de datos es fundamental.",
                    },
                },
                "provider_info": "scripted",
            }),
            safety_provider=HeuristicAIProvider(),
        )

        result = service.search_literature_and_citations(self.evaluation)
        calculate_evaluation_literature(
            evaluation_id=self.evaluation.id,
            ai_citations_by_subfactor=result["citations_by_subfactor"],
            ai_sources_by_factor=result["sources_by_factor"],
        )

        row = EvaluationSubfactor.objects.get(evaluation=self.evaluation, subfactor=self.subfactor1)
        self.assertIsNone(row.ai_suggested_rating)
        self.assertIsNone(row.rating)
        factor_row = EvaluationFactor.objects.get(evaluation=self.evaluation, factor=self.factor1)
        self.assertIsNone(factor_row.ai_suggested_id)
        self.assertIsNone(factor_row.decisor_importance)


class AzureProviderContractTests(TestCase):
    """Contrato del cliente de Azure: ruta del recurso, presupuesto y JSON vacío."""

    def _provider(self, endpoint: str) -> AzureAIProvider:
        return AzureAIProvider(api_key="test-key", endpoint=endpoint, model_name="gpt-5-mini")

    def test_foundry_and_openai_v1_keep_their_own_routes(self):
        foundry = self._provider("https://lab.services.ai.azure.com/models")
        host_only = self._provider("https://lab.services.ai.azure.com")
        openai_v1 = self._provider("https://lab.openai.azure.com/openai/v1")
        responses = self._provider("https://lab.openai.azure.com/openai/v1/responses")
        openai_host = self._provider("https://lab.openai.azure.com")

        self.assertEqual(foundry.endpoint, "https://lab.services.ai.azure.com/models")
        self.assertEqual(host_only.endpoint, "https://lab.services.ai.azure.com/models")
        self.assertEqual(openai_v1.endpoint, "https://lab.openai.azure.com/openai/v1")
        self.assertEqual(responses.endpoint, "https://lab.openai.azure.com/openai/v1")
        self.assertEqual(openai_host.endpoint, "https://lab.openai.azure.com/openai/v1")
        self.assertNotIn("/models", openai_v1.endpoint)

    def test_empty_json_and_token_cutoff_do_not_count_as_success(self):
        provider = self._provider("https://lab.services.ai.azure.com/models")
        captured: dict = {}
        provider._client = _completion("", "stop", captured)

        with self.assertRaises(ValueError):
            provider.suggest_factor_importance(
                factor_name="Seguridad y Criptografía",
                factor_scope="internal",
                is_suggested=4,
                org_sector="Banca",
                org_description="Entidad financiera",
                software_name="PostgreSQL",
            )
        self.assertEqual(captured["max_completion_tokens"], AZURE_SHORT_MAX_COMPLETION_TOKENS)

        captured.clear()
        provider._client = _completion('{"suggested_id": 4}', "length", captured)
        with self.assertRaises(ValueError):
            provider.suggest_factor_importance(
                factor_name="Seguridad y Criptografía",
                factor_scope="internal",
                is_suggested=4,
                org_sector="Banca",
                org_description="Entidad financiera",
                software_name="PostgreSQL",
            )

    def test_each_operation_reserves_its_own_output_budget(self):
        provider = self._provider("https://lab.services.ai.azure.com/models")
        captured: dict = {}
        provider._client = _completion(
            '{"suggested_id": 4, "justification": "El sector financiero lo trata como control fundamental."}',
            "stop",
            captured,
        )
        importance = provider.suggest_factor_importance(
            factor_name="Seguridad y Criptografía",
            factor_scope="internal",
            is_suggested=2,
            org_sector="Banca",
            org_description="Entidad financiera",
            software_name="PostgreSQL",
        )
        self.assertEqual(importance["suggested_id"], 4)
        self.assertEqual(captured["max_completion_tokens"], AZURE_SHORT_MAX_COMPLETION_TOKENS)

        captured.clear()
        provider._client = _completion('{"sources": []}', "stop", captured)
        provider.search_literature_and_citations(
            software_name="PostgreSQL",
            software_category="Base de Datos",
            software_repo_url=None,
            software_description="RDBMS",
            subfactors_data=[{
                "id": 1,
                "factor_id": 1,
                "factor_name": "Seguridad",
                "description": "Cifrado en reposo y en tránsito.",
                "keywords_ia": "tls",
            }],
        )
        self.assertEqual(captured["max_completion_tokens"], AZURE_LITERATURE_MAX_COMPLETION_TOKENS)

        captured.clear()
        provider._client = _completion(
            '{"executive_summary": "Dictamen.", "mitigation_plan": "Plan."}',
            "stop",
            captured,
        )
        provider.generate_executive_summary_and_verdict(
            software_name="PostgreSQL",
            org_name="Banco",
            org_sector="Banca",
            recommendation="B",
            explanation_text="Es posible adoptar, con matices.",
            weaknesses=[],
            strengths=[],
            ir_summary=[],
        )
        self.assertEqual(captured["max_completion_tokens"], AZURE_VERDICT_MAX_COMPLETION_TOKENS)
        self.assertGreaterEqual(provider.timeout_seconds, 120)

    def test_cohere_invalid_json_raises_instead_of_returning_an_empty_object(self):
        class FakeResponse:
            status_code = 200
            text = "not-json"

            def json(self):
                return {"finish_reason": "COMPLETE", "message": {"content": [{"text": "{"}]}}

        class FakeClient:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def post(self, *args, **kwargs):
                return FakeResponse()

        provider = CohereAIProvider(api_key="test-key", model_name="command-r-plus-08-2024")
        with patch("apps.guios.services.ai.cohere_provider.httpx.Client", return_value=FakeClient()):
            with self.assertRaises(ValueError):
                provider.suggest_factor_importance(
                    factor_name="Soporte",
                    factor_scope="external",
                    is_suggested=3,
                    org_sector="Educación",
                    org_description="Universidad",
                    software_name="LibreOffice",
                )

    def test_blank_json_object_is_rejected(self):
        with self.assertRaises(ValueError):
            require_json_object("{}", "Azure OpenAI")
        with self.assertRaises(ValueError):
            require_json_object("", "Azure OpenAI")

