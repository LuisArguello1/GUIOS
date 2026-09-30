"""
management/commands/setup_permissions.py
─────────────────────────────────────────────────────────────────────────────
Crea (o actualiza) el catálogo completo de ModulePermission.

Uso:
    python manage.py setup_permissions

- Idempotente: puede ejecutarse múltiples veces sin duplicar datos.
- Requiere que ``setup_menus`` haya sido ejecutado previamente (necesita
  los MenuModule con sus paths).
- Los permisos obsoletos (presentes en BD pero no en el catálogo) se
  eliminan automáticamente al final de la ejecución.
"""
from django.core.management.base import BaseCommand
from apps.core.models.menuModule import MenuModule
from apps.core.models.modulePermission import ModulePermission


# ─────────────────────────────────────────────────────────────────────────────
# Catálogo maestro de permisos
# Formato: { path_del_modulo: [ (codename, label, description, order) ] }
# ─────────────────────────────────────────────────────────────────────────────
PERMISSION_CATALOG: dict[str, list[tuple[str, str, str, int]]] = {

    # ── Panel Principal ───────────────────────────────────────────────────────
    "/dashboard": [
        ("dashboard.view", "Ver dashboard", "Accede al panel principal con KPIs y resúmenes.", 1),
    ],


    # ── Configuración & Sistema ───────────────────────────────────────────────
    "/dashboard/users": [
        ("users.view",        "Ver usuarios",       "Accede al listado de usuarios del sistema.",                   1),
        ("users.create",      "Crear usuarios",     "Registra nuevos usuarios.",                                    2),
        ("users.edit",        "Editar usuarios",    "Modifica datos de usuarios existentes.",                       3),
        ("users.deactivate",  "Desactivar usuarios","Desactiva cuentas de usuario.",                                4),
        ("users.assign_roles","Asignar roles",      "Gestiona los roles asignados a cada usuario.",                 5),
    ],
    "/dashboard/auditoria": [
        ("audit.view",   "Ver auditoría",    "Accede a los registros de auditoría del sistema.",                   1),
    ],
    "/dashboard/configuracion": [
        ("settings.view",           "Acceso a configuración", "Permite entrar al panel lateral de configuración.",      1),
        ("settings.org_view",       "Ver organización",       "Visualiza los datos de la empresa.",                   2),
        ("settings.org_manage",     "Gestionar organización", "Modifica datos legales, logo y contacto.",             3),
        ("settings.roles_view",     "Ver roles y permisos",   "Visualiza la matriz de seguridad y roles.",            10),
        ("settings.roles_manage",   "Gestionar roles",        "Modifica privilegios y asignaciones de roles.",        11),
        ("settings.menu_view",      "Ver categorías menú",    "Visualiza la estructura de categorías del catálogo.",  12),
        ("settings.menu_manage",    "Gestionar categorías",   "Organiza y jerarquiza el menú de GUIOS.",              13),
        ("settings.profile_view",   "Ver mi perfil",          "Accede a la visualización de datos personales.",       20),
        ("settings.profile_manage", "Gestionar perfil",       "Modifica datos de perfil y avatar propio.",            21),
    ],
}


class Command(BaseCommand):
    help = (
        "Crea o actualiza el catálogo de permisos granulares por módulo. "
        "Idempotente: puede ejecutarse múltiples veces."
    )

    def handle(self, *args, **kwargs):
        self.stdout.write("\n🔐  Sincronizando catálogo de permisos de módulo...\n")

        # Pre-cargar módulos por path para no hacer N consultas
        modules_by_path: dict[str, MenuModule] = {
            m.path: m for m in MenuModule.objects.all()
        }

        stats = {"created": 0, "updated": 0, "skipped_no_module": 0, "unchanged": 0}

        for path, permissions in PERMISSION_CATALOG.items():
            module = modules_by_path.get(path)
            if not module:
                self.stdout.write(
                    self.style.WARNING(f"Módulo no encontrado para path '{path}' — omitido. "
                                       "Ejecuta setup_menus primero.")
                )
                stats["skipped_no_module"] += len(permissions)
                continue

            self.stdout.write(f"\n  📦 [{module.label}]  ({path})")

            for codename, label, description, order in permissions:
                perm, created = ModulePermission.objects.get_or_create(
                    codename=codename,
                    defaults={
                        "module": module,
                        "label": label,
                        "description": description,
                        "order": order,
                    },
                )

                if created:
                    stats["created"] += 1
                    self.stdout.write(f"    ✨ CREADO    {codename} → {label}")
                else:
                    # Actualizar si algo cambió (excepto los grupos asignados)
                    changed = False
                    if perm.label != label:
                        perm.label = label
                        changed = True
                    if perm.description != description:
                        perm.description = description
                        changed = True
                    if perm.order != order:
                        perm.order = order
                        changed = True
                    if perm.module_id != module.pk:
                        perm.module = module
                        changed = True

                    if changed:
                        perm.save()
                        stats["updated"] += 1
                        self.stdout.write(f"    🔄 ACTUALIZADO {codename} → {label}")
                    else:
                        stats["unchanged"] += 1
                        self.stdout.write(f"    ✓  sin cambios  {codename}")

        # ── Limpieza de permisos obsoletos ─────────────────────────────────────
        self.stdout.write("\n🧹  Buscando permisos obsoletos para eliminar...")
        all_catalog_codenames = []
        for perms in PERMISSION_CATALOG.values():
            for codename, _, _, _ in perms:
                all_catalog_codenames.append(codename)

        to_delete = ModulePermission.objects.exclude(codename__in=all_catalog_codenames)
        delete_count = to_delete.count()

        if delete_count > 0:
            for p in to_delete:
                self.stdout.write(self.style.WARNING(f"    🗑️  ELIMINANDO: {p.codename}"))
            to_delete.delete()
            self.stdout.write(self.style.SUCCESS(f"  ✅  Se eliminaron {delete_count} permisos obsoletos."))
        else:
            self.stdout.write("    ✓  No hay permisos obsoletos.")

        total = stats["created"] + stats["updated"] + stats["unchanged"]
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.SUCCESS("📊  RESUMEN"))
        self.stdout.write("=" * 70)
        self.stdout.write(f"  ✨ Creados:          {stats['created']}")
        self.stdout.write(f"  🔄 Actualizados:    {stats['updated']}")
        self.stdout.write(f"  ✓  Sin cambios:     {stats['unchanged']}")
        self.stdout.write(f"  ⚠  Sin módulo:      {stats['skipped_no_module']}")
        self.stdout.write(f"  📊 Total procesados: {total}")
        self.stdout.write("=" * 70)
        self.stdout.write(self.style.SUCCESS("✅  ¡Catálogo de permisos sincronizado!"))
        self.stdout.write(
            self.style.WARNING(
                "\n💡 Ahora asigna permisos a los roles desde:\n"
                "   Configuración → Roles y Permisos\n"
            )
        )
