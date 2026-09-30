"""
core/services/email_tracker.py
─────────────────────────────────────────────────────────────────────────────
Tracking en tiempo real de la cuota diaria de correos (SMTP) usando el motor
de caché (Redis). El reinicio diario es 100% automático y orgánico:

- La clave de caché incluye la fecha local (`emails_sent_count:YYYY-MM-DD`).
  Al cambiar de día, se consulta/crea una clave nueva que arranca en 0/1.
- Cada clave nueva recibe un TTL de 36 horas: Redis libera la memoria sin
  necesidad de tareas de mantenimiento (cron jobs) a la medianoche.
"""
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone


def _get_cache_key() -> str:
    """
    Genera una clave única para el día de hoy basada en la zona horaria local.
    Ejemplo: 'emails_sent_count:2026-06-25'
    """
    hoy = timezone.localdate().isoformat()
    return f"emails_sent_count:{hoy}"


def check_daily_email_limit() -> bool:
    """
    Retorna True si la cuota diaria aún no se ha alcanzado.
    Se consulta antes de realizar cualquier envío.
    """
    limit = getattr(settings, 'DAILY_EMAIL_LIMIT', 500)
    current_count = cache.get(_get_cache_key(), 0)
    return current_count < limit


def increment_daily_email_count():
    """
    Incrementa de forma atómica (+1) el contador en Redis.
    Si es el primer correo del día, crea la clave e introduce un TTL de 36 horas.
    """
    key = _get_cache_key()
    # cache.add retorna True si la llave no existía y se creó con éxito.
    if cache.add(key, 1, timeout=36 * 3600):
        # La clave fue creada con valor 1.
        pass
    else:
        # Si la llave ya existía, la incrementa de forma atómica previniendo
        # condiciones de carrera.
        cache.incr(key)


def get_daily_email_stats() -> dict:
    """
    Retorna estadísticas de envío del día para ser consumidas por el frontend.
    """
    limit = getattr(settings, 'DAILY_EMAIL_LIMIT', 500)
    current_count = cache.get(_get_cache_key(), 0)
    return {
        "enviados": current_count,
        "limite": limit,
        "disponibles": max(0, limit - current_count),
    }
