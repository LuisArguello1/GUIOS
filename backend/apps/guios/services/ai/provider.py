"""
Interfaz del proveedor de IA (RNF-13). El resto de GUIOS solo conoce esta
interfaz y sus errores; cambiar de proveedor o de modelo no toca los pasos de la
evaluación ni el motor de cálculo.
"""
from abc import ABC, abstractmethod

TASK_SUGGESTION = 'suggestion'   # Pasos 1-4: sugerir ID y calificaciones
TASK_REPORT = 'report'           # Tras el dictamen: resumen ejecutivo y mitigación


class AIError(Exception):
    """Falla del servicio de IA; la evaluación sigue en modo manual (RF-IA-05)."""
    code = 'ai_error'
    status = 'error'


class AIProviderError(AIError):
    """El proveedor respondió con error o no se pudo conectar."""


class AITimeout(AIError):
    """El proveedor superó GUIOS_AI_TIMEOUT."""
    code = 'ai_timeout'
    status = 'timeout'


class AIInvalidResponse(AIError):
    """La respuesta no cumple el formato esperado y se descarta (RF-IA-06)."""
    code = 'ai_invalid_response'


class ProveedorIA(ABC):

    @abstractmethod
    def model_for(self, task: str) -> str:
        """Modelo que se usa para la tarea (solo para el registro)."""

    @abstractmethod
    def complete(self, *, task: str, system: str, payload: dict, schema: dict):
        """
        Envía el payload como JSON y devuelve la respuesta ya decodificada.
        Lanza AITimeout, AIProviderError o AIInvalidResponse. La validación
        de negocio la hace el servicio, no el proveedor.
        """
