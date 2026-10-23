"""
Proveedor real: Anthropic (decisión P8). Claude Haiku para las sugerencias y
Claude Sonnet para el informe, configurables en el .env. La clave nunca sale del
servidor ni se registra.
"""
import json

from .provider import (
    TASK_REPORT,
    AIInvalidResponse,
    AIProviderError,
    AITimeout,
    ProveedorIA,
)

MAX_TOKENS = 16000
EFFORT = {TASK_REPORT: 'medium'}
DEFAULT_EFFORT = 'low'


class AnthropicProvider(ProveedorIA):

    def __init__(self, *, api_key: str, suggestion_model: str, report_model: str, timeout: float):
        self._api_key = api_key
        self.suggestion_model = suggestion_model
        self.report_model = report_model
        self.timeout = timeout

    def model_for(self, task):
        return self.report_model if task == TASK_REPORT else self.suggestion_model

    def complete(self, *, task, system, payload, schema):
        import anthropic

        # Sin reintentos: el tiempo total no supera GUIOS_AI_TIMEOUT.
        client = anthropic.Anthropic(api_key=self._api_key, timeout=self.timeout, max_retries=0)
        try:
            response = client.messages.create(
                model=self.model_for(task),
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}],
                output_config={
                    'effort': EFFORT.get(task, DEFAULT_EFFORT),
                    'format': {'type': 'json_schema', 'schema': schema},
                },
            )
        except anthropic.APITimeoutError as exc:
            raise AITimeout("El servicio de IA no respondió a tiempo.") from exc
        except anthropic.APIStatusError as exc:
            raise AIProviderError(f"El servicio de IA respondió con error {exc.status_code}.") from exc
        except anthropic.APIError as exc:
            raise AIProviderError("No se pudo conectar con el servicio de IA.") from exc

        if response.stop_reason != 'end_turn':
            raise AIInvalidResponse(f"Respuesta incompleta (stop_reason: {response.stop_reason}).")
        text = next((block.text for block in response.content if block.type == 'text'), None)
        try:
            return json.loads(text)
        except (TypeError, ValueError) as exc:
            raise AIInvalidResponse("La respuesta no es JSON.") from exc
