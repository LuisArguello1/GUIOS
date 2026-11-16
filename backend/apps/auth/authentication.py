import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from .middleware.audit import set_audit_context
from .services.auth import is_session_active, touch_session_activity

logger = logging.getLogger(__name__)


class CookieJWTAuthentication(JWTAuthentication):
    """
    Autenticación JWT que extrae el token del header Authorization o de la cookie 'access_token'.
    """

    def _finalize_authentication(self, request, user, validated_token):
        set_audit_context(user=user)
        return user, validated_token

    def authenticate(self, request):
        header = self.get_header(request)
        raw_token = self.get_raw_token(header) if header is not None else request.COOKIES.get('access_token')

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            logger.warning(
                "CookieJWTAuthentication: Token inválido detectado. Cookie presente: %s",
                bool(request.COOKIES.get('access_token')),
            )
            return None

        sid = validated_token.get('sid') if hasattr(validated_token, 'get') else None
        if sid and not is_session_active(sid):
            logger.warning(
                "CookieJWTAuthentication: Sesión expirada por inactividad o revocada | sid=%s",
                sid,
            )
            return None

        # El sondeo silencioso de permisos (?background=1) no debe extender la ventana de inactividad.
        is_background_poll = (
            request.path.rstrip('/').endswith('/users/me')
            and request.GET.get('background') == '1'
        )
        if sid and not is_background_poll:
            touch_session_activity(sid)

        user = self.get_user(validated_token)
        return self._finalize_authentication(request, user, validated_token)