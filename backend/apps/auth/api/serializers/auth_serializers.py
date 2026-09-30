from django.utils.translation import gettext_lazy as _
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    """Serializador para inicio de sesión."""
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
    )

    def validate_email(self, value: str) -> str:
        return value.lower().strip()


class PasswordResetRequestSerializer(serializers.Serializer):
    """PASO 1: Solicitud de código OTP."""
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return value.lower().strip()


class OTPVerifySerializer(serializers.Serializer):
    """PASO 2: Verificación del código de 6 dígitos."""
    email = serializers.EmailField()
    code = serializers.CharField(
        min_length=6,
        max_length=6,
    )

    def validate_code(self, value: str) -> str:
        """Asegura que el código sea solo dígitos."""
        if not value.isdigit():
            raise serializers.ValidationError(_('El código debe contener solo dígitos.'))
        return value

    def validate_email(self, value: str) -> str:
        return value.lower().strip()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """PASO 3: Cambio de contraseña final."""
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(
        min_length=8,
        write_only=True,
        style={'input_type': 'password'},
    )
    confirm_password = serializers.CharField(
        min_length=8,
        write_only=True,
        style={'input_type': 'password'},
    )

    def validate_email(self, value: str) -> str:
        return value.lower().strip()

    def validate_code(self, value: str) -> str:
        if not value.isdigit():
            raise serializers.ValidationError(_('El código debe contener solo dígitos.'))
        return value

    def validate(self, data: dict) -> dict:
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': _('Las contraseñas no coinciden.')}
            )
        return data


class Verify2FASerializer(serializers.Serializer):
    """Serializador para el paso 2 del login con 2FA."""
    pre_auth_token = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=15)

    def validate_code(self, value: str) -> str:
        # Limpiar el código (quitar espacios o guiones si el usuario los pone)
        # pero mantenemos los guiones para el formato XXXX-XXXX-XXXX si es el caso
        return value.strip()


class TOTPSetupSerializer(serializers.Serializer):
    """Serializador para validar el código al activar 2FA."""
    code = serializers.CharField(min_length=6, max_length=6)

    def validate_code(self, value: str) -> str:
        if not value.isdigit():
            raise serializers.ValidationError(_('El código debe contener solo dígitos.'))
        return value


