import logging
import uuid
from typing import Dict, Optional

from django.conf import settings
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


def get_session_idle_timeout_seconds() -> int:
    """Retorna el tiempo máximo de inactividad configurado para sesiones (en segundos)."""
    return int(getattr(settings, 'SESSION_IDLE_TIMEOUT_SECONDS', 30 * 60))


def _session_activity_key(sid: str) -> str:
    return f"auth_session_active:{sid}"


def touch_session_activity(sid: Optional[str]) -> None:
    """Registra o renueva la marca de actividad de una sesión lógica (`sid`) en caché."""
    if not sid:
        return
    timeout = get_session_idle_timeout_seconds()
    if timeout <= 0:
        return
    cache.set(_session_activity_key(sid), 1, timeout=timeout)


def is_session_active(sid: Optional[str]) -> bool:
    """Verifica si el `sid` sigue activo dentro de la ventana de inactividad."""
    if not sid:
        return True
    timeout = get_session_idle_timeout_seconds()
    if timeout <= 0:
        return True
    return bool(cache.get(_session_activity_key(sid)))


def revoke_session_activity(sid: Optional[str]) -> None:
    """Invalida inmediatamente la sesión lógica (`sid`) en caché."""
    if not sid:
        return
    cache.delete(_session_activity_key(sid))


def get_auth_tokens(user, sid: Optional[str] = None) -> Dict[str, str]:
    """
    Genera access y refresh tokens JWT con un SID (Session ID) persistente.
    Este SID permite la revocación de la sesión lógica incluso tras refrescos.
    """
    if not sid:
        sid = str(uuid.uuid4())

    refresh = RefreshToken.for_user(user)
    refresh['email'] = user.email
    refresh['username'] = user.username
    refresh['sid'] = sid  # Identificador de sesión persistente

    touch_session_activity(sid)

    return {
        'sid': sid,
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def set_auth_cookies(response, tokens: Dict[str, str]) -> None:
    """
    Establece los tokens JWT como HttpOnly cookies en la respuesta HTTP.
    """
    access_token = tokens.get('access')
    refresh_token = tokens.get('refresh')

    if not access_token or not refresh_token:
        logger.error("set_auth_cookies: Se intentaron establecer cookies con tokens vacíos.")
        return

    access_seconds = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    refresh_seconds = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())

    # Determinar si la cookie debe ser segura (HTTPS) según configuración
    is_secure = getattr(settings, 'JWT_COOKIE_SECURE', not settings.DEBUG)
    
    # Cookie del Access Token
    response.set_cookie(
        key='access_token',
        value=access_token,
        max_age=access_seconds,
        secure=is_secure,
        httponly=True,
        samesite='Lax',
        path='/',
    )

    # Cookie del Refresh Token
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        max_age=refresh_seconds,
        secure=is_secure,
        httponly=True,
        samesite='Lax',
        path='/',
    )


def clear_auth_cookies(response) -> None:
    """Elimina las cookies de autenticación al cerrar sesión."""
    for cookie in ('access_token', 'refresh_token', 'sessionid', 'csrftoken'):
        response.delete_cookie(cookie, path='/')