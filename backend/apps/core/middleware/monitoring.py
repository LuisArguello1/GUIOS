import uuid
import time
import logging
from django.conf import settings
from django.http import JsonResponse, Http404
from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError

logger = logging.getLogger(__name__)


class RequestTraceMiddleware:
    """
    Asigna un ID único a cada petición para trazabilidad (Forensics).
    Respeta el X-Request-ID entrante si ya fue asignado por un gateway/proxy.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Respetar el ID del gateway/proxy si existe, si no generar uno nuevo
        request_id = request.META.get('HTTP_X_REQUEST_ID') or str(uuid.uuid4())
        request.request_id = request_id

        logger.debug(
            "REQUEST START | %s %s | ID: %s",
            request.method,
            request.path,
            request_id,
        )

        response = self.get_response(request)

        response['X-Request-ID'] = request_id
        return response


class PerformanceSecurityMiddleware:
    """
    Detecta peticiones lentas que podrían indicar DoS o cuellos de botella.

    Configurable en settings.py:
        SLOW_REQUEST_WARNING_SECONDS  (default: 3.0)
        SLOW_REQUEST_CRITICAL_SECONDS (default: 10.0)
    """

    def __init__(self, get_response):
        self.get_response = get_response
        # Leer thresholds una sola vez en init (no en cada request)
        self.warning_threshold = float(
            getattr(settings, 'SLOW_REQUEST_WARNING_SECONDS', 3.0)
        )
        self.critical_threshold = float(
            getattr(settings, 'SLOW_REQUEST_CRITICAL_SECONDS', 10.0)
        )

    def __call__(self, request):
        # time.monotonic() es inmune a cambios del reloj del sistema
        start_time = time.monotonic()

        response = self.get_response(request)

        duration = time.monotonic() - start_time

        if request.path.startswith('/api/'):
            self._log_if_slow(request, duration, response.status_code)

        return response

    def _log_if_slow(self, request, duration: float, status_code: int):
        if duration <= self.warning_threshold:
            return

        # Solo loggear user.id, nunca email u otros datos PII
        user_id = request.user.id if request.user.is_authenticated else "anonymous"

        log_data = (
            "PETICIÓN LENTA | Path: %s | Duración: %.2fs | "
            "Status: %s | UserID: %s | ReqID: %s",
            request.path,
            duration,
            status_code,
            user_id,
            getattr(request, 'request_id', 'N/A'),
        )

        if duration > self.critical_threshold:
            logger.critical(*log_data)
        else:
            logger.warning(*log_data)

class GlobalExceptionMiddleware:
    """
    Captura excepciones no manejadas, genera logs con trazabilidad
    y evita fuga de información sensible en producción.

    ORDEN en settings.py: Debe ser el PRIMERO en MIDDLEWARE.
    """

    _DJANGO_HANDLED = (Http404, PermissionDenied)

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except self._DJANGO_HANDLED:
            raise
        except DjangoValidationError as exc:
            return self._handle_validation_error(request, exc)
        except Exception as exc:
            return self._handle_exception(request, exc)

    def _handle_validation_error(self, request, exc: DjangoValidationError):
        """
        Captura errores de validación de modelos (Cédula, RUC, etc) 
        y los devuelve como 400 Bad Request formateados para el cliente.
        """
        request_id = getattr(request, 'request_id', 'N/A')
        
        # Obtener el diccionario de errores de forma segura
        if hasattr(exc, 'message_dict'):
            errors = exc.message_dict
        elif hasattr(exc, 'messages'):
            errors = {'detail': exc.messages}
        else:
            errors = {'detail': str(exc)}

        logger.warning(
            "ERROR DE VALIDACIÓN | Path: %s | ReqID: %s | Errores: %s",
            request.path, request_id, errors
        )

        return JsonResponse(
            {
                'detail': 'Error de validación en los datos ingresados.',
                'errors': errors,
                'code': 'validation_error',
                'request_id': request_id,
            },
            status=400,
        )

    def _handle_exception(self, request, exc: Exception):
        request_id = getattr(request, 'request_id', 'N/A')
        user_id = (
            request.user.id
            if hasattr(request, 'user') and request.user.is_authenticated
            else 'anonymous'
        )

        import traceback
        traceback.print_exc()

        logger.exception(
            "ERROR NO MANEJADO | Path: %s | Method: %s | "
            "ReqID: %s | UserID: %s | Tipo: %s | Detalle: %s",
            request.path,
            request.method,
            request_id,
            user_id,
            type(exc).__name__,
            str(exc),
        )

        if settings.DEBUG:
            raise

        return JsonResponse(
            {
                'detail': f'Error inesperado: {str(exc)}',
                'error': str(exc),
                'request_id': request_id,
                'code': 'internal_server_error',
            },
            status=500,
        )