import logging
import uuid
from typing import Dict, Optional

from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


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