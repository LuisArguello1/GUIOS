"""
Ecuación 5.3 — Clasificación FODA.

Fortaleza / Oportunidad si pm >= 3.0.
Debilidad / Amenaza si pm < 3.0.
El ámbito interno o externo decide el cuadrante.
"""

from decimal import Decimal

from apps.guios.services.calculations.weighted_average import meets_adoption_threshold

FODA_STRENGTH = "strength"
FODA_WEAKNESS = "weakness"
FODA_OPPORTUNITY = "opportunity"
FODA_THREAT = "threat"

SCOPE_INTERNAL = "internal"


def classify_foda(weighted_average: Decimal, scope: str) -> str:
    """
    Devuelve strength, opportunity, weakness o threat.
    Cualquier ámbito distinto de internal se trata como external.
    """
    is_internal = scope == SCOPE_INTERNAL
    if meets_adoption_threshold(weighted_average):
        return FODA_STRENGTH if is_internal else FODA_OPPORTUNITY
    return FODA_WEAKNESS if is_internal else FODA_THREAT
