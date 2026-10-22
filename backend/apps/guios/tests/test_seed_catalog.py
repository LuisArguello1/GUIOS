import copy
import json
import shutil
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.guios.management.commands.seed_guios_catalog import DEFAULT_CATALOG_PATH
from apps.guios.models import Dimension, Factor, Subfactor


def run_seed(*args):
    out = StringIO()
    call_command('seed_guios_catalog', *args, stdout=out)
    return out.getvalue()


class SeedCatalogTests(TestCase):
    """Paso 3: carga del catálogo base desde docs/catalogo_guios.json."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tmpdir = Path(tempfile.mkdtemp())
        with DEFAULT_CATALOG_PATH.open(encoding='utf-8') as handle:
            cls.catalog = json.load(handle)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmpdir, ignore_errors=True)
        super().tearDownClass()

    def write_catalog(self, catalog, name='catalogo.json'):
        path = self.tmpdir / name
        path.write_text(json.dumps(catalog, ensure_ascii=False), encoding='utf-8')
        return str(path)

    def assert_catalog_empty(self):
        self.assertEqual(Dimension.objects.count(), 0)
        self.assertEqual(Factor.objects.count(), 0)
        self.assertEqual(Subfactor.objects.count(), 0)

    def test_full_load(self):
        run_seed()
        self.assertEqual(Dimension.objects.count(), 3)
        self.assertEqual(Factor.objects.count(), 18)
        self.assertEqual(Subfactor.objects.count(), 61)
        self.assertFalse(Dimension.objects.filter(is_base=False).exists())
        self.assertFalse(Factor.objects.filter(is_base=False).exists())
        self.assertFalse(Subfactor.objects.filter(is_base=False).exists())
        counts = {d.code: Subfactor.objects.filter(factor__dimension=d).count() for d in Dimension.objects.all()}
        self.assertEqual(counts, {'TEC': 40, 'ORG': 19, 'ECO': 2})

    def test_second_run_does_not_duplicate(self):
        run_seed()
        output = run_seed()
        self.assertEqual(Dimension.objects.count(), 3)
        self.assertEqual(Factor.objects.count(), 18)
        self.assertEqual(Subfactor.objects.count(), 61)
        self.assertIn("Creados:       0", output)
        self.assertIn("Actualizados:  0", output)
        self.assertNotIn("Registros base actualizados", output)

    def test_key_factors(self):
        run_seed()
        usability = Factor.objects.get(code='TEC-USA')
        self.assertEqual(usability.name, 'Usabilidad')
        self.assertEqual(usability.suggested_importance, 2)

        management = Factor.objects.get(code='ORG-APO')
        self.assertEqual(management.name, 'Apoyo de la alta dirección')
        self.assertEqual(management.suggested_importance, 3)
        self.assertEqual(management.scope, Factor.SCOPE_INTERNAL)

        support = Factor.objects.get(code='ORG-SOP')
        self.assertEqual(support.name, 'Soporte')
        self.assertEqual(support.scope, Factor.SCOPE_BOTH)
        self.assertTrue(support.scope_configurable)
        self.assertEqual(list(Factor.objects.filter(scope_configurable=True)), [support])

        self.assertEqual(Factor.objects.get(code='TEC-COM').scope, Factor.SCOPE_EXTERNAL)
        self.assertTrue(usability.description)

    def test_subfactor_moved_to_attitude_towards_change(self):
        run_seed()
        moved = Subfactor.objects.get(code='ORG-ACT-02')
        self.assertEqual(moved.factor.name, 'Actitud hacia el cambio')
        self.assertTrue(moved.description.startswith("El personal técnico encargado del despliegue"))
        self.assertFalse(moved.description.endswith('.'))
        self.assertEqual(Subfactor.objects.filter(factor__code='ORG-ACT').count(), 2)
        self.assertEqual(Subfactor.objects.filter(factor__code='ORG-APO').count(), 1)

    def test_uses_texto_mostrar(self):
        run_seed()
        subfactor = Subfactor.objects.get(code='ECO-TCO-02')
        self.assertEqual(subfactor.description, "La adopción de este software es menos costosa que la alternativa propietaria")

    def test_dry_run_saves_nothing(self):
        output = run_seed('--dry-run')
        self.assert_catalog_empty()
        self.assertIn("CREARÍA", output)
        self.assertIn("Creados:       82", output)

    def test_dry_run_reports_updates_without_saving(self):
        run_seed()
        Factor.objects.filter(code='TEC-USA').update(suggested_importance=4)
        output = run_seed('--dry-run')
        self.assertIn("ACTUALIZARÍA: TEC-USA", output)
        self.assertEqual(Factor.objects.get(code='TEC-USA').suggested_importance, 4)

    def test_run_lists_updated_base_records(self):
        run_seed()
        Factor.objects.filter(code='TEC-USA').update(name='Usabilidad (editado)', suggested_importance=4)
        output = run_seed()
        usability = Factor.objects.get(code='TEC-USA')
        self.assertEqual(usability.name, 'Usabilidad')
        self.assertEqual(usability.suggested_importance, 2)
        self.assertIn("Registros base actualizados", output)
        self.assertIn("Factor TEC-USA", output)
        self.assertIn("suggested_importance: 4 → 2", output)
        self.assertIn("Actualizados:  1", output)

    def test_json_change_updates_without_duplicating(self):
        run_seed()
        catalog = copy.deepcopy(self.catalog)
        catalog['dimensiones'][0]['factores'][0]['subfactores'][0]['texto_mostrar'] = "Texto corregido"
        run_seed('--file', self.write_catalog(catalog))
        self.assertEqual(Subfactor.objects.count(), 61)
        self.assertEqual(Subfactor.objects.get(code='TEC-COM-01').description, "Texto corregido")

    def test_does_not_touch_records_without_code_or_is_active(self):
        run_seed()
        Factor.objects.filter(code='TEC-PRU').update(is_active=False)
        custom = Factor.objects.create(
            dimension=Dimension.objects.get(code='TEC'),
            name="Factor propio",
            suggested_importance=1,
        )
        run_seed()
        self.assertFalse(Factor.objects.get(code='TEC-PRU').is_active)
        custom.refresh_from_db()
        self.assertEqual(custom.name, "Factor propio")
        self.assertFalse(custom.is_base)

    def test_wrong_subfactor_count_fails_without_saving(self):
        catalog = copy.deepcopy(self.catalog)
        catalog['dimensiones'][0]['factores'][0]['subfactores'].pop()
        with self.assertRaisesMessage(CommandError, "60 subfactores (se esperaban 61)"):
            run_seed('--file', self.write_catalog(catalog))
        self.assert_catalog_empty()

    def test_invalid_importance_fails_without_saving(self):
        catalog = copy.deepcopy(self.catalog)
        catalog['dimensiones'][0]['factores'][0]['is'] = 5
        with self.assertRaisesMessage(CommandError, "fuera del rango 1-4"):
            run_seed('--file', self.write_catalog(catalog))
        self.assert_catalog_empty()

    def test_duplicate_code_fails_without_saving(self):
        catalog = copy.deepcopy(self.catalog)
        subfactors = catalog['dimensiones'][0]['factores'][0]['subfactores']
        subfactors[1]['codigo'] = subfactors[0]['codigo']
        with self.assertRaisesMessage(CommandError, "código duplicado"):
            run_seed('--file', self.write_catalog(catalog))
        self.assert_catalog_empty()

    def test_database_error_rolls_back_everything(self):
        # Una dimensión sin código con el mismo nombre choca con la restricción
        # unique de name al crear la tercera dimensión: nada debe quedar guardado.
        Dimension.objects.create(name='Económica')
        with self.assertRaises(CommandError):
            run_seed()
        self.assertEqual(Dimension.objects.count(), 1)
        self.assertEqual(Factor.objects.count(), 0)
        self.assertEqual(Subfactor.objects.count(), 0)
