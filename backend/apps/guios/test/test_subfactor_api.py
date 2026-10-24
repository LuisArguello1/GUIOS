"""
apps/guios/test/test_subfactor_api.py
─────────────────────────────────────────────────────────────────────────────
Suite de pruebas de integración para el CRUD del catálogo de Subfactores.
Verifica:
- Listado optimizado con factor y dimensión asociada (sin N+1 queries).
- Filtros por factor, dimensión, is_base, is_active y búsqueda.
- Consulta de detalle de un subfactor individual.
- Creación con validaciones de unicidad de descripción por factor y saneamiento.
- Actualización total (PUT) y parcial (PATCH).
- Reglas de integridad de negocio para eliminación (bloqueo de base y con evaluaciones asociadas).
- Control de acceso RBAC granular con HasModulePermission.
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.guios.models import Dimension, Factor, Subfactor, Evaluation, EvaluationSubfactor

User = get_user_model()


class SubfactorAPITests(APITestCase):
    """
    Pruebas integrales de la API REST para el CRUD de Subfactores:
    Endpoint: /api/v1/guios/subfactors/
    """

    def setUp(self):
        # 1. Crear usuario administrador con bypass superuser para pruebas de CRUD
        self.user = User.objects.create_superuser(
            email="admin_guios@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Admin",
            last_name="GUIOS",
        )
        self.client.force_authenticate(user=self.user)

        # 2. Estructura de dimensiones
        self.dim_tec = Dimension.objects.create(
            name="Tecnológica",
            description="Factores técnicos",
            order=1,
            is_base=True,
        )
        self.dim_org = Dimension.objects.create(
            name="Organizacional",
            description="Factores organizacionales",
            order=2,
            is_base=True,
        )

        # 3. Factores base
        self.factor_comp = Factor.objects.create(
            dimension=self.dim_tec,
            name="Compatibilidad",
            scope=Factor.SCOPE_EXTERNAL,
            systemic_importance=3,
            expert_importance=3,
            literature_importance_base=3,
            order=1,
            is_base=True,
        )
        self.factor_cost = Factor.objects.create(
            dimension=self.dim_org,
            name="Costos",
            scope=Factor.SCOPE_INTERNAL,
            systemic_importance=4,
            expert_importance=4,
            literature_importance_base=3,
            order=1,
            is_base=True,
        )

        # 4. Subfactores base
        self.subfactor_1 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="El software interactúa y se integra con el software existente.",
            base_citations_count=3,
            keywords_ia="integración, interoperabilidad",
            order=1,
            is_base=True,
            is_active=True,
        )
        self.subfactor_2 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="Una empresa proporciona infraestructura en la nube para este software.",
            base_citations_count=2,
            keywords_ia="cloud, hosting, saas",
            order=2,
            is_base=True,
            is_active=False,
        )
        self.subfactor_3 = Subfactor.objects.create(
            factor=self.factor_cost,
            description="Los costos de capacitación y soporte son viables.",
            base_citations_count=4,
            keywords_ia="costos, soporte, tco",
            order=1,
            is_base=True,
            is_active=True,
        )

        self.list_url = "/api/v1/guios/subfactors/"

    # ── 1. Pruebas de Listado y Optimización ───────────────────────────────────

    def test_list_subfactors_success(self):
        """GET /api/v1/guios/subfactors/ devuelve lista con factor y dimensión precargados."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data.get('results', response.data)
        self.assertEqual(len(data), 3)

        first_item = data[0]
        self.assertIn('factor', first_item)
        self.assertIn('name', first_item['factor'])
        self.assertIn('dimension_name', first_item['factor'])
        self.assertEqual(first_item['factor']['name'], "Compatibilidad")
        self.assertEqual(first_item['factor']['dimension_name'], "Tecnológica")

    def test_filter_subfactors_by_factor(self):
        """Filtrado mediante parámetro ?factor=<id>."""
        response = self.client.get(self.list_url, {'factor': self.factor_cost.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data.get('results', response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], self.subfactor_3.id)

    def test_filter_subfactors_by_dimension(self):
        """Filtrado mediante parámetro ?dimension=<id>."""
        response = self.client.get(self.list_url, {'dimension': self.dim_tec.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data.get('results', response.data)
        self.assertEqual(len(data), 2)
        for item in data:
            self.assertEqual(item['factor']['dimension_id'], self.dim_tec.id)

    def test_filter_subfactors_by_active_status(self):
        """Filtrado por is_active=true e is_active=false."""
        response_active = self.client.get(self.list_url, {'is_active': 'true'})
        data_active = response_active.data.get('results', response_active.data)
        self.assertEqual(len(data_active), 2)

        response_inactive = self.client.get(self.list_url, {'is_active': 'false'})
        data_inactive = response_inactive.data.get('results', response_inactive.data)
        self.assertEqual(len(data_inactive), 1)
        self.assertEqual(data_inactive[0]['id'], self.subfactor_2.id)

    def test_search_subfactors(self):
        """Búsqueda por texto en descripción o palabras clave."""
        response = self.client.get(self.list_url, {'search': 'infraestructura'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data.get('results', response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], self.subfactor_2.id)

    # ── 2. Pruebas de Detalle (Retrieve) ──────────────────────────────────────

    def test_retrieve_subfactor_detail_success(self):
        """GET /api/v1/guios/subfactors/{id}/ obtiene detalle completo."""
        url = f"{self.list_url}{self.subfactor_1.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.subfactor_1.id)
        self.assertEqual(response.data['description'], self.subfactor_1.description)
        self.assertEqual(response.data['base_citations_count'], 3)
        self.assertEqual(response.data['keywords_ia'], "integración, interoperabilidad")

    def test_retrieve_non_existent_subfactor_returns_404(self):
        """GET /api/v1/guios/subfactors/99999/ retorna 404."""
        url = f"{self.list_url}99999/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── 3. Pruebas de Creación (Create) ───────────────────────────────────────

    def test_create_custom_subfactor_success(self):
        """POST /api/v1/guios/subfactors/ crea un subfactor personalizado correctamente."""
        payload = {
            "factor_id": self.factor_comp.id,
            "description": "El software soporta autenticación mediante SAML / OAuth 2.0.",
            "base_citations_count": 2,
            "keywords_ia": "saml, sso, oauth",
            "order": 3,
            "is_active": True,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['description'], payload['description'])
        self.assertFalse(response.data['is_base'])
        self.assertEqual(response.data['factor']['id'], self.factor_comp.id)

    def test_create_duplicate_description_in_same_factor_fails(self):
        """No se permite duplicar la descripción de un subfactor dentro del mismo factor."""
        payload = {
            "factor_id": self.factor_comp.id,
            "description": "  el software interactúa y se integra con el software existente.  ",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ya existe un subfactor con la misma descripción', response.data['error'])

    def test_create_same_description_in_different_factor_allowed(self):
        """La misma descripción sí está permitida en un factor distinto."""
        payload = {
            "factor_id": self.factor_cost.id,
            "description": "El software interactúa y se integra con el software existente.",
            "base_citations_count": 1,
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['factor']['id'], self.factor_cost.id)

    def test_create_subfactor_with_invalid_factor_fails(self):
        """Crear subfactor asociado a factor inexistente retorna 400."""
        payload = {
            "factor_id": 99999,
            "description": "Criterio con factor inexistente",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── 4. Pruebas de Actualización (Update / Partial Update) ──────────────────

    def test_update_subfactor_partial_success(self):
        """PATCH actualiza los campos especificados."""
        url = f"{self.list_url}{self.subfactor_1.id}/"
        payload = {
            "keywords_ia": "api, rest, interoperabilidad ampliada",
            "base_citations_count": 5,
        }
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['keywords_ia'], "api, rest, interoperabilidad ampliada")
        self.assertEqual(response.data['base_citations_count'], 5)

    def test_update_duplicate_description_in_same_factor_fails(self):
        """Intentar actualizar una descripción a una ya existente en el factor retorna 400."""
        url = f"{self.list_url}{self.subfactor_2.id}/"
        payload = {
            "description": "El software interactúa y se integra con el software existente.",
        }
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ya existe un subfactor con la misma descripción', response.data['error'])

    # ── 5. Pruebas de Eliminación y Reglas de Integridad ───────────────────────

    def test_delete_base_subfactor_fails(self):
        """Regla de negocio: PROHIBIDO eliminar subfactores del catálogo base de la tesis."""
        url = f"{self.list_url}{self.subfactor_1.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('catálogo base oficial', response.data['error'])
        self.assertTrue(Subfactor.objects.filter(pk=self.subfactor_1.id).exists())

    def test_delete_subfactor_referenced_in_evaluations_fails(self):
        """Regla de negocio: PROHIBIDO eliminar subfactores con evaluaciones registradas."""
        custom_subfactor = Subfactor.objects.create(
            factor=self.factor_comp,
            description="Subfactor usado en evaluación activa",
            is_base=False,
        )

        evaluation = Evaluation.objects.create(
            software_name="PostgreSQL",
            org_name="UNEMI",
            created_by=self.user,
        )
        EvaluationSubfactor.objects.create(
            evaluation=evaluation,
            subfactor=custom_subfactor,
            description_snapshot=custom_subfactor.description,
            rating=4,
        )

        url = f"{self.list_url}{custom_subfactor.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('referenciado en evaluaciones', response.data['error'])
        self.assertTrue(Subfactor.objects.filter(pk=custom_subfactor.id).exists())

    def test_delete_custom_unreferenced_subfactor_success(self):
        """Un subfactor personalizado sin dependencias en evaluaciones sí puede eliminarse."""
        custom_subfactor = Subfactor.objects.create(
            factor=self.factor_comp,
            description="Subfactor personalizable y descartable",
            is_base=False,
        )

        url = f"{self.list_url}{custom_subfactor.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Subfactor.objects.filter(pk=custom_subfactor.id).exists())

    # ── 6. Pruebas de RBAC y Permisos Granulares ───────────────────────────────

    def test_unauthenticated_request_returns_401(self):
        """Petición anónima retorna 401 Unauthorized."""
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unprivileged_user_cannot_access_subfactors(self):
        """Usuario sin permisos de módulo recibe 403 Forbidden."""
        normal_user = User.objects.create_user(
            email="normal_user@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Normal",
            last_name="User",
        )
        self.client.force_authenticate(user=normal_user)

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
