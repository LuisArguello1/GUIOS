"""
apps/guios/services/reports/excel_security.py
─────────────────────────────────────────────────────────────────────────────
Utilidad para neutralizar inyección de fórmulas en celdas de reportes Excel.
"""

_FORMULA_TRIGGER_PREFIXES = ("=", "+", "-", "@")
_CONTROL_TRIGGER_PREFIXES = ("\t", "\r")


def sanitize_excel_value(value):
    """
    Escapa cadenas cuyo contenido pueda interpretarse como fórmula en Excel/Calc
    anteponiendo una comilla simple ('). Respeta valores numéricos y None.
    """
    if not isinstance(value, str) or not value:
        return value

    if value.startswith(_CONTROL_TRIGGER_PREFIXES) or value.lstrip(" \t\r\n").startswith(
        _FORMULA_TRIGGER_PREFIXES
    ):
        return f"'{value}"

    return value
