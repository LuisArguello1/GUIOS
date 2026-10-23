"""
Asistencia de IA de GUIOS (Paso 9). Opcional: sin ANTHROPIC_API_KEY en el .env,
get_provider() devuelve None y la IA queda desactivada sin errores. La IA solo
sugiere; nunca rellena valores ni participa en el dictamen (RN-05, RN-14).
"""
from django.conf import settings


def get_provider():
    if not settings.ANTHROPIC_API_KEY:
        return None
    from .anthropic_provider import AnthropicProvider

    return AnthropicProvider(
        api_key=settings.ANTHROPIC_API_KEY,
        suggestion_model=settings.GUIOS_AI_SUGGESTION_MODEL,
        report_model=settings.GUIOS_AI_REPORT_MODEL,
        timeout=settings.GUIOS_AI_TIMEOUT,
    )


def is_available() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)
