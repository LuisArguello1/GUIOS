"""
Importancia Sugerida (IS).

IS = Matriz_Figura_5_10(IE, IL)
"""

from apps.guios.services.calculations.matrix import combine_importance


def calculate_suggested_importance(literature_importance: int, expert_importance: int) -> int:
    """
    Cruza la Importancia del Experto (fila) con la Importancia de la Literatura (columna).
    """
    return combine_importance(row_val=expert_importance, col_val=literature_importance)


calculate_systemic_importance = calculate_suggested_importance
