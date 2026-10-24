from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.guios.models import Dimension, Factor

User = get_user_model()


class DimensionAPITests(APITestCase):
    """
    Pruebas integrales de la API REST para el CRUD de Dimensiones:
    - Listado optimizado con anotaciones
    - Detalle con factores asociados
    - Creación con validación de unicidad
    - Actualización parcial y total
    - Eliminación con validación de reglas de negocio (is_base y dependencias)
    """

    def setUp(self):
        # 1. Crear usuario administrador (superuser bypass para pruebas del CRUD)
        self.user = User.objects.create_superuser(
            email="admin_guios@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Admin",
            last_name="GUIOS",
        )
        self.client.force_authenticate(user=self.user)

        # 2. Crear dimensiones de prueba
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

        # 3. Crear factores asociados a la dimensión tecnológica
        self.factor_comp = Factor.objects.create(
            dimension=self.dim_tec,
            name="Compatibilidad",
            scope=Factor.SCOPE_EXTERNAL,
            systemic_importance=3,
            expert_importance=3,
            literature_importance_base=3,
            order=1,
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
            is_active=True,
        )

        self.list_url = "/api/v1/guios/dimensions/"

    def test_list_dimensions_authenticated(self):
        """GET /api/v1/guios/dimensions/ - Lista dimensiones con factors_count."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data.get('results', response.data)
        self.assertEqual(len(data), 2)

        # Verificar anotación de factors_count
        dim_tec_data = next(d for d in data if d['id'] == self.dim_tec.id)
        self.assertEqual(dim_tec_data['name'], "Tecnológica")
        self.assertEqual(dim_tec_data['factors_count'], 2)

        dim_org_data = next(d for d in data if d['id'] == self.dim_org.id)
        self.assertEqual(dim_org_data['factors_count'], 0)

    def test_list_dimensions_unauthenticated(self):
        """Peticiones sin autenticación deben retornar 401 Unauthorized."""
        self.client.logout()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_dimensions_search_filter(self):
        """Búsqueda por nombre o descripción."""
        response = self.client.get(f"{self.list_url}?search=tecno")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data.get('results', response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], "Tecnológica")

    def test_retrieve_dimension_detail(self):
        """GET /api/v1/guios/dimensions/{id}/ - Detalle incluye lista de factores."""
        detail_url = f"{self.list_url}{self.dim_tec.id}/"
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response.data['id'], self.dim_tec.id)
        self.assertEqual(response.data['factors_count'], 2)
        self.assertEqual(len(response.data['factors']), 2)
        factor_names = [f['name'] for f in response.data['factors']]
        self.assertIn("Compatibilidad", factor_names)
        self.assertIn("Fiabilidad", factor_names)

    def test_retrieve_dimension_not_found(self):
        """Consulta de ID inexistente debe retornar 404."""
        response = self.client.get(f"{self.list_url}99999/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)

    def test_create_dimension_success(self):
        """POST /api/v1/guios/dimensions/ - Creación exitosa."""
        payload = {
            "name": "Estratégica",
            "description": "Factores de alineación estratégica",
            "order": 10,
        }
        response = self.client.post(self.list_url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], "Estratégica")
        self.assertFalse(response.data['is_base'])
        self.assertEqual(response.data['factors_count'], 0)

        # Verificar en base de datos
        self.assertTrue(Dimension.objects.filter(name="Estratégica").exists())

    def test_create_dimension_duplicate_name_fails(self):
        """No permite crear una dimensión con nombre ya existente."""
        payload = {
            "name": "tecnológica",  # case-insensitive
            "description": "Duplicado",
        }
        response = self.client.post(self.list_url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_update_dimension_success(self):
        """PATCH /api/v1/guios/dimensions/{id}/ - Actualización parcial."""
        detail_url = f"{self.list_url}{self.dim_org.id}/"
        payload = {
            "description": "Descripción actualizada de factores organizacionales",
            "order": 5,
        }
        response = self.client.patch(detail_url, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['description'], "Descripción actualizada de factores organizacionales")
        self.assertEqual(response.data['order'], 5)

    def test_delete_base_dimension_fails(self):
        """Regla de negocio: PROHIBIDO eliminar dimensiones base de la tesis."""
        detail_url = f"{self.list_url}{self.dim_tec.id}/"
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("catálogo base", response.data['error'])
        self.assertTrue(Dimension.objects.filter(pk=self.dim_tec.id).exists())

    def test_delete_dimension_with_factors_fails(self):
        """Regla de negocio: PROHIBIDO eliminar dimensiones con factores asociados."""
        # Crear dimensión custom pero con factor
        custom_dim = Dimension.objects.create(name="Custom Dim", is_base=False)
        Factor.objects.create(
            dimension=custom_dim,
            name="Factor Custom",
            systemic_importance=2,
            expert_importance=3,
            literature_importance_base=2,
        )

        detail_url = f"{self.list_url}{custom_dim.id}/"
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("factor", response.data['error'])
        self.assertTrue(Dimension.objects.filter(pk=custom_dim.id).exists())

    def test_delete_custom_empty_dimension_success(self):
        """Una dimensión custom sin factores sí puede eliminarse limpiamente."""
        custom_dim = Dimension.objects.create(name="Dimensión Temporal", is_base=False)
        detail_url = f"{self.list_url}{custom_dim.id}/"

        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Dimension.objects.filter(pk=custom_dim.id).exists())

    def test_unprivileged_user_cannot_access_dimensions(self):
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

