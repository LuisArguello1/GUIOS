import logging
from django.http import JsonResponse
from django.conf import settings

logger = logging.getLogger(__name__)


class SessionSecurityMiddleware:
    """
    Verifica que la cuenta del usuario autenticado esté activa
    y añade security headers a respuestas de API.
    """

    _SECURITY_HEADERS = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'",
    }
    _HSTS_HEADER = 'max-age=31536000; includeSubDomains; preload'

    # Swagger UI y ReDoc (servidos con drf-spectacular-sidecar desde /static/)
    # necesitan estilos en línea, imágenes data: y un worker blob:. Ningún script
    # externo ni en línea: Swagger usa SpectacularSwaggerSplitView. Solo aplica a
    # estas rutas; el resto de /api/ conserva default-src 'self'.
    _DOCS_PATHS = ('/api/docs/', '/api/redoc/')
    _DOCS_CSP = (
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        "worker-src 'self' blob:; frame-ancestors 'none'"
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        early_response = self._check_user_security(request)
        if early_response:
            return early_response

        response = self.get_response(request)
        self._inject_security_headers(response, request)
        return response

    def _check_user_security(self, request):
        """Retorna JsonResponse si el usuario está inactivo, None si todo está bien."""
        if not request.user.is_authenticated:
            return None

        # Usuario desactivado administrativamente
        if not request.user.is_active:
            logger.warning(
                "Acceso denegado a cuenta inactiva | Usuario: %s | IP: %s",
                request.user.email,
                request.META.get('REMOTE_ADDR'),
            )
            return JsonResponse(
                {'detail': 'Tu cuenta ha sido desactivada.', 'code': 'user_inactive'},
                status=403,
            )

        return None

    def _inject_security_headers(self, response, request):
        if not request.path.startswith('/api/'):
            return
        for header, value in self._SECURITY_HEADERS.items():
            response[header] = value
        if request.path in self._DOCS_PATHS:
            response['Content-Security-Policy'] = self._DOCS_CSP
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = self._HSTS_HEADER