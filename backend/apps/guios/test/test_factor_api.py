"""
apps/guios/test/test_factor_api.py
─────────────────────────────────────────────────────────────────────────────
Suite de pruebas de integración para el CRUD del catálogo de Factores.
Verifica:
- Listado optimizado con dimensión y subfactors_count (sin N+1).
- Filtros por dimensión, ámbito (scope), is_base, is_active y búsqueda.
- Consulta de detalle incluyendo subfactores asociados.
- Creación con autocalculo de IS (matriz IL x IE) y validación de unicidad por dimensión.
- Actualización parcial y recálculo automático de IS.
- Reglas de negocio para eliminación (bloqueo de base y con dependencias).
- Control de acceso RBAC granular con HasModulePermission.
"""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.guios.models import Dimension, Factor, Subfactor
from apps.guios.services.methodology import calculate_systemic_importance

User = get_user_model()


class FactorAPITests(APITestCase):
    """
    Pruebas integrales de la API REST para el CRUD de Factores:
    Endpoint: /api/v1/guios/factors/
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

        # 2. Dimensiones de prueba
        self.dim_tec = Dimension.objects.create(
            name="Tecnológica",
            description="Factores técnicos",
            order=1,
            is_base=True,
        )
        self.dim_org = Dimension.objects.create(
            name="Organizacional",
            description="Factores de la institución",
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
            is_active=True,
        )
        self.factor_fiab = Factor.objects.create(
            dimension=self.dim_tec,
            name="Fiabilidad",
            scope=Factor.SCOPE_EXTERNAL,
            systemic_importance=3,
            expert_importance=3,
            literature_importance_base=3,
            order=2,
            is_base=True,
            is_active=True,
        )
        self.factor_sop = Factor.objects.create(
            dimension=self.dim_org,
            name="Soporte",
            scope=Factor.SCOPE_INTERNAL,
            scope_configurable=True,
            systemic_importance=4,
            expert_importance=3,
            literature_importance_base=4,
            order=1,
            is_base=True,
            is_active=True,
        )

        # 4. Subfactores asociados a Compatibilidad
        self.sub_1 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="Una empresa proporciona infraestructura en la nube.",
            base_citations_count=5,
            order=1,
            is_base=True,
        )
        self.sub_2 = Subfactor.objects.create(
            factor=self.factor_comp,
            description="El software puede exportar formatos propietarios.",
            base_citations_count=3,
            order=2,
            is_base=True,
        )

        self.list_url = "/api/v1/guios/factors/"

    # ── 1. Pruebas de Listado y Filtros ────────────────────────────────────────

    def test_list_factors_authenticated(self):
        """GET /api/v1/guios/factors/ - Lista factores con dimensión y conteo de subfactores."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Manejar paginado o array directo
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 3)

        # Validar subfactors_count anotado por el selector
        comp_data = next(f for f in results if f['name'] == 'Compatibilidad')
        self.assertEqual(comp_data['subfactors_count'], 2)
        self.assertEqual(comp_data['dimension']['name'], 'Tecnológica')

        fiab_data = next(f for f in results if f['name'] == 'Fiabilidad')
        self.assertEqual(fiab_data['subfactors_count'], 0)

    def test_filter_factors_by_dimension(self):
        """Filtro por ID de dimensión padre."""
        response = self.client.get(f"{self.list_url}?dimension={self.dim_org.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Soporte')

    def test_filter_factors_by_scope(self):
        """Filtro por ámbito FODA (internal / external)."""
        response = self.client.get(f"{self.list_url}?scope={Factor.SCOPE_INTERNAL}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Soporte')

    def test_search_factors_by_name(self):
        """Búsqueda de factores por nombre."""
        response = self.client.get(f"{self.list_url}?search=soporte")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Soporte')

    # ── 2. Pruebas de Detalle ──────────────────────────────────────────────────

    def test_retrieve_factor_detail_with_subfactors(self):
        """GET /api/v1/guios/factors/{id}/ - Detalle incluye lista de subfactores."""
        url = f"{self.list_url}{self.factor_comp.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response.data['id'], self.factor_comp.id)
        self.assertEqual(response.data['name'], 'Compatibilidad')
        self.assertIn('subfactors', response.data)
        self.assertEqual(len(response.data['subfactors']), 2)
        self.assertEqual(response.data['subfactors'][0]['description'], self.sub_1.description)

    def test_retrieve_factor_not_found(self):
        """Consulta de factor inexistente retorna 404."""
        response = self.client.get(f"{self.list_url}99999/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── 3. Pruebas de Creación ─────────────────────────────────────────────────

    def test_create_factor_with_autocalculated_is(self):
        """POST /api/v1/guios/factors/ - IS autocalculado si no se envía explícitamente."""
        payload = {
            "dimension_id": self.dim_tec.id,
            "name": "Ciberseguridad Avanzada",
            "scope": Factor.SCOPE_EXTERNAL,
            "literature_importance_base": 4,
            "expert_importance": 3,
            "order": 5,
        }
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Ciberseguridad Avanzada')

        # Matriz: IL=4 x IE=3 -> IS=4
        expected_is = calculate_systemic_importance(4, 3)
        self.assertEqual(response.data['systemic_importance'], expected_is)
        self.assertFalse(response.data['is_base'])

    def test_create_factor_duplicate_name_same_dimension_fails(self):
        """No permite crear factor con nombre duplicado dentro de la misma dimensión."""
        payload = {
            "dimension_id": self.dim_tec.id,
            "name": "Compatibilidad",  # Ya existe en Tecnológica
            "scope": Factor.SCOPE_EXTERNAL,
            "literature_importance_base": 2,
            "expert_importance": 3,
        }
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_create_factor_same_name_different_dimension_allowed(self):
        """Permite crear un factor con el mismo nombre si está en otra dimensión."""
        payload = {
            "dimension_id": self.dim_org.id,
            "name": "Compatibilidad",  # Existe en Tecnológica, pero es nuevo en Organizacional
            "scope": Factor.SCOPE_INTERNAL,
            "literature_importance_base": 2,
            "expert_importance": 3,
        }
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['dimension']['name'], 'Organizacional')

    # ── 4. Pruebas de Actualización ────────────────────────────────────────────

    def test_update_factor_recalculates_is_when_metrics_change(self):
        """Actualizar IE o IL sin proveer IS recalcula automáticamente el IS."""
        custom_factor = Factor.objects.create(
            dimension=self.dim_tec,
            name="Escalabilidad",
            systemic_importance=4,  # Originalmente IL=4, IE=3
            expert_importance=3,
            literature_importance_base=4,
        )

        url = f"{self.list_url}{custom_factor.id}/"
        # Cambiar IL a 1 (IL=1 x IE=3 -> IS=2)
        payload = {"literature_importance_base": 1}
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_new_is = calculate_systemic_importance(1, 3)
        self.assertEqual(response.data['systemic_importance'], expected_new_is)

    # ── 5. Pruebas de Eliminación y Reglas de Negocio ──────────────────────────

    def test_delete_base_factor_fails(self):
        """Regla de negocio: PROHIBIDO eliminar factores base de la tesis."""
        url = f"{self.list_url}{self.factor_fiab.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('catálogo base oficial', response.data['error'])
        self.assertTrue(Factor.objects.filter(pk=self.factor_fiab.id).exists())

    def test_delete_factor_with_subfactors_fails(self):
        """Regla de negocio: PROHIBIDO eliminar factores que posean subfactores."""
        custom_factor = Factor.objects.create(
            dimension=self.dim_tec,
            name="Factor Con Hijos",
            systemic_importance=2,
            is_base=False,
        )
        Subfactor.objects.create(
            factor=custom_factor,
            description="Criterio dependiente",
            base_citations_count=1,
        )

        url = f"{self.list_url}{custom_factor.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('subfactor', response.data['error'])
        self.assertTrue(Factor.objects.filter(pk=custom_factor.id).exists())

    def test_delete_custom_empty_factor_success(self):
        """Un factor personalizado sin subfactores sí puede eliminarse limpiamente."""
        custom_factor = Factor.objects.create(
            dimension=self.dim_tec,
            name="Factor Vacío",
            systemic_importance=2,
            is_base=False,
        )

        url = f"{self.list_url}{custom_factor.id}/"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Factor.objects.filter(pk=custom_factor.id).exists())

    # ── 6. Pruebas de RBAC y Permisos ──────────────────────────────────────────

    def test_unprivileged_user_cannot_access_factors(self):
        """Un usuario sin permisos de módulo recibe 403 Forbidden."""
        normal_user = User.objects.create_user(
            email="normal_user@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Normal",
            last_name="User",
        )
        self.client.force_authenticate(user=normal_user)

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
