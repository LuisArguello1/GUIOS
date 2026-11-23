import io
import logging
from email.mime.image import MIMEImage
from pathlib import Path
from django.conf import settings
from django.db import transaction
from django.core.mail import EmailMultiAlternatives, send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils.translation import gettext_lazy as _

from ..models.otp import PasswordResetOTP
from ..selectors.otp import get_active_otp_by_email, get_verified_otp_by_email
from ..selectors.user import get_user_by_email

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Se lanza cuando falla el envío real del correo electrónico (SMTP/límite)."""


_EMAIL_DELIVERY_ERROR_MSG = (
    "No fue posible enviar el correo de recuperación. "
    "Verifica la configuración del servicio de correo o inténtalo más tarde."
)


def _resolve_from_email() -> str:
    """Resuelve el remitente evitando valores vacíos o el placeholder del .env.example."""
    raw_from = str(getattr(settings, 'DEFAULT_FROM_EMAIL', '') or '').strip()
    if not raw_from or raw_from == 'tucorreo@gmail.com':
        raw_from = str(getattr(settings, 'EMAIL_HOST_USER', '') or '').strip()
    return raw_from


def _build_inline_logo_mime(logo_path: Path) -> MIMEImage | None:
    """Genera un MIMEImage liviano (máx. 96x96 PNG) sin bloquear el envío ante errores."""
    try:
        from PIL import Image

        with Image.open(logo_path) as img:
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGBA')
            img.thumbnail((96, 96))
            buf = io.BytesIO()
            img.save(buf, format='PNG', optimize=True)
            logo_bytes = buf.getvalue()
        mime_image = MIMEImage(logo_bytes, _subtype='png')
        mime_image.add_header('Content-ID', '<logo_dvi>')
        mime_image.add_header('Content-Disposition', 'inline', filename='logo.png')
        return mime_image
    except Exception as exc:
        logger.warning("No se pudo adjuntar el logotipo inline al correo de recuperación: %s", exc)
        return None


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

    from_email = _resolve_from_email()
    email_backend = str(getattr(settings, 'EMAIL_BACKEND', '') or '').lower()
    if 'smtp' in email_backend:
        email_host = str(getattr(settings, 'EMAIL_HOST', '') or '').strip()
        if not email_host or not from_email:
            logger.error(
                "Configuración SMTP incompleta (EMAIL_HOST=%r, FROM=%r). No se puede enviar OTP a %s",
                email_host,
                from_email,
                user.email,
            )
            raise EmailDeliveryError(_(_EMAIL_DELIVERY_ERROR_MSG))

    # Validar límite de correos diario antes de renderizar/enviar
    from apps.core.services.email_tracker import check_daily_email_limit, increment_daily_email_count
    if not check_daily_email_limit():
        logger.error("Límite diario de correos excedido. No se puede enviar OTP a %s", user.email)
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
    subject = str(_('Código de recuperación - GUIOS'))

    try:
        sent_count = 0
        multipart_exc: Exception | None = None
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=from_email,
                to=[user.email],
            )
            msg.attach_alternative(html_content, "text/html")

            for candidate in ['Logotipo.png', 'Isotipo.png', 'Logotipo.webp', 'Isotipo.webp']:
                p = settings.BASE_DIR / 'static' / 'img' / candidate
                if p.exists():
                    mime_image = _build_inline_logo_mime(p)
                    if mime_image is not None:
                        msg.attach(mime_image)
                    break

            sent_count = msg.send(fail_silently=False)
        except Exception as exc:
            multipart_exc = exc
            logger.warning(
                "Fallo envío multipart de OTP a %s; reintentando con send_mail plano: %s",
                user.email,
                exc,
                exc_info=True,
            )
            sent_count = send_mail(
                subject=subject,
                message=text_content,
                from_email=from_email,
                recipient_list=[user.email],
                fail_silently=False,
            )

        if not sent_count:
            if multipart_exc is not None:
                raise multipart_exc
            raise EmailDeliveryError(_(_EMAIL_DELIVERY_ERROR_MSG))

        # Guardamos el OTP únicamente si el correo se envió con éxito
        with transaction.atomic():
            PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
            PasswordResetOTP.objects.create(user=user, code=code)

        # Incrementar contador diario en caché sin invalidar un correo ya enviado
        increment_daily_email_count()
        return True

    except EmailDeliveryError:
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
        raise
    except Exception as e:
        logger.exception("Error enviando correo de recuperación a %s: %s", user.email, e)
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