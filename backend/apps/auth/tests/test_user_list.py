from django.contrib.auth.models import Group
from rest_framework.test import APITestCase

from apps.auth.models.user import CustomUser


class UserGroupNamesTests(APITestCase):
    """La columna "Roles" del panel lee groups_names del listado (el detalle trae groups con id y nombre)."""

    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            email='admin@example.com', username='admin', password='Clave-segura-123',
        )
        self.client.force_authenticate(user=self.admin)
        self.user = CustomUser.objects.create_user(email='ana@example.com', username='ana', password='Clave-segura-123')
        self.user.groups.add(Group.objects.create(name='Lector GUIOS'), Group.objects.create(name='Editor'))

    def test_list_returns_group_names(self):
        response = self.client.get('/api/v1/users/', {'search': 'ana@'})
        self.assertEqual(response.status_code, 200)
        row = response.json()['results'][0]
        self.assertEqual(sorted(row['groups_names']), ['Editor', 'Lector GUIOS'])
        self.assertEqual(len(row['groups']), 2)

    def test_detail_returns_groups_with_names(self):
        response = self.client.get(f'/api/v1/users/{self.user.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('groups_names', response.json())
        self.assertEqual(sorted(g['name'] for g in response.json()['groups']), ['Editor', 'Lector GUIOS'])

    def test_user_without_groups_returns_empty_list(self):
        response = self.client.get('/api/v1/users/', {'search': 'admin@'})
        self.assertEqual(response.json()['results'][0]['groups_names'], [])
