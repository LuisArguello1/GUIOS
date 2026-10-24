"""
apps/guios/test/test_evaluation_api.py
─────────────────────────────────────────────────────────────────────────────
Suite completa de pruebas de integración para la API de Evaluaciones GUIOS.
Endpoint: /api/v1/guios/evaluations/

Verifica:
1. Creación de una sesión de evaluación y auto-poblado de literatura / cuartiles / IS.
2. Listado optimizado con paginación y búsqueda.
3. Detalle completo de la evaluación (anti N+1).
4. Actualización de metadatos descriptivos.
5. Acción metodológica: POST /calculate-literature/ (Fase 3 / Paso 0).
6. Acción metodológica: POST /apply-decisor/ (Fase 4 / Pasos 1 y 2).
7. Acción metodológica: POST /rate-subfactors/ (Fase 4 / Pasos 3 y 4 - FODA).
8. Acción metodológica: POST /compute-verdict/ (Fase 4 / Paso 6 - Dictamen Final A/B/C).
9. Reglas de integridad: Bloqueo de mutación tras finalización (STATUS_COMPLETED).
10. Eliminación de evaluación (DELETE).
11. Control de acceso RBAC granular con HasModulePermission.
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.guios.models import (
    Dimension,
    Factor,
    Subfactor,
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
)

User = get_user_model()


class EvaluationAPITests(APITestCase):
    """
    Pruebas integrales de la API REST para el ciclo de vida de Evaluaciones GUIOS:
    Endpoint base: /api/v1/guios/evaluations/
    """

    def setUp(self):
        # 1. Crear usuario administrador con bypass superuser para pruebas de API
        self.user = User.objects.create_superuser(
            email="eval_admin@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Admin",
            last_name="GUIOS",
        )
        self.client.force_authenticate(user=self.user)

        # 2. Catálogo metodológico base de la tesis
        self.dim_tec = Dimension.objects.create(
            name="Dimensión Tecnológica",
            description="Criterios técnicos del software",
            order=1,
            is_base=True,
        )
        self.dim_org = Dimension.objects.create(
            name="Dimensión Organizacional",
            description="Criterios institucionales",
            order=2,
            is_base=True,
        )

        # Factor 1: Compatibilidad (Externo, IE=4)
        self.factor_comp = Factor.objects.create(
            dimension=self.dim_tec,
            name="Compatibilidad",
            scope=Factor.SCOPE_EXTERNAL,
            systemic_importance=3,
            expert_importance=4,
            literature_importance_base=3,
            order=1,
            is_base=True,
        )
        self.sf_comp_1 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="Interoperabilidad con formatos abiertos estándares",
            base_citations_count=10,
            order=1,
            is_base=True,
        )
        self.sf_comp_2 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="APIs REST y protocolos web documentados",
            base_citations_count=6,
            order=2,
            is_base=True,
        )

        # Factor 2: Soporte Técnico (Interno, IE=3)
        self.factor_sop = Factor.objects.create(
            dimension=self.dim_org,
            name="Soporte Técnico y Mantenimiento",
            scope=Factor.SCOPE_INTERNAL,
            systemic_importance=2,
            expert_importance=3,
            literature_importance_base=2,
            order=2,
            is_base=True,
        )
        self.sf_sop_1 = Subfactor.objects.create(
            factor=self.factor_sop,
            description="Disponibilidad de soporte comercial local o comunitario",
            base_citations_count=4,
            order=1,
            is_base=True,
        )

        # Factor 3: Madurez (Externo, IE=3)
        self.factor_mad = Factor.objects.create(
            dimension=self.dim_tec,
            name="Madurez del Proyecto",
            scope=Factor.SCOPE_EXTERNAL,
            systemic_importance=2,
            expert_importance=3,
            literature_importance_base=1,
            order=3,
            is_base=True,
        )
        self.sf_mad_1 = Subfactor.objects.create(
            factor=self.factor_mad,
            description="Historial continuo de versiones y lanzamientos estables",
            base_citations_count=2,
            order=1,
            is_base=True,
        )

        self.list_url = "/api/v1/guios/evaluations/"

    # ── 1. Pruebas de Creación de Evaluación ─────────────────────────────────

    def test_create_evaluation_success_with_auto_literature(self):
        """Crear una evaluación inicializa automáticamente los factores, cuartiles e IS."""
        payload = {
            "software_name": "PostgreSQL Database Server",
            "org_name": "Universidad Estatal de Milagro (UNEMI)",
            "software_category": "Base de Datos",
            "software_version": "16.2",
            "software_repo_url": "https://github.com/postgres/postgres",
            "software_description": "Sistema gestor de bases de datos relacional y transaccional.",
            "org_sector": "Educación Superior",
            "org_description": "Infraestructura de datos para el sistema académico.",
            "ai_enabled": False,
            "auto_compute_literature": True,
        }

        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["software_name"], "PostgreSQL Database Server")
        self.assertEqual(response.data["status"], Evaluation.STATUS_IN_PROGRESS)

        # Verificar que se crearon los umbrales de cuartiles
        self.assertIsNotNone(response.data["q1_threshold"])
        self.assertIsNotNone(response.data["q2_threshold"])
        self.assertIsNotNone(response.data["q3_threshold"])
        self.assertIsNotNone(response.data["q4_threshold"])

        # Verificar factores creados (3 factores)
        self.assertEqual(len(response.data["factors"]), 3)
        # Verificar subfactores creados (4 subfactores)
        self.assertEqual(len(response.data["subfactors"]), 4)

    def test_create_evaluation_missing_required_fields_fails(self):
        """No se puede crear una evaluación sin software_name u org_name."""
        response = self.client.post(self.list_url, {"software_name": ""}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── 2. Pruebas de Listado y Detalle ──────────────────────────────────────

    def test_list_evaluations_paginated(self):
        """El listado devuelve estructura paginada optimizada."""
        Evaluation.objects.create(
            software_name="Linux Ubuntu",
            org_name="UNEMI",
            created_by=self.user,
        )
        Evaluation.objects.create(
            software_name="LibreOffice",
            org_name="UNEMI",
            created_by=self.user,
        )

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)
        self.assertEqual(response.data["count"], 2)

    def test_retrieve_evaluation_detail_success(self):
        """La consulta de detalle retorna la jerarquía completa."""
        eval_obj = Evaluation.objects.create(
            software_name="Moodle LMS",
            org_name="UNEMI",
            created_by=self.user,
        )
        url = f"{self.list_url}{eval_obj.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["software_name"], "Moodle LMS")
        self.assertIn("factors", response.data)
        self.assertIn("subfactors", response.data)

    def test_retrieve_non_existing_evaluation_returns_404(self):
        """Consultar una evaluación inexistente retorna 404."""
        response = self.client.get(f"{self.list_url}99999/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── 3. Pruebas de Actualización de Metadatos ──────────────────────────────

    def test_update_evaluation_metadata_success(self):
        """Actualizar versión o categoría descriptiva."""
        eval_obj = Evaluation.objects.create(
            software_name="Nextcloud",
            org_name="UNEMI",
            created_by=self.user,
        )
        url = f"{self.list_url}{eval_obj.id}/"
        payload = {
            "software_version": "28.0.1",
            "software_category": "Almacenamiento Cloud",
        }
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["software_version"], "28.0.1")
        self.assertEqual(response.data["software_category"], "Almacenamiento Cloud")

    # ── 4. Pruebas de Acciones Metodológicas (Flujo de la Tesis) ───────────────

    def test_full_methodological_evaluation_flow(self):
        """
        Simulación completa del ciclo de vida de evaluación (Capítulos 5 y 6 de la tesis):
        1. Inicialización (Fase 3 / Paso 0)
        2. Recálculo de literatura con citas personalizadas
        3. Decisor asigna ID y ámbito (Paso 1-2)
        4. Calificación de subfactores y matriz FODA (Paso 3-4-5)
        5. Emisión de veredicto institucional final (Paso 6)
        """
        # Paso 1: Crear evaluación
        create_res = self.client.post(
            self.list_url,
            {
                "software_name": "Apache Superset",
                "org_name": "Dirección de TI UNEMI",
                "software_category": "Business Intelligence",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        eval_id = create_res.data["id"]

        # Paso 2: POST /calculate-literature/
        calc_url = f"{self.list_url}{eval_id}/calculate-literature/"
        calc_res = self.client.post(
            calc_url,
            {
                "ai_citations_by_subfactor": {
                    self.sf_comp_1.id: 15,
                    self.sf_comp_2.id: 10,
                    self.sf_sop_1.id: 5,
                    self.sf_mad_1.id: 2,
                }
            },
            format="json",
        )
        self.assertEqual(calc_res.status_code, status.HTTP_200_OK)
        # Compatibilidad TC=25, NS=2 -> ri = 12.5
        # Soporte TC=5, NS=1 -> ri = 5.0
        # Madurez TC=2, NS=1 -> ri = 2.0
        self.assertIsNotNone(calc_res.data["q1_threshold"])

        # Paso 3: POST /apply-decisor/ (ID para cada factor)
        decisor_url = f"{self.list_url}{eval_id}/apply-decisor/"
        decisor_payload = {
            "factors": [
                {
                    "factor_id": self.factor_comp.id,
                    "decisor_importance": 4,  # Fundamental
                    "scope_used": "external",
                },
                {
                    "factor_id": self.factor_sop.id,
                    "decisor_importance": 3,  # Importante
                    "scope_used": "internal",
                },
                {
                    "factor_id": self.factor_mad.id,
                    "decisor_importance": 1,  # Irrelevante (se descarta de FODA)
                    "scope_used": "external",
                },
            ]
        }
        decisor_res = self.client.post(decisor_url, decisor_payload, format="json")
        self.assertEqual(decisor_res.status_code, status.HTTP_200_OK)

        # Verificar factores relevantes
        factors_map = {f["factor_id"]: f for f in decisor_res.data["factors"]}
        self.assertTrue(factors_map[self.factor_comp.id]["is_relevant"])
        self.assertTrue(factors_map[self.factor_sop.id]["is_relevant"])
        # Madurez ID=1 -> IR=1 -> is_relevant = False
        self.assertFalse(factors_map[self.factor_mad.id]["is_relevant"])

        # Paso 4: POST /rate-subfactors/ (Calificación de subfactores relevantes)
        rate_url = f"{self.list_url}{eval_id}/rate-subfactors/"
        rate_payload = {
            "ratings": {
                str(self.sf_comp_1.id): 4,
                str(self.sf_comp_2.id): 3,  # Compatibilidad PM = (4+3)/2 = 3.5 >= 3.0 (Oportunidad)
                str(self.sf_sop_1.id): 4,   # Soporte PM = 4.0 >= 3.0 (Fortaleza)
            }
        }
        rate_res = self.client.post(rate_url, rate_payload, format="json")
        self.assertEqual(rate_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(rate_res.data["results"]), 2)

        results_by_factor = {r["factor_id"]: r for r in rate_res.data["results"]}
        # Compatibilidad: Oportunidad
        self.assertEqual(results_by_factor[self.factor_comp.id]["foda_classification"], "opportunity")
        self.assertTrue(results_by_factor[self.factor_comp.id]["meets_threshold"])
        # Soporte: Fortaleza
        self.assertEqual(results_by_factor[self.factor_sop.id]["foda_classification"], "strength")
        self.assertTrue(results_by_factor[self.factor_sop.id]["meets_threshold"])

        # Paso 5: POST /compute-verdict/ (Emisión del veredicto final)
        verdict_url = f"{self.list_url}{eval_id}/compute-verdict/"
        verdict_payload = {
            "ai_executive_summary": "Evaluación favorable para la plataforma Apache Superset.",
            "ai_mitigation_plan": "Sin observaciones críticas.",
        }
        verdict_res = self.client.post(verdict_url, verdict_payload, format="json")
        self.assertEqual(verdict_res.status_code, status.HTTP_200_OK)

        verdict_data = verdict_res.data["verdict"]
        self.assertIsNotNone(verdict_data)
        # Todos los factores relevantes cumplen PM >= 3.0 -> Recomendación A
        self.assertEqual(verdict_data["recommendation"], EvaluationVerdict.RECOMMENDATION_A)
        self.assertIn("Adoptar sin observaciones", verdict_data["explanation_text"])

        # La evaluación debe quedar completada
        self.assertEqual(verdict_res.data["status"], Evaluation.STATUS_COMPLETED)
        self.assertIsNotNone(verdict_res.data["completed_at"])

        # Paso 6: Intentar mutar la evaluación completada debe ser rechazado
        mod_res = self.client.patch(
            f"{self.list_url}{eval_id}/",
            {"software_name": "Nombre Modificado"},
            format="json",
        )
        self.assertEqual(mod_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ya se encuentra completada", mod_res.data["error"])

    # ── 5. Pruebas de Eliminación ─────────────────────────────────────────────

    def test_delete_evaluation_success(self):
        """Eliminar una evaluación remueve la sesión y satélites."""
        eval_obj = Evaluation.objects.create(
            software_name="Temp Software",
            org_name="UNEMI",
            created_by=self.user,
        )
        url = f"{self.list_url}{eval_obj.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Evaluation.objects.filter(pk=eval_obj.id).exists())

    # ── 6. Pruebas de Permisos RBAC Granulares ────────────────────────────────

    def test_unauthenticated_request_returns_401(self):
        """Petición anónima es rechazada con 401 Unauthorized."""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unprivileged_user_cannot_access_evaluations(self):
        """Usuario sin permiso 'guios.evaluation_view' recibe 403 Forbidden."""
        normal_user = User.objects.create_user(
            email="normal_eval_user@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Sin",
            last_name="Permisos",
        )
        self.client.force_authenticate(user=normal_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
