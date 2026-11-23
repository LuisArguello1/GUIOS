from typing import Optional
from ..models.otp import PasswordResetOTP


def get_active_otp_by_email(email: str) -> Optional[PasswordResetOTP]:
    """
    Obtiene el OTP activo y no verificado de un usuario por email.
    """
    return PasswordResetOTP.objects.filter(
        user__email__iexact=email.strip(),
        is_used=False,
        is_verified=False,
    ).first()


def get_verified_otp_by_email(email: str) -> Optional[PasswordResetOTP]:
    """
    Obtiene el OTP verificado y no usado de un usuario por email, pre-cargando el usuario.
    """
    return PasswordResetOTP.objects.select_related('user').filter(
        user__email__iexact=email.strip(),
        is_verified=True,
        is_used=False,
    ).first()
