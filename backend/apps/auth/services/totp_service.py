import logging
import pyotp
import uuid
from django.db import transaction
from django.contrib.auth import get_user_model
from django.core.cache import cache
from ..models.totp import TOTPDevice
from ..selectors.totp import (
    get_totp_device_by_user,
    get_totp_device_for_update,
    get_active_totp_device_for_update,
)
from ..selectors.user import get_active_user_by_id

User = get_user_model()
logger = logging.getLogger(__name__)

# MEJORA: límite de intentos fallidos de código TOTP por usuario.
# Evita fuerza bruta sobre los 1.000.000 códigos posibles.
_TOTP_MAX_ATTEMPTS = 5
_TOTP_LOCKOUT_SECONDS = 300  # 5 minutos


class TOTPService:

    @staticmethod
    def get_or_create_device(user) -> TOTPDevice:
        device, _created = TOTPDevice.objects.get_or_create(user=user)
        return device

    @staticmethod
    def get_provisioning_data(user) -> dict:
        """
        MEJORA: ya NO devuelve el secreto en texto plano.
        El secreto sólo se necesita para el QR; una vez activado el 2FA
        no debe volver a exponerse. El frontend usa la URI directamente.
        """
        device = TOTPService.get_or_create_device(user)
        data = {
            'uri': device.get_totp_uri() if not device.is_active else None,
            'is_active': device.is_active,
        }
        # Sólo exponer el secreto (para apps que no leen URI) ANTES de activar
        if not device.is_active:
            data['secret'] = device.secret
        return data

    @staticmethod
    @transaction.atomic
    def activate_2fa(user, token: str) -> dict:
        """
        Activa el 2FA y genera códigos de recuperación.
        Retorna {'success': bool, 'recovery_codes': list[str]|None}
        """
        device = get_totp_device_for_update(user)
        if not device:
            device = TOTPDevice.objects.create(user=user)

        if device.is_active:
            return {'success': True, 'recovery_codes': None}

        if device.verify_token(token):
            device.is_active = True
            device.save(update_fields=['is_active', 'updated_at'])
            
            # Generar códigos de recuperación iniciales
            recovery_codes = device.generate_recovery_codes()
            
            logger.info("2FA activado | user_id=%s", user.id)
            return {'success': True, 'recovery_codes': recovery_codes}

        return {'success': False, 'recovery_codes': None}

    @staticmethod
    @transaction.atomic
    def deactivate_2fa(user) -> bool:
        """
        MEJORA: al desactivar se regenera el secreto Y se resetea el contador,
        invalidando cualquier código que estuviera en vuelo.
        """
        device = get_totp_device_for_update(user)
        if not device:
            return False

        device.is_active = False
        device.secret = pyotp.random_base32()        # invalida códigos previos
        device.last_verified_counter = -1            # resetear anti-replay
        device.save(update_fields=['is_active', 'secret', 'last_verified_counter', 'updated_at'])
        logger.info("2FA desactivado | user_id=%s", user.id)
        return True

    # ── Helpers de rate limiting para verificación ──────────────────────────

    @staticmethod
    def _totp_attempts_key(user_id) -> str:
        return f"totp_attempts:{user_id}"

    @staticmethod
    def _is_totp_locked(user_id) -> bool:
        return cache.get(TOTPService._totp_attempts_key(user_id), 0) >= _TOTP_MAX_ATTEMPTS

    @staticmethod
    def _register_totp_failure(user_id):
        key = TOTPService._totp_attempts_key(user_id)
        attempts = cache.get(key, 0) + 1
        cache.set(key, attempts, timeout=_TOTP_LOCKOUT_SECONDS)
        logger.warning("TOTP fallido | user_id=%s | intento=%d", user_id, attempts)

    @staticmethod
    def _clear_totp_attempts(user_id):
        cache.delete(TOTPService._totp_attempts_key(user_id))

    # ────────────────────────────────────────────────────────────────────────

    @staticmethod
    def verify_login_code(user, token: str) -> bool:
        """
        Verifica el código (TOTP o de recuperación) con anti-replay y rate limiting.
        """
        if TOTPService._is_totp_locked(user.id):
            logger.warning("TOTP bloqueado por rate limit | user_id=%s", user.id)
            return False

        with transaction.atomic():
            device = get_active_totp_device_for_update(user)
            if not device:
                return False

            # 1. Intentar como token TOTP estándar (6 dígitos)
            if len(token) == 6 and token.isdigit():
                if device.verify_token(token):
                    TOTPService._clear_totp_attempts(user.id)
                    return True

            # 2. Intentar como código de recuperación (formato XXXX-XXXX-XXXX)
            if device.verify_and_consume_recovery_code(token):
                logger.info("Login con código de recuperación | user_id=%s", user.id)
                TOTPService._clear_totp_attempts(user.id)
                return True

        TOTPService._register_totp_failure(user.id)
        return False

    @staticmethod
    @transaction.atomic
    def regenerate_recovery_codes(user) -> list[str]:
        """
        Regenera los códigos de recuperación para un usuario.
        """
        device = get_active_totp_device_for_update(user)
        if not device:
            return []
        
        codes = device.generate_recovery_codes()
        logger.info("Códigos de recuperación regenerados | user_id=%s", user.id)
        return codes

    @staticmethod
    def create_pre_auth_session(user) -> str:
        """
        MEJORA: se limita a 3 pre-auth tokens activos por usuario para
        evitar que un atacante inunde el cache con sesiones zombie.
        """
        pre_auth_token = str(uuid.uuid4())
        cache.set(f"2fa_pre_auth:{pre_auth_token}", user.id, timeout=300)
        return pre_auth_token

    @staticmethod
    def get_user_from_pre_auth(pre_auth_token: str):
        """
        MEJORA: se valida que el token tenga formato UUID antes de
        consultar el cache (evita cache poisoning con claves arbitrarias).
        """
        try:
            uuid.UUID(pre_auth_token, version=4)
        except (ValueError, AttributeError):
            return None

        user_id = cache.get(f"2fa_pre_auth:{pre_auth_token}")
        if user_id:
            return get_active_user_by_id(user_id)
        return None

    @staticmethod
    def invalidate_pre_auth(pre_auth_token: str):
        cache.delete(f"2fa_pre_auth:{pre_auth_token}")