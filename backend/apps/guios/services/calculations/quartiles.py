"""
Cortes de cuartil por interpolación lineal (método tipo 7 de R / NumPy linear).

P_k = 1 + (N - 1) * p, con p en {0.25, 0.50, 0.75}.
r_q4 es el máximo de la serie.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence


def calculate_quartiles(values: Sequence[float | Decimal]) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """
    Calcula (q1, q2, q3, q4) ordenando los valores de menor a mayor.

    Casos de borde:
    - Lista vacía: (0, 0, 0, 0).
    - Un solo valor: los cuatro cuartiles equivalen a ese valor.
    """
    if not values:
        zero = Decimal("0.0000")
        return zero, zero, zero, zero

    sorted_vals = sorted(Decimal(str(v)) for v in values)
    n = len(sorted_vals)

    if n == 1:
        val = sorted_vals[0].quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        return val, val, val, val

    def get_percentile(p: float) -> Decimal:
        idx = (n - 1) * p
        low = int(idx)
        high = min(low + 1, n - 1)
        weight = Decimal(str(idx - low))
        result = (Decimal("1") - weight) * sorted_vals[low] + weight * sorted_vals[high]
        return result.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    q1 = get_percentile(0.25)
    q2 = get_percentile(0.50)
    q3 = get_percentile(0.75)
    q4 = sorted_vals[-1].quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    return q1, q2, q3, q4
