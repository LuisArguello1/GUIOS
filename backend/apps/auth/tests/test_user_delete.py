"""
Respuestas de los borrados del panel: 200 con JSON o 204 sin cuerpo, nunca un
204 con cuerpo (el navegador lo trataba como error aunque el borrado se hiciera).
"""
from io import StringIO

from django.contrib.auth.models import Group
from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from rest_framework.test import APITestCase

from apps.auth.models.audit import AuditLog
from apps.auth.models.totp import TOTPDevice
from apps.auth.models.user import CustomUser
from apps.guios.models import Dimension, Evaluation, Factor


class DeleteResponsesTests(APITestCase):

    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            email='admin@example.com', username='admin', password='Clave-segura-123',
        )
        self.client.force_authenticate(user=self.admin)

    def make_user(self, name):
        return CustomUser.objects.create_user(email=f'{name}@example.com', username=name, password='Clave-segura-123')

    def test_hard_delete_returns_200_with_json(self):
        user = self.make_user('sin-datos')
        response = self.client.delete(f'/api/v1/users/{user.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertEqual(response.json()['action'], 'HARD_DELETE')
        self.assertTrue(response.json()['message'])
        self.assertFalse(CustomUser.objects.filter(pk=user.pk).exists())

    def test_soft_delete_returns_200_with_json(self):
        user = self.make_user('con-datos')
        Evaluation.objects.create(software_name='X', org_name='Y', created_by=user)
        response = self.client.delete(f'/api/v1/users/{user.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['action'], 'SOFT_DELETE')
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_other_deletes_return_204_without_body(self):
        call_command('seed_guios_catalog', stdout=StringIO())
        group = Group.objects.create(name='Rol temporal')
        dimension = Dimension.objects.create(name='Legal', order=9)
        for url in (f'/api/v1/core/groups/{group.pk}/', f'/api/v1/guios/admin/dimensions/{dimension.pk}/'):
            with self.subTest(url=url):
                response = self.client.delete(url)
                self.assertEqual(response.status_code, 204)
                self.assertEqual(response.content, b'')


class DeleteImpactTests(APITestCase):
    """
    Regla de borrado (decisión del equipo): si el usuario tiene registros como
    autor (auditoría, evaluaciones creadas u otros), se desactiva; si no, se
    borra. El 2FA, los códigos de recuperación y los grupos se borran con él.
    """

    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            email='admin@example.com', username='admin', password='Clave-segura-123',
        )
        self.client.force_authenticate(user=self.admin)
        self.user = CustomUser.objects.create_user(email='nuevo@example.com', username='nuevo', password='Clave-segura-123')

    def log(self, actor, model, action='UPDATE', object_id='1', **extra):
        return AuditLog.objects.create(
            action=action, content_type=ContentType.objects.get_for_model(model),
            object_id=object_id, user=actor, **extra,
        )

    def impact(self, user=None):
        response = self.client.get(f'/api/v1/users/{(user or self.user).pk}/delete-impact/')
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_user_as_object_of_audit_does_not_block_hard_delete(self):
        # "Usuario creado por admin": el autor es el admin, no el usuario nuevo.
        self.log(self.admin, CustomUser, action='CREATE', object_id=str(self.user.pk))
        self.assertEqual(self.impact(), {'action': 'HARD_DELETE', 'total': 0, 'items': [], 'summary': ''})
        response = self.client.delete(f'/api/v1/users/{self.user.pk}/')
        self.assertEqual(response.json()['action'], 'HARD_DELETE')
        self.assertFalse(CustomUser.objects.filter(pk=self.user.pk).exists())

    def test_two_factor_and_groups_are_deleted_with_the_user(self):
        self.user.groups.add(Group.objects.create(name='Lector'))
        TOTPDevice.objects.create(user=self.user, secret='JBSWY3DPEHPK3PXP')
        self.assertEqual(self.impact()['action'], 'HARD_DELETE')
        self.assertEqual(self.client.delete(f'/api/v1/users/{self.user.pk}/').json()['action'], 'HARD_DELETE')
        self.assertFalse(TOTPDevice.objects.filter(user_id=self.user.pk).exists())

    def test_authored_records_are_counted_by_category_and_deactivate(self):
        for _ in range(3):
            self.log(self.user, Factor)
        self.log(self.user, Evaluation, action='EXPORT')
        self.log(self.user, CustomUser)
        self.log(self.admin, CustomUser, impersonated_by=self.user)
        Evaluation.objects.create(software_name='X', org_name='Y', created_by=self.user)

        data = self.impact()
        self.assertEqual(data['action'], 'SOFT_DELETE')
        self.assertEqual(data['total'], 7)
        self.assertEqual(
            [(item['key'], item['count']) for item in data['items']],
            [('audit_catalog', 3), ('audit_evaluations', 1), ('evaluations_created', 1), ('audit_other', 2)],
        )
        self.assertEqual(
            data['summary'],
            '3 cambios en el catálogo GUIOS, 1 acción en evaluaciones, 1 evaluación creada, 2 registros de auditoría',
        )
        response = self.client.delete(f'/api/v1/users/{self.user.pk}/')
        self.assertEqual(response.json()['action'], 'SOFT_DELETE')
        self.assertIn(data['summary'], response.json()['message'])
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_impact_requires_the_delete_permission(self):
        viewer = CustomUser.objects.create_user(email='viewer@example.com', username='viewer', password='Clave-segura-123')
        self.client.force_authenticate(user=viewer)
        self.assertEqual(self.client.get(f'/api/v1/users/{self.user.pk}/delete-impact/').status_code, 403)
