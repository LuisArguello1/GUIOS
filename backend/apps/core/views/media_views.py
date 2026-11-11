import os
import mimetypes
import logging
from django.conf import settings
from django.http import HttpResponse, JsonResponse, FileResponse
from apps.auth.authentication import CookieJWTAuthentication

logger = logging.getLogger(__name__)


def is_authenticated_user(request):
    """
    Verifica si la petición cuenta con un usuario autenticado mediante:
    1. Sesión activa estándar de Django (request.user.is_authenticated).
    2. Token JWT en cookie 'access_token' o header 'Authorization: Bearer <token>'
       procesado por CookieJWTAuthentication.
    """
    if getattr(request, 'user', None) and request.user.is_authenticated:
        return True, request.user

    try:
        authenticator = CookieJWTAuthentication()
        auth_result = authenticator.authenticate(request)
        if auth_result is not None:
            user, token = auth_result
            request.user = user
            return True, user
    except Exception as exc:
        logger.debug("Error validando autenticación en protected_media_view: %s", exc)

    return False, None


def protected_media_view(request, path=""):
    """
    Sirve archivos multimedia protegidos.
    - Si el usuario NO está autenticado: Retorna HTTP 401 Unauthorized.
    - Si el usuario ESTÁ autenticado:
      * Si está detrás de Nginx (cabecera X-Nginx-Proxy): delega a Nginx vía X-Accel-Redirect (/protected_media/...)
        para máximo rendimiento y bajo consumo de memoria.
      * En modo directo o desarrollo: sirve el archivo de forma segura vía FileResponse.
    """
    is_auth, user = is_authenticated_user(request)
    if not is_auth:
        return JsonResponse(
            {
                "detail": "No autenticado. Se requiere una sesión válida o token JWT para acceder a archivos multimedia privados.",
                "code": "authentication_required"
            },
            status=401
        )

    # Sanitización de ruta para prevenir ataques de Path Traversal
    clean_path = os.path.normpath(str(path).strip()).lstrip(r'/\.')
    media_root = os.path.abspath(str(settings.MEDIA_ROOT))
    full_path = os.path.abspath(os.path.join(media_root, clean_path))

    # Verificar que el archivo resultante pertenezca a MEDIA_ROOT
    if not full_path.startswith(media_root) or not os.path.isfile(full_path):
        return JsonResponse(
            {
                "detail": "El archivo multimedia solicitado no existe o no se encuentra disponible.",
                "code": "file_not_found"
            },
            status=404
        )

    # Determinar tipo MIME
    content_type, _ = mimetypes.guess_type(full_path)
    content_type = content_type or 'application/octet-stream'

    # Si la petición pasó por el proxy inverso Nginx con soporte X-Accel
    is_behind_nginx = bool(
        request.META.get('HTTP_X_NGINX_PROXY') or
        request.headers.get('x-nginx-proxy') or
        request.META.get('HTTP_X_ACCEL_SUPPORTED')
    )

    if is_behind_nginx:
        rel_path = os.path.relpath(full_path, media_root).replace('\\', '/')
        response = HttpResponse()
        response['X-Accel-Redirect'] = f'/protected_media/{rel_path}'
        response['Content-Type'] = content_type
        response['Content-Disposition'] = f'inline; filename="{os.path.basename(full_path)}"'
        response['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
        return response

    # Fallback seguro para entorno local / desarrollo sin Nginx
    return FileResponse(open(full_path, 'rb'), content_type=content_type)
