from django.contrib.contenttypes.models import ContentType

from apps.auth.models.audit import AuditLog
from apps.guios.models import Dimension, Factor, Subfactor

from .admin_base import ADMIN, AdminApiTestBase


class CatalogPermissionTests(AdminApiTestBase):

    def test_anonymous_is_rejected(self):
        for url in (f'{ADMIN}/catalog/tree/', f'{ADMIN}/dimensions/', f'{ADMIN}/factors/', f'{ADMIN}/subfactors/'):
            with self.subTest(url=url):
                self.assertIn(self.client.get(url).status_code, (401, 403))

    def test_user_without_permission_gets_403(self):
        client = self.as_user(self.nobody)
        self.assertEqual(client.get(f'{ADMIN}/catalog/tree/').status_code, 403)
        self.assertEqual(client.get(f'{ADMIN}/factors/').status_code, 403)
        self.assertEqual(client.post(f'{ADMIN}/dimensions/', {'name': 'X'}, format='json').status_code, 403)

    def test_viewer_can_read_but_not_write(self):
        client = self.as_user(self.viewer)
        self.assertEqual(client.get(f'{ADMIN}/catalog/tree/').status_code, 200)
        self.assertEqual(client.get(f'{ADMIN}/factors/{self.factor("TEC-USA").pk}/').status_code, 200)
        self.assertEqual(client.post(f'{ADMIN}/dimensions/', {'name': 'Legal'}, format='json').status_code, 403)
        self.assertEqual(client.patch(f'{ADMIN}/factors/{self.factor("TEC-USA").pk}/', {'name': 'X'}, format='json').status_code, 403)
        self.assertEqual(client.delete(f'{ADMIN}/subfactors/{self.subfactor("TEC-USA-01").pk}/').status_code, 403)

    def test_superuser_can_do_everything(self):
        client = self.as_user(self.superuser)
        response = client.post(f'{ADMIN}/dimensions/', {'name': 'Legal', 'order': 4}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(client.delete(f'{ADMIN}/dimensions/{response.data["id"]}/').status_code, 204)

    def test_tree_includes_inactive_and_counts(self):
        Factor.objects.filter(code='TEC-PRU').update(is_active=False)
        self.make_evaluation(close=False, fill=False)
        data = self.as_user(self.viewer).get(f'{ADMIN}/catalog/tree/').data
        self.assertEqual([d['code'] for d in data], ['TEC', 'ORG', 'ECO'])
        factors = {f['code']: f for d in data for f in d['factors']}
        self.assertEqual(len(factors), 18)
        self.assertFalse(factors['TEC-PRU']['is_active'])
        self.assertEqual(factors['TEC-COM']['subfactors_count'], 8)
        self.assertEqual(factors['TEC-COM']['evaluations_count'], 1)
        self.assertFalse(factors['TEC-COM']['can_delete'])
        self.assertTrue(factors['ORG-SOP']['scope_configurable'])
        self.assertEqual(sum(len(f['subfactors']) for f in factors.values()), 61)


class CatalogRuleTests(AdminApiTestBase):

    def setUp(self):
        super().setUp()
        self.client_ = self.as_user(self.editor)

    def create_custom_factor(self, **extra):
        payload = {'dimension': Dimension.objects.get(code='TEC').pk, 'name': 'Accesibilidad',
                   'suggested_importance': 3, 'scope': 'external', **extra}
        response = self.client_.post(f'{ADMIN}/factors/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    # Regla 1: RN-07 / PROTECT
    def test_cannot_delete_dimension_with_factors(self):
        dimension = Dimension.objects.create(name='Legal')
        Factor.objects.create(dimension=dimension, name='Licencias', suggested_importance=2, scope='internal')
        response = self.client_.delete(f'{ADMIN}/dimensions/{dimension.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'catalog_conflict')
        self.assertTrue(Dimension.objects.filter(pk=dimension.pk).exists())

    def test_cannot_delete_factor_with_subfactors_or_evaluations(self):
        factor = self.create_custom_factor()
        subfactor = self.client_.post(f'{ADMIN}/subfactors/', {'factor': factor['id'], 'description': 'Cumple WCAG 2.1'}, format='json').data
        self.assertEqual(self.client_.delete(f'{ADMIN}/factors/{factor["id"]}/').status_code, 409)

        self.client_.patch(f'{ADMIN}/factors/{factor["id"]}/', {'is_active': True}, format='json')
        self.make_evaluation(fill=False, close=False)       # copia el factor ya activo
        self.client_.patch(f'{ADMIN}/factors/{factor["id"]}/', {'is_active': False}, format='json')
        self.assertEqual(self.client_.delete(f'{ADMIN}/subfactors/{subfactor["id"]}/').status_code, 409)
        Subfactor.objects.filter(pk=subfactor['id']).update(factor=self.factor('TEC-USA'))  # sin subfactores
        response = self.client_.delete(f'{ADMIN}/factors/{factor["id"]}/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('evaluaciones', response.data['detail'])

    def test_unused_custom_items_can_be_deleted(self):
        factor = self.create_custom_factor()
        subfactor = self.client_.post(f'{ADMIN}/subfactors/', {'factor': factor['id'], 'description': 'X'}, format='json').data
        self.assertEqual(self.client_.delete(f'{ADMIN}/subfactors/{subfactor["id"]}/').status_code, 204)
        self.assertEqual(self.client_.delete(f'{ADMIN}/factors/{factor["id"]}/').status_code, 204)

    # Regla 2: catálogo base
    def test_base_items_cannot_be_deleted(self):
        for url in (f'{ADMIN}/dimensions/{Dimension.objects.get(code="ECO").pk}/',
                    f'{ADMIN}/factors/{self.factor("ECO-TCO").pk}/',
                    f'{ADMIN}/subfactors/{self.subfactor("TEC-COM-01").pk}/'):
            with self.subTest(url=url):
                self.assertEqual(self.client_.delete(url).status_code, 409)
        self.assertEqual(Subfactor.objects.count(), 61)

    def test_base_factor_importance_and_scope_are_read_only(self):
        url = f'{ADMIN}/factors/{self.factor("TEC-USA").pk}/'
        for change in ({'suggested_importance': 3}, {'scope': 'internal'}):
            with self.subTest(change=change):
                response = self.client_.patch(url, change, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data['code'], 'catalog_rule')
        response = self.client_.patch(url, {'name': 'Usabilidad (UX)', 'description': 'Facilidad de uso', 'code': 'X'}, format='json')
        self.assertEqual(response.status_code, 200)
        factor = self.factor('TEC-USA')
        self.assertEqual((factor.name, factor.code, factor.suggested_importance), ('Usabilidad (UX)', 'TEC-USA', 2))
        self.assertEqual(self.client_.patch(url, {'suggested_importance': 2}, format='json').status_code, 200)

    # Regla 3: scope_configurable se deduce
    def test_scope_configurable_is_derived_from_scope(self):
        factor = self.create_custom_factor(scope='both', scope_configurable=False)
        self.assertTrue(factor['scope_configurable'])
        response = self.client_.patch(f'{ADMIN}/factors/{factor["id"]}/', {'scope': 'internal'}, format='json')
        self.assertFalse(response.data['scope_configurable'])

    # Regla 4: factor activo con subfactores activos
    def test_new_factor_starts_inactive_and_needs_an_active_subfactor(self):
        factor = self.create_custom_factor(is_active=True)
        self.assertFalse(factor['is_active'])
        url = f'{ADMIN}/factors/{factor["id"]}/'
        response = self.client_.patch(url, {'is_active': True}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['field'], 'is_active')

        self.client_.post(f'{ADMIN}/subfactors/', {'factor': factor['id'], 'description': 'Cumple WCAG 2.1'}, format='json')
        response = self.client_.patch(url, {'is_active': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_active'])

    def test_cannot_remove_last_active_subfactor_of_active_factor(self):
        support_test = self.factor('TEC-PRU')                # factor base con 1 subfactor
        only = support_test.subfactors.get()
        url = f'{ADMIN}/subfactors/{only.pk}/'
        self.assertEqual(self.client_.patch(url, {'is_active': False}, format='json').status_code, 400)

        custom = self.create_custom_factor()
        sub = self.client_.post(f'{ADMIN}/subfactors/', {'factor': custom['id'], 'description': 'Único'}, format='json').data
        self.client_.patch(f'{ADMIN}/factors/{custom["id"]}/', {'is_active': True}, format='json')
        self.assertEqual(self.client_.delete(f'{ADMIN}/subfactors/{sub["id"]}/').status_code, 400)
        # Moverlo a otro factor también lo dejaría sin subfactores activos.
        response = self.client_.patch(f'{ADMIN}/subfactors/{sub["id"]}/', {'factor': self.factor('TEC-USA').pk}, format='json')
        self.assertEqual(response.status_code, 400)

        # Con el factor desactivado, sí se puede.
        self.client_.patch(f'{ADMIN}/factors/{custom["id"]}/', {'is_active': False}, format='json')
        self.assertEqual(self.client_.patch(f'{ADMIN}/subfactors/{sub["id"]}/', {'is_active': False}, format='json').status_code, 200)

    # Regla 5: mover un subfactor con evaluaciones
    def test_cannot_move_subfactor_with_evaluations(self):
        self.make_evaluation(fill=False, close=False)
        subfactor = self.subfactor('TEC-COM-01')
        response = self.client_.patch(f'{ADMIN}/subfactors/{subfactor.pk}/', {'factor': self.factor('TEC-USA').pk}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['field'], 'factor')
        self.assertEqual(self.subfactor('TEC-COM-01').factor.code, 'TEC-COM')

    def test_moving_unused_subfactor_is_allowed(self):
        custom = self.create_custom_factor()
        sub = self.client_.post(f'{ADMIN}/subfactors/', {'factor': self.factor('TEC-COM').pk, 'description': 'Nuevo'}, format='json').data
        response = self.client_.patch(f'{ADMIN}/subfactors/{sub["id"]}/', {'factor': custom['id']}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_validation_ranges(self):
        response = self.client_.post(f'{ADMIN}/factors/', {
            'dimension': Dimension.objects.get(code='TEC').pk, 'name': 'X', 'suggested_importance': 5, 'scope': 'internal',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('suggested_importance', response.data)

    # Regla 6: texto plano
    def test_plain_text_fields(self):
        dimension = self.client_.post(f'{ADMIN}/dimensions/', {'name': 'B&R Legal', 'description': 'a < b <script>alert(1)</script>'}, format='json').data
        stored = Dimension.objects.get(pk=dimension['id'])
        self.assertEqual(stored.name, 'B&R Legal')
        self.assertTrue(stored.description.startswith('a < b'))
        self.assertNotIn('<script', stored.description)

    def test_crud_is_audited_with_user(self):
        before = AuditLog.objects.count()
        dimension = self.client_.post(f'{ADMIN}/dimensions/', {'name': 'Legal'}, format='json').data
        self.client_.patch(f'{ADMIN}/dimensions/{dimension["id"]}/', {'name': 'Legal y normativa'}, format='json')
        self.client_.delete(f'{ADMIN}/dimensions/{dimension["id"]}/')
        logs = AuditLog.objects.filter(
            content_type=ContentType.objects.get_for_model(Dimension), object_id=str(dimension['id']),
        ).order_by('pk')
        self.assertEqual([log.action for log in logs], ['CREATE', 'UPDATE', 'DELETE'])
        self.assertTrue(all(log.user == self.editor for log in logs))
        self.assertEqual(AuditLog.objects.count(), before + 3)


class PublicCatalogTests(AdminApiTestBase):
    """Ajuste del Paso 7: el catálogo público no muestra dimensiones vacías."""

    def test_public_catalog_hides_dimensions_without_valid_factors(self):
        Dimension.objects.create(name='Legal', order=4)                                    # sin factores
        empty = Dimension.objects.create(name='Social', order=5)
        Factor.objects.create(dimension=empty, name='Comunidad', suggested_importance=2,
                              scope='external', is_active=True)                             # activo sin subfactores
        inactive = Dimension.objects.create(name='Ambiental', order=6)
        f = Factor.objects.create(dimension=inactive, name='Consumo', suggested_importance=2,
                                  scope='external', is_active=False)
        Subfactor.objects.create(factor=f, description='Bajo consumo')                      # factor inactivo
        Factor.objects.filter(code='ECO-TCO').update(is_active=False)                       # ECO queda vacía

        data = self.client.get('/api/v1/guios/public/catalog/').data
        self.assertEqual([d['name'] for d in data['dimensions']], ['Tecnológica', 'Organizacional'])
        self.assertTrue(all(d['factors'] for d in data['dimensions']))
