"""
Figura 5.10 — Matriz de combinación metodológica.

Operador M(entrada_1, entrada_2) usado para:
- Importancia Sugerida: IS = M(IE, IL)
- Importancia Relativa: IR = M(ID, IS)

La matriz es simétrica: M(a, b) = M(b, a).
"""

COMBINATION_MATRIX: dict[int, dict[int, int]] = {
    1: {1: 1, 2: 1, 3: 2, 4: 2},
    2: {1: 1, 2: 2, 3: 2, 4: 3},
    3: {1: 2, 2: 2, 3: 3, 4: 3},
    4: {1: 2, 2: 3, 3: 3, 4: 4},
}


def combine_importance(row_val: int, col_val: int) -> int:
    """
    Cruce discreto de la Figura 5.10.
    Los valores fuera de [1, 4] se ajustan a los extremos.
    """
    row = max(1, min(4, int(row_val)))
    col = max(1, min(4, int(col_val)))
    return COMBINATION_MATRIX[row][col]
