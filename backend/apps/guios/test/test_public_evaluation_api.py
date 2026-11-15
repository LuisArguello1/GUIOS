"""
apps/guios/test/test_public_evaluation_api.py
─────────────────────────────────────────────────────────────────────────────
Pruebas de integración para la API de Evaluación Pública GUIOS PRO.
Endpoint base: /api/v1/guios/public/evaluations/

Verifica:
1. Acceso sin autenticación (AllowAny).
2. Consulta del catálogo público (árbol Dimensión -> Factor -> Subfactor).
3. Inicio de evaluación anónima mediante UUID.
4. Consulta de estado y detalle por UUID.
5. Aplicación del criterio del decisor (ID) y cálculo determinista de IR.
6. Calificación de subfactores y cálculo de PM / FODA.
7. Emisión del dictamen institucional (A/B/C).
8. Descarga de Dossier en PDF y Excel.
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.guios.models import Dimension, Factor, Subfactor, Evaluation, EvaluationResult
from apps.guios.services.ai.verdict_narrative import build_predetermined_narrative


class PublicEvaluationAPITests(APITestCase):
    def setUp(self):
        # Catálogo metodológico mínimo para pruebas
        self.dim = Dimension.objects.create(
            name="Dimensión Tecnológica",
            description="Criterios técnicos",
            order=1,
            is_base=True,
        )
        self.factor_func = Factor.objects.create(
            dimension=self.dim,
            name="Funcionalidad",
            systemic_importance=3,
            expert_importance=3,
            scope=Factor.SCOPE_INTERNAL,
            order=1,
            is_base=True,
        )
        self.sub_func_1 = Subfactor.objects.create(
            factor=self.factor_func,
            description="Cubre los casos de uso principales de la organización.",
            base_citations_count=5,
            order=1,
        )
        self.sub_func_2 = Subfactor.objects.create(
            factor=self.factor_func,
            description="Dispone de API REST documentada.",
            base_citations_count=3,
            order=2,
        )

        self.factor_soporte = Factor.objects.create(
            dimension=self.dim,
            name="Soporte",
            systemic_importance=2,
            expert_importance=2,
            scope=Factor.SCOPE_BOTH,
            scope_configurable=True,
            order=2,
            is_base=True,
        )
        self.sub_sop_1 = Subfactor.objects.create(
            factor=self.factor_soporte,
            description="Existe comunidad activa de soporte.",
            base_citations_count=2,
            order=1,
        )

    def test_get_public_catalog(self):
        """GET /api/v1/guios/public/evaluations/catalog/ retorna el catálogo activo."""
        url = "/api/v1/guios/public/evaluations/catalog/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        dim_data = response.data[0]
        self.assertIn("factors", dim_data)
        self.assertIn("subfactors", dim_data["factors"][0])

    def test_full_public_evaluation_lifecycle(self):
        """Ciclo de vida completo del módulo público de evaluación."""
        # 1. Crear evaluación pública anónima
        create_url = "/api/v1/guios/public/evaluations/"
        payload = {
            "software_name": "PostgreSQL",
            "org_name": "UNEMI",
            "software_category": "Base de Datos",
            "software_version": "16.1",
            "software_description": "Motor relacional ACID de alto rendimiento.",
            "org_sector": "Educación Superior",
            "org_description": "Universidad pública con 30.000 estudiantes.",
            "org_size": "251 a 1.000 colaboradores (Grande)",
            "it_staff": "16 a 50 personas",
            "replaced_software": "Microsoft SQL Server",
            "target_timeline": "6 a 12 meses",
            "current_platforms": "Windows",
            "main_goal": "Seguridad y soberanía de datos",
            "ai_enabled": False,
            "auto_compute_literature": True,
            "data_storage_consent": True,
        }
        res_create = self.client.post(create_url, payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_create.data["org_size"], "251 a 1.000 colaboradores (Grande)")
        self.assertEqual(res_create.data["it_staff"], "16 a 50 personas")
        self.assertEqual(res_create.data["replaced_software"], "Microsoft SQL Server")
        self.assertEqual(res_create.data["target_timeline"], "6 a 12 meses")
        self.assertEqual(res_create.data["current_platforms"], "Windows")
        self.assertEqual(res_create.data["main_goal"], "Seguridad y soberanía de datos")
        self.assertIn("uuid", res_create.data)
        uuid_str = res_create.data["uuid"]
        self.assertIsNotNone(uuid_str)
        self.assertEqual(res_create.data["software_name"], "PostgreSQL")
        self.assertEqual(len(res_create.data["factors"]), 2)

        # 2. Consultar detalle por UUID
        detail_url = f"/api/v1/guios/public/evaluations/{uuid_str}/"
        res_detail = self.client.get(detail_url)
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data["uuid"], uuid_str)

        # 3. Aplicar criterio del decisor (ID)
        decisor_url = f"/api/v1/guios/public/evaluations/{uuid_str}/apply-decisor/"
        decisor_payload = {
            "factors": [
                {
                    "factor_id": self.factor_func.id,
                    "decisor_importance": 4,  # Fundamental
                    "scope_used": "internal",
                },
                {
                    "factor_id": self.factor_soporte.id,
                    "decisor_importance": 3,  # Importante
                    "scope_used": "external",
                },
            ]
        }
        res_decisor = self.client.post(decisor_url, decisor_payload, format="json")
        self.assertEqual(res_decisor.status_code, status.HTTP_200_OK)
        # Verificar que ambos factores fueron marcados como relevantes (IR > 1)
        for f in res_decisor.data["factors"]:
            self.assertTrue(f["is_relevant"])
            self.assertGreaterEqual(f["relative_importance"], 2)

        # 4. Calificar subfactores (Paso 3 y 4)
        rate_url = f"/api/v1/guios/public/evaluations/{uuid_str}/rate-subfactors/"
        rate_payload = {
            "ratings": {
                str(self.sub_func_1.id): 4,
                str(self.sub_func_2.id): 4,
                str(self.sub_sop_1.id): 3,
            }
        }
        res_rate = self.client.post(rate_url, rate_payload, format="json")
        self.assertEqual(res_rate.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res_rate.data["results"]), 1)
        # Funcionalidad tiene PM = (4+4)/2 = 4.0 >= 3.0 -> Fortaleza
        res_foda = {r["factor_id"]: r for r in res_rate.data["results"]}
        self.assertEqual(res_foda[self.factor_func.id]["foda_classification"], "strength")
        self.assertEqual(res_foda[self.factor_func.id]["foda_display"], "Fortaleza")

        # 5. Emitir dictamen final (Paso 5 y 6)
        verdict_url = f"/api/v1/guios/public/evaluations/{uuid_str}/compute-verdict/"
        verdict_payload = {
            "ai_executive_summary": "Resumen ejecutivo de prueba.",
            "ai_mitigation_plan": "Plan de mitigación de prueba.",
        }
        res_verdict = self.client.post(verdict_url, verdict_payload, format="json")
        self.assertEqual(res_verdict.status_code, status.HTTP_200_OK)
        self.assertEqual(res_verdict.data["status"], Evaluation.STATUS_COMPLETED)
        self.assertIsNotNone(res_verdict.data["verdict"])
        self.assertIn(res_verdict.data["verdict"]["recommendation"], ["A", "B", "C"])

        # 6. Descargar reportes PDF y Excel
        pdf_url = f"/api/v1/guios/public/evaluations/{uuid_str}/export-pdf/"
        res_pdf = self.client.get(pdf_url)
        self.assertEqual(res_pdf.status_code, status.HTTP_200_OK)
        self.assertEqual(res_pdf["Content-Type"], "application/pdf")

        excel_url = f"/api/v1/guios/public/evaluations/{uuid_str}/export-excel/"
        res_excel = self.client.get(excel_url)
        self.assertEqual(res_excel.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", res_excel["Content-Type"])

    @patch("apps.guios.tasks.execute_evaluation_literature_ai_task.delay")
    def test_public_create_with_ai_shows_base_citations_while_searching(self, delay_mock):
        """Con IA activa, el alta encola la búsqueda y el paso 1 sigue viendo las citas base."""
        delay_mock.return_value = MagicMock(id="task-literatura")
        response = self.client.post(
            "/api/v1/guios/public/evaluations/",
            {
                "software_name": "LibreOffice",
                "org_name": "UNEMI",
                "ai_enabled": True,
                "data_storage_consent": True,
                "ai_processing_consent": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["ai_status"], Evaluation.AI_STATUS_SEARCHING)
        citations = {item["factor_id"]: item["citations_count"] for item in response.data["factors"]}
        self.assertEqual(citations[self.factor_func.id], 8)
        self.assertEqual(citations[self.factor_soporte.id], 2)
        delay_mock.assert_called_once()

        decisor = self.client.post(
            f"/api/v1/guios/public/evaluations/{response.data['uuid']}/apply-decisor/",
            {
                "factors": [
                    {"factor_id": self.factor_func.id, "decisor_importance": 4, "scope_used": "internal"},
                ]
            },
            format="json",
        )
        self.assertEqual(decisor.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("literatura", decisor.data["error"])


    def test_public_create_without_storage_consent_fails(self):
        """Crear evaluación pública sin consentimiento de almacenamiento falla con 400."""
        response = self.client.post(
            "/api/v1/guios/public/evaluations/",
            {
                "software_name": "Nextcloud",
                "org_name": "UNEMI",
                "data_storage_consent": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_storage_consent", response.data)

    def test_public_create_ai_without_ai_consent_fails(self):
        """Crear evaluación con IA activa pero sin consentimiento de IA falla con 400."""
        response = self.client.post(
            "/api/v1/guios/public/evaluations/",
            {
                "software_name": "Nextcloud",
                "org_name": "UNEMI",
                "ai_enabled": True,
                "data_storage_consent": True,
                "ai_processing_consent": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ai_processing_consent", response.data)

    def test_public_create_saves_consent_ip_hash_and_timestamp(self):
        """El alta pública persiste el hash anonimizado de la IP y marca de tiempo."""
        response = self.client.post(
            "/api/v1/guios/public/evaluations/",
            {
                "software_name": "Odoo ERP",
                "org_name": "UNEMI",
                "data_storage_consent": True,
            },
            format="json",
            REMOTE_ADDR="192.168.1.100",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["data_storage_consent"])
        self.assertIsNotNone(response.data["consent_timestamp"])

        eval_obj = Evaluation.objects.get(uuid=response.data["uuid"])
        self.assertTrue(len(eval_obj.consent_ip_hash) > 0)
        self.assertEqual(len(eval_obj.consent_ip_hash), 64)  # SHA-256 hex length

    def test_d30_lock_phases_blocks_subfactor_and_decisor_mutations(self):
        """D-30: POST /lock-phases/ bloquea mutaciones posteriores en apply-decisor y rate-subfactors."""
        res_create = self.client.post(
            "/api/v1/guios/public/evaluations/",
            {
                "software_name": "Keycloak",
                "org_name": "UNEMI",
                "ai_enabled": False,
                "data_storage_consent": True,
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        uuid_str = res_create.data["uuid"]

        res_decisor = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/apply-decisor/",
            {
                "factors": [
                    {"factor_id": self.factor_func.id, "decisor_importance": 4, "scope_used": "internal"},
                    {"factor_id": self.factor_soporte.id, "decisor_importance": 3, "scope_used": "external"},
                ]
            },
            format="json",
        )
        self.assertEqual(res_decisor.status_code, status.HTTP_200_OK)

        res_rate = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/rate-subfactors/",
            {
                "ratings": {
                    str(self.sub_func_1.id): 2,
                    str(self.sub_func_2.id): 2,
                    str(self.sub_sop_1.id): 3,
                }
            },
            format="json",
        )
        self.assertEqual(res_rate.status_code, status.HTTP_200_OK)

        res_lock = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/lock-phases/",
            {},
            format="json",
        )
        self.assertEqual(res_lock.status_code, status.HTTP_200_OK)
        self.assertTrue(res_lock.data["phases_locked"])

        res_rate_after = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/rate-subfactors/",
            {"ratings": {str(self.sub_func_1.id): 4, str(self.sub_func_2.id): 4}},
            format="json",
        )
        self.assertEqual(res_rate_after.status_code, status.HTTP_400_BAD_REQUEST)

        res_decisor_after = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/apply-decisor/",
            {"factors": [{"factor_id": self.factor_func.id, "decisor_importance": 1, "scope_used": "internal"}]},
            format="json",
        )
        self.assertEqual(res_decisor_after.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.guios.tasks._has_active_celery_worker", return_value=False)
    @patch("apps.guios.tasks._has_ai_credentials_configured", return_value=True)
    def test_d31_ai_degrades_gracefully_without_celery_worker_and_on_timeout(self, _cred, _worker):
        """D-31: sin worker Celery o al expirar 25s, ai_status pasa a 'failed' y deja continuar."""
        res_create = self.client.post(
            "/api/v1/guios/public/evaluations/",
            {
                "software_name": "Redmine",
                "org_name": "UNEMI",
                "ai_enabled": True,
                "data_storage_consent": True,
                "ai_processing_consent": True,
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_create.data["ai_status"], Evaluation.AI_STATUS_FAILED)
        self.assertGreaterEqual(len(res_create.data["factors"]), 2)

        # Timeout automático en retrieve si una búsqueda quedó atascada > 25s
        eval_obj = Evaluation.objects.get(uuid=res_create.data["uuid"])
        Evaluation.objects.filter(pk=eval_obj.pk).update(
            ai_status=Evaluation.AI_STATUS_SEARCHING,
            started_at=timezone.now() - timedelta(seconds=30),
        )
        res_get = self.client.get(f"/api/v1/guios/public/evaluations/{eval_obj.uuid}/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data["ai_status"], Evaluation.AI_STATUS_FAILED)

    def test_d32_discarded_ir1_factor_excluded_from_mitigation_and_verdict(self):
        """D-32: un factor descartado (IR=1, is_relevant=False) no aparece en resultados ni mitigación."""
        res_create = self.client.post(
            "/api/v1/guios/public/evaluations/",
            {
                "software_name": "Gitea",
                "org_name": "UNEMI",
                "ai_enabled": False,
                "data_storage_consent": True,
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        uuid_str = res_create.data["uuid"]
        eval_obj = Evaluation.objects.get(uuid=uuid_str)

        # Crear un resultado residual previo para simular cambio de decisor a IR=1
        EvaluationResult.objects.create(
            evaluation=eval_obj,
            factor=self.factor_soporte,
            weighted_average=1.0,
            meets_threshold=False,
            foda_classification=EvaluationResult.FODA_THREAT,
        )

        # Descartar factor_soporte (IS=2, ID=1 -> IR=1 Irrelevante)
        res_decisor = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/apply-decisor/",
            {
                "factors": [
                    {"factor_id": self.factor_func.id, "decisor_importance": 4, "scope_used": "internal"},
                    {"factor_id": self.factor_soporte.id, "decisor_importance": 1, "scope_used": "external"},
                ]
            },
            format="json",
        )
        self.assertEqual(res_decisor.status_code, status.HTTP_200_OK)
        self.assertFalse(
            EvaluationResult.objects.filter(evaluation=eval_obj, factor=self.factor_soporte).exists()
        )

        res_rate = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/rate-subfactors/",
            {"ratings": {str(self.sub_func_1.id): 4, str(self.sub_func_2.id): 4}},
            format="json",
        )
        self.assertEqual(res_rate.status_code, status.HTTP_200_OK)

        res_verdict = self.client.post(
            f"/api/v1/guios/public/evaluations/{uuid_str}/compute-verdict/",
            {},
            format="json",
        )
        self.assertEqual(res_verdict.status_code, status.HTTP_200_OK)
        self.assertEqual(res_verdict.data["verdict"]["recommendation"], "A")
        self.assertNotIn("Soporte", res_verdict.data["verdict"]["ai_mitigation_plan"])

        narrative = build_predetermined_narrative(
            software_name="Gitea",
            org_name="UNEMI",
            org_sector="TI",
            recommendation="A",
            explanation_text="Todos aprobados",
            factors=[
                {"factor": "Funcionalidad", "pm": 4.0, "foda": "Fortaleza", "ir": 3, "supera_umbral": True},
                {"factor": "Soporte", "pm": 0.0, "foda": "Amenaza", "ir": 1, "es_relevante": False, "supera_umbral": False},
            ],
        )
        self.assertNotIn("Soporte", narrative["mitigation_plan"])
