"""
management/commands/seed_guios_catalog.py
─────────────────────────────────────────────────────────────────────────────
Carga (o actualiza) el catálogo base de GUIOS desde docs/catalogo_guios.json.

Uso:
    python backend/manage.py seed_guios_catalog
    python backend/manage.py seed_guios_catalog --dry-run

- Idempotente: los registros se identifican por su ``code`` (el ``codigo`` del
  JSON); ejecutarlo varias veces no duplica entradas.
- Única fuente: el JSON. La IS se toma de la Tabla 5.3 sin recalcular (P7) y el
  texto de cada subfactor es ``texto_mostrar`` (P3). Todo queda con is_base=True.
- Valida 3 dimensiones, 18 factores y 61 subfactores antes de escribir. Todo
  ocurre en una sola transacción: si algo falla, no se guarda nada.
- No borra registros ni cambia ``is_active``; los registros sin ``code``
  (creados desde la interfaz) no se tocan.
"""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction

from apps.guios.models import Dimension, Factor, Subfactor

DEFAULT_CATALOG_PATH = Path(settings.BASE_DIR).parent / 'docs' / 'catalogo_guios.json'

EXPECTED_DIMENSIONS = 3
EXPECTED_FACTORS = 18
EXPECTED_SUBFACTORS = 61
EXPECTED_SUBFACTORS_BY_DIMENSION = {'TEC': 40, 'ORG': 19, 'ECO': 2}

SCOPE_MAP = {
    'interno': Factor.SCOPE_INTERNAL,
    'externo': Factor.SCOPE_EXTERNAL,
    'ambos': Factor.SCOPE_BOTH,
}

CODE_MAX_LENGTH = 20


class DryRunRollback(Exception):
    """Deshace la transacción al final de --dry-run."""


class Command(BaseCommand):
    help = 'Carga el catálogo base de GUIOS (3 dimensiones, 18 factores, 61 subfactores) desde docs/catalogo_guios.json.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra qué se crearía y qué se actualizaría, sin guardar nada.',
        )
        parser.add_argument(
            '--file',
            default=str(DEFAULT_CATALOG_PATH),
            help='Ruta del JSON del catálogo (por defecto docs/catalogo_guios.json).',
        )

    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        path = Path(options['file'])

        catalog = self._load(path)
        dimensions = self._validate(catalog)

        mode = " (SIMULACIÓN: no se guarda nada)" if self.dry_run else ""
        self.stdout.write(f"Cargando catálogo GUIOS desde {path}{mode}...")

        self.stats = {'created': 0, 'updated': 0, 'unchanged': 0}
        self.updated_records = []

        try:
            with transaction.atomic():
                self._seed(dimensions)
                if self.dry_run:
                    raise DryRunRollback
        except DryRunRollback:
            pass
        except IntegrityError as exc:
            raise CommandError(
                f"Error de integridad al guardar el catálogo; no se guardó nada. Detalle: {exc}"
            ) from exc

        self._print_summary()

    # ── Lectura y validación ──────────────────────────────────────────────────

    def _load(self, path):
        try:
            with path.open(encoding='utf-8') as handle:
                return json.load(handle)
        except FileNotFoundError as exc:
            raise CommandError(f"No existe el archivo del catálogo: {path}") from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f"El catálogo no es un JSON válido: {exc}") from exc

    def _validate(self, catalog):
        errors = []
        dimensions = catalog.get('dimensiones') if isinstance(catalog, dict) else None
        if not isinstance(dimensions, list):
            raise CommandError("El catálogo no tiene la lista 'dimensiones'.")

        codes = set()

        def check_code(code, where):
            if not isinstance(code, str) or not code.strip():
                errors.append(f"{where}: falta 'codigo'.")
            elif len(code) > CODE_MAX_LENGTH:
                errors.append(f"{where}: el código '{code}' supera {CODE_MAX_LENGTH} caracteres.")
            elif code in codes:
                errors.append(f"{where}: código duplicado '{code}'.")
            else:
                codes.add(code)

        def check_text(value, where, field, max_length=None):
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{where}: falta '{field}'.")
            elif max_length and len(value) > max_length:
                errors.append(f"{where}: '{field}' supera {max_length} caracteres.")

        factor_count = 0
        subfactor_count = 0
        configurable = []

        for dimension in dimensions:
            dim_code = dimension.get('codigo')
            check_code(dim_code, f"Dimensión {dim_code}")
            check_text(dimension.get('nombre'), f"Dimensión {dim_code}", 'nombre', 150)
            dim_subfactors = 0

            for factor in dimension.get('factores', []):
                factor_count += 1
                f_code = factor.get('codigo')
                where = f"Factor {f_code}"
                check_code(f_code, where)
                check_text(factor.get('nombre'), where, 'nombre', 200)

                importance = factor.get('is')
                if not isinstance(importance, int) or isinstance(importance, bool) or not 1 <= importance <= 4:
                    errors.append(f"{where}: IS '{importance}' fuera del rango 1-4.")

                scope = factor.get('ambito')
                if scope not in SCOPE_MAP:
                    errors.append(f"{where}: ámbito '{scope}' no válido (interno, externo o ambos).")
                if factor.get('ambito_configurable') is True:
                    configurable.append(f_code)
                    if scope != 'ambos':
                        errors.append(f"{where}: un ámbito configurable debe ser 'ambos'.")
                elif scope == 'ambos':
                    errors.append(f"{where}: ámbito 'ambos' sin 'ambito_configurable'.")

                for subfactor in factor.get('subfactores', []):
                    subfactor_count += 1
                    dim_subfactors += 1
                    s_code = subfactor.get('codigo')
                    check_code(s_code, f"Subfactor {s_code}")
                    check_text(subfactor.get('texto_mostrar'), f"Subfactor {s_code}", 'texto_mostrar')

            expected = EXPECTED_SUBFACTORS_BY_DIMENSION.get(dim_code)
            if expected is not None and dim_subfactors != expected:
                errors.append(f"Dimensión {dim_code}: {dim_subfactors} subfactores (se esperaban {expected}).")

        if len(dimensions) != EXPECTED_DIMENSIONS:
            errors.append(f"Hay {len(dimensions)} dimensiones (se esperaban {EXPECTED_DIMENSIONS}).")
        if factor_count != EXPECTED_FACTORS:
            errors.append(f"Hay {factor_count} factores (se esperaban {EXPECTED_FACTORS}).")
        if subfactor_count != EXPECTED_SUBFACTORS:
            errors.append(f"Hay {subfactor_count} subfactores (se esperaban {EXPECTED_SUBFACTORS}).")
        if len(configurable) != 1:
            errors.append(f"Debe haber un único factor con ámbito configurable (Soporte); hay {len(configurable)}.")

        if errors:
            raise CommandError(
                "El catálogo no es válido; no se guardó nada:\n  - " + "\n  - ".join(errors)
            )
        return dimensions

    # ── Escritura ─────────────────────────────────────────────────────────────

    def _seed(self, dimensions):
        for dim_data in dimensions:
            dimension = self._sync(Dimension, dim_data['codigo'], {
                'name': dim_data['nombre'],
                'description': dim_data.get('descripcion', ''),
                'order': dim_data.get('orden', 0),
                'is_base': True,
            }, level=0)

            for factor_data in dim_data['factores']:
                factor = self._sync(Factor, factor_data['codigo'], {
                    'dimension': dimension,
                    'name': factor_data['nombre'],
                    'description': factor_data.get('descripcion', ''),
                    'suggested_importance': factor_data['is'],
                    'scope': SCOPE_MAP[factor_data['ambito']],
                    'scope_configurable': factor_data.get('ambito_configurable') is True,
                    'order': factor_data.get('orden', 0),
                    'is_base': True,
                }, level=1)

                for sub_data in factor_data['subfactores']:
                    self._sync(Subfactor, sub_data['codigo'], {
                        'factor': factor,
                        'description': sub_data['texto_mostrar'],
                        'order': sub_data.get('orden', 0),
                        'is_base': True,
                    }, level=2)

    def _sync(self, model, code, values, level):
        indent = "  " * (level + 1)
        instance = model.objects.filter(code=code).first()

        if instance is None:
            instance = model.objects.create(code=code, **values)
            self.stats['created'] += 1
            verb = "CREARÍA" if self.dry_run else "CREADO"
            self.stdout.write(f"{indent}✨ {verb}: {code} {self._label(instance)}")
            return instance

        changes = []
        for field, new_value in values.items():
            old_value = getattr(instance, field)
            if old_value != new_value:
                changes.append((field, old_value, new_value))
                setattr(instance, field, new_value)

        if changes:
            instance.save()
            self.stats['updated'] += 1
            self.updated_records.append((model._meta.verbose_name, code, changes))
            verb = "ACTUALIZARÍA" if self.dry_run else "ACTUALIZADO"
            fields = ", ".join(field for field, _, _ in changes)
            self.stdout.write(f"{indent}🔄 {verb}: {code} {self._label(instance)} ({fields})")
        else:
            self.stats['unchanged'] += 1
        return instance

    @staticmethod
    def _label(instance):
        text = getattr(instance, 'name', None) or instance.description
        return text if len(text) <= 60 else text[:57] + "..."

    @staticmethod
    def _short(value):
        if not isinstance(value, str):
            return repr(value if not hasattr(value, 'pk') else str(value))
        return repr(value if len(value) <= 70 else value[:67] + "...")

    # ── Resumen ───────────────────────────────────────────────────────────────

    def _print_summary(self):
        stats = self.stats
        title = "📊 RESUMEN DEL CATÁLOGO GUIOS" + (" (SIMULACIÓN)" if self.dry_run else "")
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.SUCCESS(title))
        self.stdout.write("=" * 70)
        self.stdout.write(f"  ✨ Creados:       {stats['created']}")
        self.stdout.write(f"  🔄 Actualizados:  {stats['updated']}")
        self.stdout.write(f"  ✓ Sin cambios:   {stats['unchanged']}")
        self.stdout.write(f"  📊 Total:         {sum(stats.values())}")
        self.stdout.write("=" * 70)

        if self.updated_records:
            heading = (
                "Registros base que se actualizarían" if self.dry_run
                else "Registros base actualizados"
            )
            self.stdout.write(self.style.WARNING(
                f"\n⚠️  {heading} (revise si alguno tenía un cambio hecho a mano):"
            ))
            for verbose_name, code, changes in self.updated_records:
                self.stdout.write(f"  • {verbose_name} {code}")
                for field, old_value, new_value in changes:
                    self.stdout.write(f"      {field}: {self._short(old_value)} → {self._short(new_value)}")

        if self.dry_run:
            self.stdout.write(self.style.WARNING("\n💡 Simulación: no se guardó ningún cambio."))
        else:
            self.stdout.write(self.style.SUCCESS("✅ ¡Catálogo GUIOS cargado satisfactoriamente!"))
