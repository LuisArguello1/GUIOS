from django.contrib.auth.models import Group
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from apps.core.models.menuModule import MenuModule
from apps.core.models.modulePermission import ModulePermission
from apps.core.selectors.permissions import get_permissions_for_group
from ..serializers.group_serializers import (
    GroupSerializer,
    GroupUpdateModulesSerializer,
    GroupUpdatePermissionsSerializer,
    GroupDetailSerializer,
)


class GroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de Roles (Groups de Django).

    Endpoints adicionales:
        POST   /groups/{id}/update-modules/      → asigna módulos de menú
        POST   /groups/{id}/update-permissions/  → asigna permisos granulares
        GET    /groups/{id}/permissions/         → lista permisos del rol
    """
    queryset = Group.objects.prefetch_related(
        'menu_modules',
        'module_permissions',
        'module_permissions__module',
    ).all().order_by('name')
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': ['settings.manage', 'settings.roles_view', 'settings.roles_manage', 'users.assign_roles'],
        'retrieve': ['settings.manage', 'settings.roles_view', 'settings.roles_manage', 'users.assign_roles'],
        'create': ['settings.manage', 'settings.roles_manage'],
        'update': ['settings.manage', 'settings.roles_manage'],
        'partial_update': ['settings.manage', 'settings.roles_manage'],
        'destroy': ['settings.manage', 'settings.roles_manage'],
        'update_modules': ['settings.manage', 'settings.roles_manage'],
        'list_permissions': ['settings.manage', 'settings.roles_view', 'settings.roles_manage'],
        'update_permissions': ['settings.manage', 'settings.roles_manage'],
    }

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer

    # ── Módulos de Menú ───────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='update-modules')
    def update_modules(self, request, pk=None):
        """
        POST /api/v1/core/groups/{id}/update-modules/

        Reemplaza el conjunto de módulos de menú asignados al rol.
        Body: { "module_ids": [1, 2, 3] }
        """
        group = self.get_object()
        serializer = GroupUpdateModulesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        module_ids = serializer.validated_data['module_ids']

        from apps.core.selectors.menu import get_menu_modules_by_ids
        modules = list(get_menu_modules_by_ids(module_ids))
        group.menu_modules.set(modules)

        return Response({
            'id': group.id,
            'name': group.name,
            'modules': [m.id for m in modules],
        }, status=status.HTTP_200_OK)

    # ── Permisos Granulares ───────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='permissions')
    def list_permissions(self, request, pk=None):
        """
        GET /api/v1/core/groups/{id}/permissions/

        Retorna todos los ModulePermission asignados al rol.
        """
        group = self.get_object()
        perms = get_permissions_for_group(group.id)

        data = [
            {
                "id": p.id,
                "codename": p.codename,
                "label": p.label,
                "description": p.description,
                "module_id": p.module_id,
                "module_label": p.module.label,
                "module_path": p.module.path,
                "order": p.order,
            }
            for p in perms
        ]
        return Response({"id": group.id, "name": group.name, "permissions": data})

    @action(detail=True, methods=['post'], url_path='update-permissions')
    def update_permissions(self, request, pk=None):
        """
        POST /api/v1/core/groups/{id}/update-permissions/

        Reemplaza el conjunto de ModulePermission asignados al rol.
        Body: { "permission_ids": [1, 5, 12] }
        """
        group = self.get_object()
        serializer = GroupUpdatePermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        permission_ids = serializer.validated_data['permission_ids']

        from apps.core.selectors.permissions import get_permissions_by_ids, get_permissions_assigned_to_group
        permissions_qs = list(get_permissions_by_ids(permission_ids))
        # Actualizar la relación M:N desde el lado ModulePermission
        for perm in get_permissions_assigned_to_group(group):
            perm.groups.remove(group)
        for perm in permissions_qs:
            perm.groups.add(group)

        return Response({
            'id': group.id,
            'name': group.name,
            'permission_ids': [p.id for p in permissions_qs],
        }, status=status.HTTP_200_OK)