"""
Importancia Relativa (IR) y filtro de relevancia.

IR = Matriz_Figura_5_10(ID, IS)
es_relevante = (IR > 1)
"""

from apps.guios.services.calculations.matrix import combine_importance


def calculate_relative_importance(suggested_importance: int, decisor_importance: int) -> int:
    """
    Cruza la Importancia del Decisor (fila) con la Importancia Sugerida (columna).
    """
    return combine_importance(row_val=decisor_importance, col_val=suggested_importance)


def is_factor_relevant(relative_importance: int) -> bool:
    """Un factor con IR = 1 se descarta. IR en {2, 3, 4} pasa a la calificación."""
    return int(relative_importance) > 1
