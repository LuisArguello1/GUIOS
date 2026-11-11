"""
Dictamen final A, B o C (tesis, páginas 104-106, Figuras 6.5 y 6.6).

fallos    = factores relevantes con pm < 3.0 (Debilidad o Amenaza)
positivos = factores relevantes con pm >= 3.0 (Fortaleza u Oportunidad)

A: no hay fallos.
C: algún fallo ocurre en un factor con IR >= 3, O BIEN los fallos (todos IR = 2)
   son más que los positivos.
B: hay fallos, todos con IR = 2, y no superan a los positivos.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

RECOMMENDATION_A = "A"
RECOMMENDATION_B = "B"
RECOMMENDATION_C = "C"


@dataclass(frozen=True)
class VerdictFactor:
    name: str
    weighted_average: Decimal
    meets_threshold: bool
    relative_importance: int
    foda_label: str


def classify_recommendation(factors: Sequence[VerdictFactor]) -> tuple[str, str]:
    """
    Emite el código de recomendación y el texto explicativo determinista.
    Un fallo con IR = 1 no cuenta: ese factor ya quedó fuera del filtro de relevancia.
    """
    if not factors:
        raise ValueError("No existen resultados calculados para emitir un dictamen.")

    positives = [factor for factor in factors if factor.meets_threshold]
    failures = [
        factor for factor in factors
        if not factor.meets_threshold and factor.relative_importance > 1
    ]

    def detail(factor: VerdictFactor) -> str:
        return (
            f"{factor.name} ({factor.foda_label}, PM: {factor.weighted_average}, "
            f"IR: {factor.relative_importance})"
        )

    if not failures:
        explanation = (
            "El software candidato satisface holgadamente todos los criterios de adopción evaluados. "
            "Todos los factores relevantes superaron el umbral metodológico (PM >= 3.0). "
            "Se emite la Recomendación A: Adoptar sin observaciones."
        )
        return RECOMMENDATION_A, explanation

    critical_failures = [factor for factor in failures if factor.relative_importance >= 3]
    failed_list = "; ".join(detail(factor) for factor in failures)

    if critical_failures:
        critical_list = "; ".join(detail(factor) for factor in critical_failures)
        explanation = (
            "El software candidato presenta debilidades o amenazas en factores de alta importancia (IR >= 3): "
            f"[{critical_list}]. Se emite la Recomendación C: Se sugiere analizar la adopción y posponerla hasta que "
            "se cuente con recursos técnicos o planes de mitigación estructurales."
        )
        return RECOMMENDATION_C, explanation

    if len(failures) > len(positives):
        explanation = (
            f"Las debilidades y amenazas ({len(failures)}) superan a las fortalezas y oportunidades "
            f"({len(positives)}), aunque todas ocurren en factores opcionales (IR = 2): [{failed_list}]. "
            "Se emite la Recomendación C: Se sugiere analizar la adopción y posponerla hasta que "
            "se cuente con recursos técnicos o planes de mitigación estructurales."
        )
        return RECOMMENDATION_C, explanation

    explanation = (
        "El software candidato es viable para adopción pero presenta debilidades o amenazas en factores opcionales (IR=2): "
        f"[{failed_list}]. Se emite la Recomendación B: Es posible adoptar, con matices (requiere plan de acción preventivo)."
    )
    return RECOMMENDATION_B, explanation
