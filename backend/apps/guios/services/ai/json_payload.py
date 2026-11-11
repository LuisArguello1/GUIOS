"""
Validación compartida de las respuestas JSON de los proveedores externos.

Un objeto vacío o un JSON cortado no es una sugerencia válida: debe
propagar la excepción para que el orquestador pase al siguiente nivel.
"""
import json
from typing import Any

from .verdict_narrative import parse_verdict_narrative


def require_json_object(content: str | None, provider_name: str) -> dict[str, Any]:
    """Exige un objeto JSON con al menos un campo."""
    text = (content or "").strip()
    if not text:
        raise ValueError(f"{provider_name} devolvió contenido vacío.")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{provider_name} devolvió JSON inválido.") from exc
    if not isinstance(data, dict) or not data:
        raise ValueError(f"{provider_name} devolvió un objeto JSON vacío.")
    return data


def require_completion_content(choice: Any, provider_name: str) -> dict[str, Any]:
    """Lee el mensaje de un chat completion y rechaza el corte por longitud."""
    if getattr(choice, "finish_reason", None) == "length":
        raise ValueError(
            f"{provider_name} alcanzó el tope de tokens antes de cerrar el JSON."
        )
    message = getattr(choice, "message", None)
    content = getattr(message, "content", None) if message is not None else None
    return require_json_object(content, provider_name)


def require_choice(data: dict[str, Any], keys: tuple[str, ...], provider_name: str, label: str) -> int:
    """Lee un entero presente en la respuesta, sin sustituirlo por un valor de catálogo."""
    for key in keys:
        raw = data.get(key)
        if raw is None or raw == "":
            continue
        try:
            return int(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{provider_name} devolvió {label} no numérico.") from exc
    raise ValueError(f"{provider_name} no devolvió {label}.")


def require_justification(data: dict[str, Any], provider_name: str) -> str:
    """Exige un texto de justificación. Una cadena vacía no detiene la cascada como éxito."""
    for key in ("justification", "justificacion", "explanation", "explicacion"):
        value = str(data.get(key) or "").strip()
        if value:
            return value
    raise ValueError(f"{provider_name} no devolvió justificación.")


def clamp_scale(value: int) -> int:
    """Escala metodológica GUIOS de 1 a 4."""
    return max(1, min(4, value))


def require_verdict_text(data: dict[str, Any] | None, provider_name: str) -> dict[str, str]:
    """El dictamen necesita los dos campos. Si falta uno, el siguiente nivel debe intentarlo."""
    parsed = parse_verdict_narrative(data)
    if not parsed["executive_summary"] or not parsed["mitigation_plan"]:
        raise ValueError(f"{provider_name} devolvió un dictamen incompleto.")
    return parsed
