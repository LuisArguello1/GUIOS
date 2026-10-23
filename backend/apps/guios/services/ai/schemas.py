"""
Esquemas JSON de las respuestas de la IA y su validación (RF-IA-06).

Los esquemas se envían al proveedor (salida estructurada) y además se validan
aquí con jsonschema, porque el backend no confía en la respuesta. Los límites de
largo y la coincidencia exacta de ids se comprueban en Python (la salida
estructurada no admite maxLength). Si algo falla, la respuesta entera se descarta.
"""
import jsonschema

from .provider import AIInvalidResponse

MAX_JUSTIFICATION = 500
MAX_SUMMARY = 6000
MAX_MITIGATION = 8000
NEGATIVE_RECOMMENDATIONS = ('B', 'C')


def _suggestions_schema(id_field):
    return {
        'type': 'object',
        'properties': {
            'suggestions': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        id_field: {'type': 'integer'},
                        'value': {'type': 'integer', 'enum': [1, 2, 3, 4]},
                        'justification': {'type': 'string'},
                    },
                    'required': [id_field, 'value', 'justification'],
                    'additionalProperties': False,
                },
            },
        },
        'required': ['suggestions'],
        'additionalProperties': False,
    }


IMPORTANCE_SCHEMA = _suggestions_schema('factor_id')
RATING_SCHEMA = _suggestions_schema('subfactor_id')
REPORT_SCHEMA = {
    'type': 'object',
    'properties': {
        'executive_summary': {'type': 'string'},
        'mitigation_plan': {'type': 'string'},
    },
    'required': ['executive_summary', 'mitigation_plan'],
    'additionalProperties': False,
}


def _check_schema(data, schema):
    try:
        jsonschema.validate(data, schema)
    except jsonschema.ValidationError as exc:
        raise AIInvalidResponse(f"La respuesta no cumple el esquema: {exc.message[:200]}") from exc


def _text(value, limit, label):
    text = value.strip()
    if not text:
        raise AIInvalidResponse(f"{label} vacío.")
    if len(text) > limit:
        raise AIInvalidResponse(f"{label} supera {limit} caracteres.")
    return text


def validate_suggestions(data, schema, id_field, expected_ids) -> dict:
    """Devuelve {id: (valor 1-4, justificación)} con exactamente los ids pedidos."""
    _check_schema(data, schema)
    result = {}
    for item in data['suggestions']:
        key = item[id_field]
        if key in result:
            raise AIInvalidResponse(f"{id_field} {key} repetido.")
        result[key] = (item['value'], _text(item['justification'], MAX_JUSTIFICATION, "Justificación"))
    if set(result) != set(expected_ids):
        raise AIInvalidResponse("La respuesta no trae exactamente los elementos pedidos.")
    return result


def validate_report(data, recommendation) -> tuple[str, str]:
    """Resumen siempre; plan de mitigación obligatorio en B y C, descartado en A."""
    _check_schema(data, REPORT_SCHEMA)
    summary = _text(data['executive_summary'], MAX_SUMMARY, "Resumen ejecutivo")
    if recommendation not in NEGATIVE_RECOMMENDATIONS:
        return summary, ''
    return summary, _text(data['mitigation_plan'], MAX_MITIGATION, "Plan de mitigación")
