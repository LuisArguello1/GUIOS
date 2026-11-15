import logging
from email.mime.image import MIMEImage
from django.conf import settings
from django.db import transaction
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils.translation import gettext_lazy as _

from ..models.otp import PasswordResetOTP
from ..models.user import CustomUser
from ..selectors.otp import get_active_otp_by_email, get_verified_otp_by_email
from ..selectors.user import get_user_by_email

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Se lanza cuando falla el envío real del correo electrónico (SMTP/límite)."""


_EMAIL_DELIVERY_ERROR_MSG = (
    "No fue posible enviar el correo de recuperación. "
    "Verifica la configuración del servicio de correo o inténtalo más tarde."
)


def initiate_password_reset(email: str) -> bool:
    """
    Inicia el proceso de recuperación de contraseña enviando un código OTP.
    Lanza EmailDeliveryError si para un usuario activo falla la configuración SMTP,
    se excede el límite diario o falla el envío SMTP.
    """
    user = get_user_by_email(email)
    if not user or not user.is_active:
        # No revelamos si el email existe por seguridad
        return False

    email_backend = str(getattr(settings, 'EMAIL_BACKEND', '') or '').lower()
    if 'smtp' in email_backend:
        email_host = str(getattr(settings, 'EMAIL_HOST', '') or '').strip()
        from_email = str(getattr(settings, 'DEFAULT_FROM_EMAIL', '') or '').strip()
        if not email_host or not from_email:
            logger.error(
                "Configuración SMTP incompleta (EMAIL_HOST/DEFAULT_FROM_EMAIL). No se puede enviar OTP a %s",
                email,
            )
            raise EmailDeliveryError(_(_EMAIL_DELIVERY_ERROR_MSG))

    # Validar límite de correos diario antes de renderizar/enviar
    from apps.core.services.email_tracker import check_daily_email_limit, increment_daily_email_count
    if not check_daily_email_limit():
        logger.error(f"Límite diario de correos excedido. No se puede enviar OTP a {email}")
        raise EmailDeliveryError(_(_EMAIL_DELIVERY_ERROR_MSG))

    code = PasswordResetOTP.generate_code()

    # Contexto para el template de correo
    context = {
        'validation_code': code,
        'user': user,
        'site_url': settings.SITE_URL,
    }

    # Renderizar templates (HTML y texto plano)
    html_content = render_to_string('auth/password_reset_email.html', context)
    text_content = strip_tags(html_content)

    try:
        msg = EmailMultiAlternatives(
            subject=_('Código de recuperación - GUIOS'),
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email]
        )
        msg.attach_alternative(html_content, "text/html")

        # Adjuntar logo corporativo como inline MIME (MIMEImage con Content-ID)
        logo_path = None
        for candidate in ['Logotipo.png', 'Isotipo.png', 'Logotipo.webp', 'Isotipo.webp']:
            p = settings.BASE_DIR / 'static' / 'img' / candidate
            if p.exists():
                logo_path = p
                break

        if logo_path:
            with open(logo_path, 'rb') as f:
                logo_data = f.read()
            mime_image = MIMEImage(logo_data)
            mime_image.add_header('Content-ID', '<logo_dvi>')
            mime_image.add_header('Content-Disposition', 'inline', filename=logo_path.name)
            msg.attach(mime_image)
        else:
            logger.debug(f"Logo de correo no disponible en {settings.BASE_DIR / 'static' / 'img'}")

        sent_count = msg.send(fail_silently=False)
        if not sent_count:
            raise EmailDeliveryError(_(_EMAIL_DELIVERY_ERROR_MSG))

        # Incrementar el contador diario en Redis
        increment_daily_email_count()

        # Solo guardamos el OTP si el correo se envió con éxito
        with transaction.atomic():
            # Invalidar códigos anteriores del usuario
            PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
            PasswordResetOTP.objects.create(user=user, code=code)

        return True

    except EmailDeliveryError:
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
        raise
    except Exception as e:
        logger.error(f"Error enviando correo de recuperación a {email}: {e}")
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
        raise EmailDeliveryError(_(_EMAIL_DELIVERY_ERROR_MSG)) from e


def verify_reset_code(email: str, code: str) -> bool:
    """
    Verifica que el código OTP proporcionado sea válido y no haya expirado.
    """
    otp = get_active_otp_by_email(email)

    if not otp:
        return False

    if otp.is_expired:
        otp.is_used = True
        otp.save(update_fields=['is_used'])
        return False

    if otp.code != code:
        return False

    otp.is_verified = True
    otp.save(update_fields=['is_verified'])
    return True


def complete_password_reset(email: str, code: str, new_password: str) -> bool:
    """
    Completa el cambio de contraseña tras la verificación del código.
    """
    otp = get_verified_otp_by_email(email)

    if not otp:
        return False

    if otp.is_expired:
        otp.is_used = True
        otp.save(update_fields=['is_used'])
        return False

    if otp.code != code:
        return False

    user = otp.user

    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=['password'])
        
        # Marcar el código como usado
        PasswordResetOTP.objects.filter(user=user).update(is_used=True)

    logger.info(f"Contraseña restablecida exitosamente para {email}")
    return True