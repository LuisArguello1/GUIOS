import secrets
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from datetime import timedelta

OTP_EXPIRY_MINUTES = getattr(settings, 'OTP_EXPIRY_MINUTES', 10)


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_otps',
        verbose_name=_('usuario'),
    )
    code = models.CharField(_('código'), max_length=6)
    created_at = models.DateTimeField(_('creado el'), auto_now_add=True)
    is_used = models.BooleanField(_('utilizado'), default=False)
    is_verified = models.BooleanField(_('verificado'), default=False)

    class Meta:
        verbose_name = _('OTP de restablecimiento')
        verbose_name_plural = _('OTPs de restablecimiento')
        ordering = ['-created_at']
        indexes = [
            # CORRECCIÓN: índice compuesto para el filtro más frecuente en los servicios
            models.Index(fields=['user', 'is_used'], name='otp_user_is_used_idx'),
        ]

    def __str__(self):
        if self.is_used:
            estado = 'Usado'
        elif self.is_verified:
            estado = 'Verificado'
        else:
            estado = 'Pendiente'
        return f"{self.user.email} - {self.code} ({estado})"

    @property
    def is_expired(self) -> bool:
        """Verifica si el código ha expirado según OTP_EXPIRY_MINUTES."""
        return timezone.now() > self.created_at + timedelta(minutes=OTP_EXPIRY_MINUTES)

    @staticmethod
    def generate_code() -> str:
        """
        Genera un código numérico de 6 dígitos criptográficamente seguro.

        CORRECCIÓN: se reemplaza random.choices (PRNG predecible) por
        secrets.choice (CSPRNG), que usa la fuente de entropía del SO
        y no puede ser predicho por un atacante aunque conozca el timestamp.
        """
        return ''.join(secrets.choice('0123456789') for _ in range(6))