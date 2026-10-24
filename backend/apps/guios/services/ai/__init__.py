from .base import BaseAIProvider
from .groq_provider import GroqAIProvider
from .cohere_provider import CohereAIProvider
from .heuristic_provider import HeuristicAIProvider
from .manager import AIService, ai_service
from django.conf import settings


def get_provider():
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return None
    from .anthropic_provider import AnthropicProvider

    return AnthropicProvider(
        api_key=api_key,
        suggestion_model=getattr(settings, 'GUIOS_AI_SUGGESTION_MODEL', 'claude-3-5-haiku-20241022'),
        report_model=getattr(settings, 'GUIOS_AI_REPORT_MODEL', 'claude-3-5-sonnet-20241022'),
        timeout=getattr(settings, 'GUIOS_AI_TIMEOUT', 30),
    )


def is_available() -> bool:
    return bool(getattr(settings, 'ANTHROPIC_API_KEY', ''))


__all__ = [
    'BaseAIProvider',
    'GroqAIProvider',
    'CohereAIProvider',
    'HeuristicAIProvider',
    'AIService',
    'ai_service',
    'get_provider',
    'is_available',
]
