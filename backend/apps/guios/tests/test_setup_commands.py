from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.core.models.menuModule import MenuModule
from apps.core.models.modulePermission import ModulePermission

GUIOS_PERMISSIONS = {
    'catalog.view', 'catalog.create', 'catalog.edit', 'catalog.delete',
    'evaluations.view', 'evaluations.export',
}


class SetupCommandsTests(TestCase):

    def run_commands(self):
        out = StringIO()
        call_command('setup_menus', stdout=out)
        call_command('setup_permissions', stdout=out)

    def test_guios_modules_and_permissions_are_registered_once(self):
        self.run_commands()
        self.run_commands()
        modules = MenuModule.objects.filter(path__in=['/dashboard/catalogo', '/dashboard/evaluaciones'])
        self.assertEqual({m.label for m in modules}, {'Catálogo', 'Evaluaciones'})
        self.assertEqual({m.group.name for m in modules}, {'GUIOS'})
        self.assertEqual(MenuModule.objects.filter(path='/dashboard/catalogo').count(), 1)
        codenames = set(ModulePermission.objects.values_list('codename', flat=True))
        self.assertTrue(GUIOS_PERMISSIONS <= codenames)
        self.assertEqual(ModulePermission.objects.filter(codename__in=GUIOS_PERMISSIONS).count(), 6)
        self.assertEqual(ModulePermission.objects.get(codename='catalog.delete').module.path, '/dashboard/catalogo')
        self.assertIn('dashboard.view', codenames)
