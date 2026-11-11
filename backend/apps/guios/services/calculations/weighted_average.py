"""
Ponderación Media del factor (PM).

pm_i = round(sum(PS_j) / NS_i, 1)
Umbral metodológico fijo: 3.0
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence

ADOPTION_THRESHOLD = Decimal("3.0")


def calculate_weighted_average(ratings: Sequence[int]) -> Decimal:
    """
    Promedio aritmético de las calificaciones de cumplimiento, redondeado a 1 decimal.
    """
    if not ratings:
        raise ValueError("No hay calificaciones para calcular la ponderación media.")

    raw_average = Decimal(str(sum(ratings))) / Decimal(str(len(ratings)))
    return raw_average.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def meets_adoption_threshold(weighted_average: Decimal) -> bool:
    """True si pm_i >= 3.0."""
    return weighted_average >= ADOPTION_THRESHOLD
