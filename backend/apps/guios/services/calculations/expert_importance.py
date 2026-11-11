"""
Importancia del Experto (IE) — tesis, página 86.

IE = media aritmética de las calificaciones de los expertos a los subfactores
del factor, redondeada al entero más cercano (decimal <= .4 baja, >= .5 sube).
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence


def calculate_expert_importance(subfactor_ratings: Sequence[int]) -> int:
    """
    Devuelve IE en {1, 2, 3, 4}. Usa Decimal con ROUND_HALF_UP para que 3.5 sea 4
    (el round() de Python redondea a par: round(2.5) == 2).
    """
    if not subfactor_ratings:
        raise ValueError("No hay calificaciones de expertos para calcular la IE.")

    average = Decimal(str(sum(subfactor_ratings))) / Decimal(str(len(subfactor_ratings)))
    rounded = int(average.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return max(1, min(4, rounded))
