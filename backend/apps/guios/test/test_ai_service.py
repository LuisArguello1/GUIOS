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
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
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
from apps.guios.services.ai.base import BaseAIProvider
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

    def generate_executive_summary_and_verdict(self, *args, **kwargs):
        raise RuntimeError("Model unavailable")


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
        self.assertIn("citations_by_subfactor", result)
        self.assertIn("sources_by_factor", result)
        self.assertGreaterEqual(result["citations_by_subfactor"][self.subfactor1.id], 1)

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

