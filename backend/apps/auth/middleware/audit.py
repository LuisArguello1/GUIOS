import uuid
from asgiref.local import Local

# Contexto local por hilo/corutina (compatible con ASGI y WSGI)
_thread_locals = Local()

_UNSET = object()


def set_audit_context(*, user=_UNSET, request_id=_UNSET, ip_address=_UNSET, user_agent=_UNSET, session_key=_UNSET):
    """Actualiza el contexto de auditoría para la request activa."""
    if user is not _UNSET:
        _thread_locals.user = user
    if request_id is not _UNSET:
        _thread_locals.request_id = request_id
    if ip_address is not _UNSET:
        _thread_locals.ip_address = ip_address
    if user_agent is not _UNSET:
        _thread_locals.user_agent = user_agent
    if session_key is not _UNSET:
        _thread_locals.session_key = session_key


def clear_audit_context():
    """Limpia el contexto de auditoría para evitar fugas entre requests."""
    for attr in ('user', 'request_id', 'ip_address', 'user_agent', 'session_key'):
        try:
            delattr(_thread_locals, attr)
        except AttributeError:
            pass


def get_current_user():
    """Retorna el usuario capturado de la petición actual."""
    return getattr(_thread_locals, 'user', None)


def get_audit_context():
    """Retorna el contexto completo de auditoría capturado en la petición actual."""
    return {
        'user': getattr(_thread_locals, 'user', None),
        'request_id': getattr(_thread_locals, 'request_id', None),
        'ip_address': getattr(_thread_locals, 'ip_address', None),
        'user_agent': getattr(_thread_locals, 'user_agent', ''),
        'session_key': getattr(_thread_locals, 'session_key', ''),
    }


class AuditMiddleware:
    """
    Middleware que captura el contexto de la petición entrante y lo guarda
    temporalmente para que las señales de auditoría puedan acceder a él.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Generar o recuperar ID de request (X-Request-ID es estándar en muchos balanceadores)
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        
        # Obtener IP real (considerando proxies)
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')

        # Asignar contexto antes de procesar la petición.
        # DRF puede autenticar después del middleware, por eso el autenticador
        # actualiza el usuario real más adelante cuando corresponde.
        set_audit_context(
            user=request.user if request.user.is_authenticated else None,
            request_id=request_id,
            ip_address=ip_address,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            session_key=getattr(request.session, 'session_key', '') or '',
        )

        try:
            response = self.get_response(request)
            # Devolver el ID en la respuesta para facilitar el soporte técnico
            if isinstance(request_id, str):
                response['X-Request-ID'] = request_id
        finally:
            # Limpiar para evitar fugas de memoria o datos entre peticiones
            clear_audit_context()

        return response