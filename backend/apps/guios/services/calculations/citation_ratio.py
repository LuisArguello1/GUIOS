"""
Ecuación 5.1 — Razón de citas por factor.

r_i = TC_i / NS_i
"""

from decimal import Decimal, ROUND_HALF_UP


def calculate_citation_ratio(
    total_citations: int,
    subfactor_count: int,
    decimals: int = 4,
) -> Decimal:
    """
    Promedio de citas de los subfactores de un factor.
    TC_i es la suma de citas; NS_i es el número de subfactores activos (NS_i >= 1).
    El resultado se cuantiza a `decimals` (4 por defecto, como se almacena). Los cuartiles
    usan mayor precisión para no acumular error de redondeo (p. ej. 20/11 en la Tabla 5.3).
    """
    if subfactor_count < 1:
        raise ValueError("NS_i debe ser mayor o igual a 1 para calcular la razón de citas.")

    ratio = Decimal(str(total_citations)) / Decimal(str(subfactor_count))
    return ratio.quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)
