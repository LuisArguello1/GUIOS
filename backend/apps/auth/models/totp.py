import math
import time
import pyotp
import secrets
import string
import hashlib
from django.db import models
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.utils.translation import gettext_lazy as _
from apps.auth.models.user import CustomUser


class TOTPDevice(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='totp_device',
        verbose_name=_('usuario'),
    )
    secret = models.CharField(
        _('secreto TOTP'),
        max_length=32,
        default=pyotp.random_base32,
    )
    is_active = models.BooleanField(_('está activo'), default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # MEJORA: anti-replay real. Guardamos el contador de la última ventana
    # exitosa. Si alguien captura el código y lo reenvía en los mismos
    # 30 s, el contador coincide y se rechaza.
    last_verified_counter = models.BigIntegerField(
        _('último contador verificado'),
        default=-1,
        help_text=_('Ventana TOTP (Unix time // 30) del último código aceptado.'),
    )

    # Códigos de recuperación (hashes de contraseñas de un solo uso)
    recovery_codes = models.JSONField(
        _('códigos de recuperación'),
        default=list,
        blank=True,
        help_text=_('Lista de hashes PBKDF2 de los códigos de respaldo.'),
    )

    class Meta:
        verbose_name = _('dispositivo TOTP')
        verbose_name_plural = _('dispositivos TOTP')

    def __str__(self):
        return f"TOTP ({self.user.email}) – {'Activo' if self.is_active else 'Pendiente'}"

    def get_totp_uri(self) -> str:
        return pyotp.TOTP(self.secret).provisioning_uri(
            name=self.user.email,
            issuer_name=getattr(settings, 'TOTP_ISSUER_NAME', 'GUIOS'),
        )

    def verify_token(self, token: str) -> bool:
        """
        Verifica el token y previene replay attacks.

        Flujo:
        1. Calcula la ventana actual (Unix ts // 30).
        2. pyotp verifica con valid_window=1 (acepta ventana anterior/actual/siguiente).
        3. Si es válido, comprueba que la ventana no haya sido usada ya.
        4. Persiste el contador para bloquear reutilizaciones.

        IMPORTANTE: usa select_for_update() en el servicio para evitar
        race conditions si dos requests llegan al mismo tiempo.
        """
        totp = pyotp.TOTP(self.secret)
        current_counter = int(time.time()) // 30

        # valid_window=1 cubre ±30 s de desfase de reloj.
        # for_time permite obtener qué ventana exacta fue aceptada.
        accepted_counter = None
        for delta in (0, -1, 1):
            window_time = (current_counter + delta) * 30
            if totp.verify(token, for_time=window_time, valid_window=0):
                accepted_counter = current_counter + delta
                break

        if accepted_counter is None:
            return False

        # ANTI-REPLAY: rechazar si ese contador ya fue consumido
        if accepted_counter <= self.last_verified_counter:
            return False

        # Actualizar sin disparar signals innecesarios
        TOTPDevice.objects.filter(pk=self.pk).update(
            last_verified_counter=accepted_counter
        )
        self.last_verified_counter = accepted_counter
        return True

    def generate_recovery_codes(self, count: int = 10) -> list[str]:
        """
        Genera nuevos códigos de recuperación, los hashea y los guarda.
        Retorna los códigos en texto plano para mostrarlos al usuario una única vez.
        """
        plain_codes = []
        hashed_codes = []

        for _ in range(count):
            # Formato: XXXX-XXXX-XXXX
            parts = [
                ''.join(secrets.choice(string.digits) for _ in range(4))
                for _ in range(3)
            ]
            code = '-'.join(parts)
            plain_codes.append(code)
            
            # Usamos SHA-256 en lugar de PBKDF2 (que es demasiado lento para 10 iteraciones).
            # Estos códigos son de alta entropía (12 dígitos numéricos aleatorios),
            # por lo que un hash rápido y seguro como SHA-256 es suficiente.
            hash_str = hashlib.sha256(code.encode('utf-8')).hexdigest()
            hashed_codes.append(f"sha256$${hash_str}")

        self.recovery_codes = hashed_codes
        self.save(update_fields=['recovery_codes', 'updated_at'])
        return plain_codes

    def verify_and_consume_recovery_code(self, code: str) -> bool:
        """
        Verifica si un código coincide con alguno de los hashes almacenados.
        Si coincide, lo elimina de la lista (un solo uso) y retorna True.
        """
        if not self.recovery_codes:
            return False

        current_codes = list(self.recovery_codes)
        matched_index = -1

        for i, hashed_code in enumerate(current_codes):
            # Compatibilidad hacia atrás con los códigos guardados previamente con PBKDF2
            if hashed_code.startswith('pbkdf2_'):
                if check_password(code, hashed_code):
                    matched_index = i
                    break
            # Verificación rápida con el nuevo formato SHA-256
            elif hashed_code.startswith('sha256$$'):
                stored_hash = hashed_code.split('$$')[1]
                if hashlib.sha256(code.encode('utf-8')).hexdigest() == stored_hash:
                    matched_index = i
                    break

        if matched_index != -1:
            current_codes.pop(matched_index)
            self.recovery_codes = current_codes
            self.save(update_fields=['recovery_codes', 'updated_at'])
            return True

        return False