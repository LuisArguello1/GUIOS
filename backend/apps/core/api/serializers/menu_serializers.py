from rest_framework import serializers
from ...models.menuGroup import MenuGroup
from ...models.menuModule import MenuModule

class MenuModuleSerializer(serializers.ModelSerializer):
    """
    Serializador para módulos individuales del menú lateral (SideBar).
    """
    class Meta:
        model = MenuModule
        fields = (
            'id',
            'label',
            'icon',
            'path',
            'order',
            'is_active',
        )

class MenuGroupSerializer(serializers.ModelSerializer):
    """
    Serializador de Categoría de Menú que incluye sus módulos hijos 
    filtrados dinámicamente.
    """
    # Usamos el atributo 'allowed_modules' generado por el selector (Prefetch)
    modules = MenuModuleSerializer(source='allowed_modules', many=True, read_only=True)

    class Meta:
        model = MenuGroup
        fields = (
            'id',
            'name',
            'order',
            'icon',
            'modules',
        )
