from rest_framework import serializers
from ...models.menuGroup import MenuGroup
from ...models.menuModule import MenuModule


class MenuManagementGroupSerializer(serializers.ModelSerializer):
    """Serializador para edicion administrativa de Categorias."""

    class Meta:
        model = MenuGroup
        fields = ('id', 'name', 'order', 'icon')
        extra_kwargs = {
            'id': {'read_only': True},
        }

    def validate_order(self, value):
        if value < 1:
            raise serializers.ValidationError("El orden debe ser mayor o igual a 1.")
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre no puede estar vacio.")
        return value


class MenuManagementModuleSerializer(serializers.ModelSerializer):
    """Serializador para edicion administrativa de Modulos."""

    class Meta:
        model = MenuModule
        fields = ('id', 'label', 'order', 'group', 'icon', 'path')
        extra_kwargs = {
            'id': {'read_only': True},
            'path': {'read_only': True},
        }

    def validate_order(self, value):
        if value < 1:
            raise serializers.ValidationError("El orden debe ser mayor o igual a 1.")
        return value

    def validate_label(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La etiqueta no puede estar vacia.")
        return value
