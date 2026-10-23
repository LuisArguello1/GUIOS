from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from ...models.user import CustomUser


class GroupNamesMixin(serializers.Serializer):
    """Nombres de los roles del usuario (la tabla y el detalle del panel los muestran)."""
    groups_names = serializers.SerializerMethodField()

    def get_groups_names(self, obj) -> list[str]:
        return [group.name for group in obj.groups.all()]


class UserListSerializer(GroupNamesMixin, serializers.ModelSerializer):
    """Serializador resumido para listado de usuarios."""
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = CustomUser
        fields = (
            'id',
            'email',
            'username',
            'full_name',
            'phone',
            'is_active',
            'is_staff',
            'created_at',
            'groups',
            'groups_names',
        )


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializador para creación de usuarios.

    CORRECCIÓN: password se valida con los validadores de Django
    (longitud, similitud con email, contraseñas comunes, etc.)
    y se excluye del output. El service llama set_password().
    """
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'},
    )

    class Meta:
        model = CustomUser
        fields = (
            'email',
            'username',
            'first_name',
            'last_name',
            'phone',
            'password',
            'is_active',
            'is_staff',
            'is_superuser',
            'groups',
        )
        extra_kwargs = {
            'username': {'required': False},
            'groups': {'required': False},
        }

    def validate(self, data):
        """Validación de seguridad para roles administrativos."""
        request = self.context.get('request')

        # Solo un superusuario puede crear otro superusuario
        if data.get('is_superuser') and not (request and request.user.is_superuser):
            raise serializers.ValidationError({
                "is_superuser": "Solo un superusuario puede asignar el rol de superusuario."
            })

        return data

    def validate_password(self, value: str) -> str:
        """Ejecuta los AUTH_PASSWORD_VALIDATORS de Django sobre la contraseña."""
        validate_password(value)
        return value

    def validate_email(self, value: str) -> str:
        """Normaliza el email a minúsculas para evitar duplicados."""
        return value.lower().strip()


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador para actualización parcial de usuarios.
    Permite cambiar email, pero no password (flujo propio) ni permisos de superusuario.
    """

    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        style={'input_type': 'password'},
    )

    class Meta:
        model = CustomUser
        fields = (
            'email',
            'first_name',
            'last_name',
            'phone',
            'avatar',
            'is_active',
            'is_staff',
            'is_superuser',
            'groups',
            'password',
        )
        extra_kwargs = {
            'groups': {'required': False},
        }

    def validate(self, data):
        """Validación de seguridad para roles administrativos en actualización."""
        request = self.context.get('request')
        user_obj = self.instance

        # Solo un superusuario puede otorgar o quitar el rol de superusuario
        if 'is_superuser' in data:
            new_val = data.get('is_superuser')
            old_val = user_obj.is_superuser if user_obj else False
            
            if new_val != old_val and not (request and request.user.is_superuser):
                raise serializers.ValidationError({
                    "is_superuser": "Solo un superusuario puede modificar este campo."
                })

        return data

    def validate_avatar(self, value):
        from django.core.files.uploadedfile import UploadedFile
        if value and isinstance(value, UploadedFile):
            from apps.core.utils.image_processing import process_image_to_webp
            processed_image = process_image_to_webp(value)
            return processed_image if processed_image else value
        return value


class UserSelfUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador para edicion del perfil propio.
    Limita los campos para evitar escalamiento de privilegios.
    """

    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        style={'input_type': 'password'},
    )

    class Meta:
        model = CustomUser
        fields = (
            'email',
            'first_name',
            'last_name',
            'phone',
            'avatar',
            'password',
        )

    def validate_avatar(self, value):
        from django.core.files.uploadedfile import UploadedFile
        if value and isinstance(value, UploadedFile):
            from apps.core.utils.image_processing import process_image_to_webp
            processed_image = process_image_to_webp(value)
            return processed_image if processed_image else value
        return value


class UserDetailSerializer(GroupNamesMixin, serializers.ModelSerializer):
    """Serializador de solo lectura para el detalle completo de un usuario."""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    groups = serializers.SerializerMethodField()
    permissions_details = serializers.SerializerMethodField()
    modules_details = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id',
            'email',
            'username',
            'full_name',
            'first_name',
            'last_name',
            'phone',
            'avatar',
            'is_active',
            'is_staff',
            'is_superuser',
            'groups',
            'groups_names',
            'permissions',
            'permissions_details',
            'modules_details',
            'created_at',
            'updated_at',
            'last_login',
        )
        read_only_fields = fields

    def get_groups(self, obj) -> list[dict]:
        return [{"id": g.id, "name": g.name} for g in obj.groups.all()]

    def get_permissions_details(self, obj) -> list[dict]:
        if obj.is_superuser:
            return [{
                "id": 0,
                "codename": "*",
                "label": "Todos los permisos (Superusuario)",
                "module_label": "Global"
            }]
        
        perms = []
        for g in obj.groups.all():
            for p in g.module_permissions.all():
                perms.append({
                    "id": p.id,
                    "codename": p.codename,
                    "label": p.label,
                    "module_id": p.module_id,
                    "module_label": p.module.label if p.module else "Sistema"
                })
        seen = set()
        unique_perms = []
        for p in perms:
            if p["codename"] not in seen:
                seen.add(p["codename"])
                unique_perms.append(p)
        return unique_perms

    def get_modules_details(self, obj) -> list[dict]:
        if obj.is_superuser:
            from apps.core.models.menuModule import MenuModule
            modules = MenuModule.objects.all().select_related('group')
            return [
                {
                    "id": m.id,
                    "label": m.label,
                    "path": m.path,
                    "icon": m.icon,
                    "category_name": m.group.name if m.group else "Otros"
                }
                for m in modules
            ]
        
        modules = []
        for g in obj.groups.all():
            for m in g.menu_modules.all():
                modules.append({
                    "id": m.id,
                    "label": m.label,
                    "path": m.path,
                    "icon": m.icon,
                    "category_name": m.group.name if m.group else "Otros"
                })
        seen = set()
        unique_modules = []
        for m in modules:
            if m["id"] not in seen:
                seen.add(m["id"])
                unique_modules.append(m)
        return unique_modules


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializador para el cambio de contraseña desde el perfil.
    """
    old_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    confirm_password = serializers.CharField(
        required=True,
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    otp_code = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=6,
        min_length=6,
        write_only=True
    )

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                "confirm_password": "La nueva contraseña y su confirmación no coinciden."
            })
        if data['old_password'] == data['new_password']:
            raise serializers.ValidationError({
                "new_password": "La nueva contraseña no puede ser igual a la anterior."
            })
        return data


class UserDeleteImpactItemSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class UserDeleteImpactSerializer(serializers.Serializer):
    """Qué pasará al eliminar al usuario (aviso del modal antes de confirmar)."""
    action = serializers.ChoiceField(choices=['HARD_DELETE', 'SOFT_DELETE'])
    total = serializers.IntegerField()
    items = UserDeleteImpactItemSerializer(many=True)
    summary = serializers.CharField(help_text='Ej.: "12 registros de auditoría, 3 cambios en el catálogo GUIOS".')
