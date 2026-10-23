"""
management/commands/setup_menus.py
─────────────────────────────────────────────────────────────────────────────
Crea (o actualiza) la estructura completa de grupos y módulos del menú.

Uso:
    python manage.py setup_menus

- Idempotente: puede ejecutarse múltiples veces sin duplicar entradas.
- Los módulos se identifican por su ``path``; label, icono y orden se
  actualizan automáticamente si cambian en este archivo.
"""
from django.core.management.base import BaseCommand
from apps.core.models.menuGroup import MenuGroup
from apps.core.models.menuModule import MenuModule

# ── Iconos (Lucide React) ─────────────────────────────────────────────────────
ICONS = {
    "DASHBOARD":   "Gauge",
    "USERS":       "Users",
    "SETTINGS":    "Settings2",
    "AUDIT":       "ShieldCheck",
    "TICKET":      "Receipt",
    "ATTENTION":   "UserCheck",
    "DISPLAY":     "Tv2",
    "IMPORT":      "Upload",
    "STUDENT":     "GraduationCap",
    "LIST":        "ListOrdered",
    "CATEGORY":    "Tags",
    "PROBLEM":     "ShieldAlert",
    "GESTION":     "ClipboardCheck",
    "KIOSK":       "TabletSmartphone",
    "ASPIRANTE":   "UserCheck",
    "DOCENTE":     "BookOpen",
    "PLANTILLA":   "FileText",
    "CATALOG":     "ListTree",
    "EVALUATIONS": "ClipboardList",
}

class Command(BaseCommand):
    help = 'Crea los grupos y módulos de menú organizados por áreas lógicas de negocio.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Organizando menús por áreas operativas...")

        MASTER_MENU = [
            # ── Panel Principal ───────────────────────────────────────────────
            {
                "name": "Panel Principal",
                "order": 10,
                "modules": [
                    {"label": "Dashboard", "icon": ICONS["DASHBOARD"], "path": "/dashboard", "order": 1},
                ],
            },
            # ── GUIOS (catálogo y evaluaciones) ───────────────────────────────
            {
                "name": "GUIOS",
                "order": 20,
                "modules": [
                    {"label": "Catálogo",     "icon": ICONS["CATALOG"],     "path": "/dashboard/catalogo",     "order": 1},
                    {"label": "Evaluaciones", "icon": ICONS["EVALUATIONS"], "path": "/dashboard/evaluaciones", "order": 2},
                ],
            },
            # ── Configuración & Sistema ───────────────────────────────────────
            {
                "name": "Configuración & Sistema",
                "order": 100,
                "modules": [
                    {"label": "Usuarios",      "icon": ICONS["USERS"],    "path": "/dashboard/users",         "order": 1},
                    {"label": "Auditoría",     "icon": ICONS["AUDIT"],    "path": "/dashboard/auditoria",     "order": 2},
                    {"label": "Configuración", "icon": ICONS["SETTINGS"], "path": "/dashboard/configuracion", "order": 3},
                ],
            },
        ]

        # Rastrear estadísticas
        stats = {"created": 0, "updated": 0, "unchanged": 0, "duplicates": 0}

        # Iterar y crear Grupos y Módulos
        for group_data in MASTER_MENU:
            menu_group, group_created = MenuGroup.objects.get_or_create(
                name=group_data["name"],
                defaults={"order": group_data["order"]}
            )
            
            if group_created:
                self.stdout.write(f"\n  📁 Grupo creado: {menu_group.name}")
            else:
                self.stdout.write(f"\n  📁 Grupo existente: {menu_group.name}")
            
            for mod_data in group_data["modules"]:
                path = mod_data["path"]
                
                # Verificar si el módulo ya existe
                module, module_created = MenuModule.objects.get_or_create(
                    path=path,
                    defaults={
                        "group": menu_group,
                        "label": mod_data["label"],
                        "icon": mod_data["icon"],
                        "order": mod_data["order"],
                        "is_active": True
                    }
                )
                
                # Si fue creado, agregar a estadísticas
                if module_created:
                    stats["created"] += 1
                    status_icon = "✨"
                    status_text = "CREADO"
                else:
                    # Verificar si necesita actualización
                    needs_update = (
                        module.group != menu_group or
                        module.label != mod_data["label"] or
                        module.icon != mod_data["icon"] or
                        module.order != mod_data["order"]
                    )
                    
                    if needs_update:
                        module.group = menu_group
                        module.label = mod_data["label"]
                        module.icon = mod_data["icon"]
                        module.order = mod_data["order"]
                        module.save()
                        stats["updated"] += 1
                        status_icon = "🔄"
                        status_text = "ACTUALIZADO"
                    else:
                        stats["unchanged"] += 1
                        status_icon = "✓"
                        status_text = "SIN CAMBIOS"
                
                self.stdout.write(f"    {status_icon} {status_text}: {module.label} → {path}")

        # Mostrar resumen
        self.stdout.write("\n" + "="*70)
        self.stdout.write(self.style.SUCCESS("📊 RESUMEN DE MIGRACIÓN DE MENÚS"))
        self.stdout.write("="*70)
        self.stdout.write(f"  ✨ Módulos Creados:    {stats['created']}")
        self.stdout.write(f"  🔄 Módulos Actualizados: {stats['updated']}")
        self.stdout.write(f"  ✓ Módulos Sin Cambios:  {stats['unchanged']}")
        self.stdout.write(f"  📊 Total de Módulos:    {stats['created'] + stats['updated'] + stats['unchanged']}")
        self.stdout.write("="*70)
        self.stdout.write(self.style.SUCCESS("✅ ¡Migración de menús completada satisfactoriamente!"))
        self.stdout.write(self.style.WARNING(
            "\n💡 Nota: Los roles de cada módulo fueron sincronizados automáticamente."
        ))
