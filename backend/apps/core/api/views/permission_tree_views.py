"""
core/api/views/permission_tree_views.py
─────────────────────────────────────────────────────────────────────────────
Endpoint de solo lectura para obtener el árbol completo de ModulePermission,
agrupado por categoría y módulo de menú.

Usado por la UI de configuración de roles para mostrar qué permisos
existen y cuáles están activos para el rol seleccionado.

GET /api/v1/core/permission-tree/
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from apps.core.models.menuGroup import MenuGroup
from apps.core.models.modulePermission import ModulePermission


class PermissionTreeViewSet(viewsets.ViewSet):
    """
    GET /api/v1/core/permission-tree/

    Retorna el árbol completo de permisos agrupado por categoría y módulo.
    Estructura de respuesta:
    [
      {
        "id": 1,
        "name": "Sistema",
        "order": 20,
        "modules": [
          {
            "id": 3,
            "label": "Usuarios",
            "path": "/dashboard/users",
            "permissions": [
              {"id": 1, "codename": "users.view",   "label": "Ver usuarios",   "order": 1},
              {"id": 2, "codename": "users.create", "label": "Crear usuarios", "order": 2},
              ...
            ]
          },
          ...
        ]
      },
      ...
    ]
    """
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': ['settings.manage', 'settings.roles_view', 'settings.roles_manage'],
    }

    def list(self, request):
        # Cargar todos los grupos con sus módulos y permisos de forma altamente optimizada
        from apps.core.selectors.menu import get_menu_groups_with_modules_and_permissions
        groups = get_menu_groups_with_modules_and_permissions()

        result = []
        for group in groups:
            modules_data = []
            # Usar active_modules que ya está pre-filtrado y ordenado
            for module in group.active_modules:
                # Permisos ya están pre-cargados y ordenados en memoria
                perms = list(module.permissions.all())
                if not perms:
                    continue  # Omitir módulos sin permisos definidos
                modules_data.append({
                    "id": module.id,
                    "label": module.label,
                    "path": module.path,
                    "icon": module.icon,
                    "permissions": [
                        {
                            "id": p.id,
                            "codename": p.codename,
                            "label": p.label,
                            "description": p.description,
                            "order": p.order,
                        }
                        for p in perms
                    ],
                })
            if modules_data:
                result.append({
                    "id": group.id,
                    "name": group.name,
                    "order": group.order,
                    "modules": modules_data,
                })

        return Response(result, status=status.HTTP_200_OK)
