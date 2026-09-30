import json
import logging
import nh3  # pip install nh3 (reemplaza a bleach, más seguro y rápido)
from django.http import QueryDict

logger = logging.getLogger(__name__)

class XSSSanitizationMiddleware:
    """
    Sanitiza inputs contra XSS en peticiones de escritura.
    Usa nh3 (basado en Rust/ammonia) en lugar de strip_tags para mayor robustez.
    
    ORDEN EN settings.py: Debe ir ANTES de los middlewares de autenticación.
    """

    # Campos que nunca deben sanitizarse (ej: campos de contraseña, tokens)
    SKIP_FIELDS = frozenset({'password', 'token', 'refresh', 'access', 'csrfmiddlewaretoken'})

    # Campos que contienen texto enriquecido (HTML) y necesitan conservar formato básico
    RICH_TEXT_FIELDS = frozenset({'observaciones', 'problematica_resuelta'})

    # Etiquetas HTML permitidas para campos de texto enriquecido (seguras contra XSS)
    ALLOWED_RICH_TEXT_TAGS = frozenset({
        'p', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'ul', 'ol', 'li', 'br'
    })

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ('POST', 'PUT', 'PATCH'):
            content_type = request.content_type or ''

            if 'application/json' in content_type:
                self._sanitize_json_body(request)
            elif request.POST:
                self._sanitize_form_data(request)

        return self.get_response(request)

    def _sanitize_json_body(self, request):
        if not request.body:
            return
        try:
            data = json.loads(request.body)
            sanitized = self._sanitize_recursive(data, request)
            request._body = json.dumps(sanitized, ensure_ascii=False).encode('utf-8')
        except json.JSONDecodeError:
            pass  # Dejar que el parser de DRF maneje el error
        except Exception:
            logger.exception("Error inesperado en sanitización JSON | Path: %s", request.path)

    def _sanitize_form_data(self, request):
        try:
            clean_post = request.POST.copy()
            for key in clean_post:
                if key in self.SKIP_FIELDS:
                    continue
                values = clean_post.getlist(key)
                clean_post.setlist(key, [
                    self._clean_string(v, key, request) if isinstance(v, str) else v
                    for v in values
                ])
            request.POST = clean_post
        except Exception:
            logger.exception("Error inesperado en sanitización Form | Path: %s", request.path)

    def _sanitize_recursive(self, data, request, _field_name='<root>'):
        if isinstance(data, dict):
            return {
                k: self._sanitize_recursive(v, request, k)
                if k not in self.SKIP_FIELDS
                else v
                for k, v in data.items()
            }
        elif isinstance(data, list):
            return [self._sanitize_recursive(item, request, _field_name) for item in data]
        elif isinstance(data, str):
            return self._clean_string(data, _field_name, request)
        return data

    def _clean_string(self, value: str, field_name: str, request) -> str:
        if field_name in self.RICH_TEXT_FIELDS:
            # nh3.clean permite sólo las etiquetas de formato seguro para texto enriquecido
            cleaned = nh3.clean(value, tags=self.ALLOWED_RICH_TEXT_TAGS)
        else:
            # nh3.clean con tags=set() elimina TODO el HTML de forma segura
            cleaned = nh3.clean(value, tags=set())

        if cleaned != value:
            logger.warning(
                "XSS bloqueado o HTML sanitizado | IP: %s | Path: %s | Field: %s",
                request.META.get('REMOTE_ADDR', 'unknown'),
                request.path,
                field_name,
                # ⚠️ Nunca loggear `value`: podría contener datos sensibles
            )
        return cleaned