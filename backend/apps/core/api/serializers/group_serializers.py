from django.contrib.auth.models import Group
from rest_framework import serializers

from apps.core.models.menuModule import MenuModule
from apps.core.models.modulePermission import ModulePermission


class GroupSerializer(serializers.ModelSerializer):
    """Serializador de lista/creacion de grupos."""
    modules = serializers.PrimaryKeyRelatedField(
        source='menu_modules', many=True, read_only=True
    )
    permission_ids = serializers.PrimaryKeyRelatedField(
        source='module_permissions', many=True, read_only=True
    )

    class Meta:
        model = Group
        fields = ['id', 'name', 'modules', 'permission_ids']


class GroupDetailSerializer(serializers.ModelSerializer):
    """Serializador de detalle de grupo con permisos completos."""
    modules = serializers.PrimaryKeyRelatedField(
        source='menu_modules', many=True, read_only=True
    )
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'modules', 'permissions']

    def get_permissions(self, obj):
        # Utilizar la relación prefetcheada para evitar N+1
        return [
            {
                "id": p.id,
                "codename": p.codename,
                "label": p.label,
                "module_id": p.module_id,
                "module_label": p.module.label if p.module else "",
            }
            for p in obj.module_permissions.all()
        ]


class GroupUpdateModulesSerializer(serializers.Serializer):
    """Valida los IDs de modulos de menu al asignarlos a un rol."""
    module_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )

    def validate_module_ids(self, value):
        from apps.core.selectors.menu import get_menu_modules_by_ids
        qs = get_menu_modules_by_ids(value)
        if qs.count() != len(set(value)):
            raise serializers.ValidationError('Uno o mas modulos no existen.')
        return value


class GroupUpdatePermissionsSerializer(serializers.Serializer):
    """Valida los IDs de ModulePermission al asignarlos a un rol."""
    permission_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )

    def validate_permission_ids(self, value):
        from apps.core.selectors.permissions import get_permissions_by_ids
        qs = get_permissions_by_ids(value)
        if qs.count() != len(set(value)):
            raise serializers.ValidationError('Uno o mas permisos no existen.')
        return value
