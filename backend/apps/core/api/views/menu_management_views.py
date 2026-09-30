from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.auth.api.permissions import HasModulePermission
from apps.core.models.menuGroup import MenuGroup
from apps.core.models.menuModule import MenuModule
from apps.core.api.serializers.menu_management_serializers import (
    MenuManagementGroupSerializer,
    MenuManagementModuleSerializer,
)
from apps.core.services.menu import (
    update_menu_group_order,
    update_menu_module_order,
    update_menu_group_basic_info,
    update_menu_module_basic_info,
)
from apps.core.selectors.menu import (
    get_menu_groups_by_ids,
    get_menu_modules_by_ids,
    get_menu_group_by_id,
)


class MenuCategoryManagementViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Administración de Categorías de Menú. Solo permite ver y actualizar nombre/orden."""

    queryset = MenuGroup.objects.all().order_by('order')
    serializer_class = MenuManagementGroupSerializer
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': ['settings.manage', 'settings.menu_view', 'settings.menu_manage'],
        'retrieve': ['settings.manage', 'settings.menu_view', 'settings.menu_manage'],
        'update': ['settings.manage', 'settings.menu_manage'],
        'partial_update': ['settings.manage', 'settings.menu_manage'],
        'reorder': ['settings.manage', 'settings.menu_manage'],
    }

    def perform_update(self, serializer):
        # CORREGIDO: usar serializer.instance en lugar de self.get_object()
        # para evitar una segunda query a la BD.
        instance = serializer.instance
        new_order = serializer.validated_data.get('order', instance.order)
        new_name = serializer.validated_data.get('name', instance.name)

        # CORREGIDO: todo dentro de atomic para consistencia garantizada
        with transaction.atomic():
            update_menu_group_basic_info(group=instance, name=new_name)
            if instance.order != new_order:
                update_menu_group_order(group=instance, new_order=new_order)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """
        POST /api/v1/core/menu-categories/reorder/
        Cuerpo: { "ids": [3, 1, 2] }
        """
        ids = request.data.get('ids', [])

        if not isinstance(ids, list) or not ids:
            return Response(
                {"error": "Se requiere una lista de IDs no vacía."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # CORREGIDO: validar que todos los valores sean enteros
        try:
            ids = [int(i) for i in ids]
        except (ValueError, TypeError):
            return Response(
                {"error": "Todos los IDs deben ser enteros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # CORREGIDO: verificar que todos los grupos existen antes de modificar
        groups_qs = get_menu_groups_by_ids(ids)
        existing_ids = set(groups_qs.values_list('id', flat=True))
        missing = [i for i in ids if i not in existing_ids]
        if missing:
            return Response(
                {"error": f"Los siguientes IDs no existen: {missing}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            groups = list(groups_qs)
            group_map = {g.id: g for g in groups}
            to_update = []
            for index, group_id in enumerate(ids, start=1):
                group = group_map.get(group_id)
                if group:
                    group.order = index
                    to_update.append(group)
            if to_update:
                MenuGroup.objects.bulk_update(to_update, ['order'])


        return Response({"status": "Categorías reordenadas."}, status=status.HTTP_200_OK)


class MenuModuleManagementViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Administración de Módulos de Menú. Solo permite ver y actualizar label/orden/grupo."""
    
    # Optimización: Agregar select_related('group') para evitar N+1 si se accediera a campos del grupo
    queryset = MenuModule.objects.select_related('group').all().order_by('group__order', 'order')
    serializer_class = MenuManagementModuleSerializer
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': ['settings.manage', 'settings.menu_view', 'settings.menu_manage'],
        'retrieve': ['settings.manage', 'settings.menu_view', 'settings.menu_manage'],
        'update': ['settings.manage', 'settings.menu_manage'],
        'partial_update': ['settings.manage', 'settings.menu_manage'],
        'reorder': ['settings.manage', 'settings.menu_manage'],
    }

    def perform_update(self, serializer):
        # CORREGIDO: usar serializer.instance
        instance = serializer.instance
        new_order = serializer.validated_data.get('order', instance.order)
        new_label = serializer.validated_data.get('label', instance.label)
        new_group = serializer.validated_data.get('group', instance.group)

        # CORREGIDO: todo dentro de atomic
        with transaction.atomic():
            update_menu_module_basic_info(module=instance, label=new_label)
            if instance.order != new_order or instance.group != new_group:
                update_menu_module_order(
                    module=instance,
                    new_order=new_order,
                    new_group=new_group,
                )

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """
        POST /api/v1/core/menu-modules/reorder/
        Cuerpo: { "ids": [5, 2, 8], "group_id": 1 }
        """
        ids = request.data.get('ids', [])
        group_id = request.data.get('group_id')

        if not isinstance(ids, list) or not ids or group_id is None:
            return Response(
                {"error": "Se requiere lista de IDs y group_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # CORREGIDO: validar tipos
        try:
            ids = [int(i) for i in ids]
            group_id = int(group_id)
        except (ValueError, TypeError):
            return Response(
                {"error": "IDs y group_id deben ser enteros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # CORREGIDO: verificar que el grupo existe
        group = get_object_or_404(MenuGroup, id=group_id)

        # CORREGIDO: verificar que TODOS los módulos existen
        # Y que pertenecen al grupo indicado
        modules_qs = get_menu_modules_by_ids(ids)
        existing_ids = set(modules_qs.values_list('id', flat=True))
        missing = [i for i in ids if i not in existing_ids]
        if missing:
            return Response(
                {"error": f"Los siguientes módulos no existen: {missing}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guardar los grupos originales para re-indexar después
        affected_groups = set([group_id])
        original_groups = list(modules_qs.values_list('group_id', flat=True))
        affected_groups.update(original_groups)

        with transaction.atomic():
            modules = list(modules_qs)
            module_map = {m.id: m for m in modules}
            to_update = []
            for index, module_id in enumerate(ids, start=1):
                module = module_map.get(module_id)
                if module:
                    module.order = index
                    module.group_id = group_id
                    to_update.append(module)
            if to_update:
                MenuModule.objects.bulk_update(to_update, ['order', 'group_id'])
            
            # Normalizar todos los grupos que han cambiado o recibido ítems
            for g_id in affected_groups:
                from apps.core.services.menu import _reindex_modules
                group_obj = get_menu_group_by_id(g_id)
                if group_obj:
                    _reindex_modules(group_obj)



        return Response({"status": "Módulos reordenados."}, status=status.HTTP_200_OK)