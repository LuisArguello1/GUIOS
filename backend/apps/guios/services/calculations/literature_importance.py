"""
Ecuación 5.2 — Importancia de la Literatura (IL).

Compara la razón r_i de un factor contra los cuartiles de la evaluación.
"""

from decimal import Decimal


def assign_literature_importance(
    citation_ratio: Decimal,
    q1: Decimal,
    q2: Decimal,
    q3: Decimal,
    q4: Decimal,
) -> int:
    """
    IL en {1, 2, 3, 4}:
    - r_i <= q1       -> 1 (Irrelevante)
    - q1 < r_i <= q2  -> 2 (Opcional)
    - q2 < r_i <= q3  -> 3 (Importante)
    - q3 < r_i <= q4  -> 4 (Fundamental)
    """
    if citation_ratio <= q1:
        return 1
    if citation_ratio <= q2:
        return 2
    if citation_ratio <= q3:
        return 3
    if citation_ratio <= q4:
        return 4
    return 4
