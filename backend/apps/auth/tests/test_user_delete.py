"""
Respuestas de los borrados del panel: 200 con JSON o 204 sin cuerpo, nunca un
204 con cuerpo (el navegador lo trataba como error aunque el borrado se hiciera).
"""
from io import StringIO

from django.contrib.auth.models import Group
from django.core.management import call_command
from rest_framework.test import APITestCase

from apps.auth.models.user import CustomUser
from apps.guios.models import Dimension, Evaluation


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
