"""
Cortes de literatura cuando la serie de razones está inflada de ceros.

La interpolación de cuartiles sigue en quartiles.py. Esta función solo decide
si esos cortes se calculan sobre toda la serie o solo sobre las razones positivas.
"""

from decimal import Decimal
from typing import Sequence

from apps.guios.services.calculations.quartiles import calculate_quartiles


def calculate_literature_thresholds(
    values: Sequence[float | Decimal],
    strict_thesis_mode: bool = False,
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """
    Cortes que alimentan la ecuación 5.2.

    strict_thesis_mode=True aplica los cuartiles lineales (tipo 7) sobre todas las
    razones, sin tratar los ceros, tal como los define la tesis.

    Con strict_thesis_mode=False (predeterminado): si al menos la mitad de las
    razones es cero y hay dos o más razones positivas, q1 queda en 0 (los factores
    sin citas siguen en IL = 1) y q2, q3, q4 se calculan solo con las razones
    positivas. Así una sola fuente no convierte a todos esos factores en literatura
    fundamental, y q1 = q2 = 0 no elimina el nivel IL = 2. Sin ceros (como la
    Tabla 5.3 de la tesis) ambos modos dan el mismo resultado.
    """
    if not values:
        return calculate_quartiles(values)

    ratios = [Decimal(str(value)) for value in values]
    if strict_thesis_mode:
        return calculate_quartiles(ratios)

    positive = [ratio for ratio in ratios if ratio > 0]
    zero_count = len(ratios) - len(positive)
    if zero_count * 2 < len(ratios) or len(positive) < 2:
        return calculate_quartiles(ratios)

    positive_q1, _, positive_q3, positive_q4 = calculate_quartiles(positive)
    return Decimal("0.0000"), positive_q1, positive_q3, positive_q4
