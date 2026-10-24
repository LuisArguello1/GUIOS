"""
Texto explicativo del dictamen (RF-PUB-05). Lo genera el sistema a partir del
resultado del motor, no la IA (RN-14). Nombra los factores que causan el
dictamen y separa sus subfactores en "no cumple" (1) y "no se sabe" (2).
"""
from .engine import (
    FODA_OPPORTUNITY,
    FODA_STRENGTH,
    FODA_THREAT,
    FODA_WEAKNESS,
    RATING_NOT_MET,
    RATING_UNKNOWN,
    RECOMMENDATION_A,
    RECOMMENDATION_B,
    RECOMMENDATION_C,
    Verdict,
)

IMPORTANCE_LABELS = {1: 'Irrelevante', 2: 'Opcional', 3: 'Importante', 4: 'Fundamental'}

FODA_LABELS = {
    FODA_STRENGTH: 'Fortaleza',
    FODA_WEAKNESS: 'Debilidad',
    FODA_OPPORTUNITY: 'Oportunidad',
    FODA_THREAT: 'Amenaza',
}

# Tesis, pp. 104-106 (Figs. 6.5 y 6.6), con las erratas corregidas. El título
# ("Recomendación C: ...") no va en el texto: la interfaz ya lo muestra.
GUIDANCE = {
    RECOMMENDATION_A: (
        "Todos los factores relevantes son Fortalezas u Oportunidades: la organización "
        "cumple los requisitos para adoptar el software."
    ),
    RECOMMENDATION_B: (
        "Las Debilidades o Amenazas están solo en factores de importancia relativa Opcional; "
        "se sugiere revisar los criterios que no cumplen con lo mínimo requerido."
    ),
    RECOMMENDATION_C: (
        "Hay Debilidades o Amenazas en factores Importantes o Fundamentales: la organización "
        "debe proporcionar los recursos que garanticen una adopción satisfactoria. Los factores "
        "internos son aspectos a mejorar dentro de la organización; en los externos se deben "
        "dedicar recursos de ingeniería para mejorar el software."
    ),
}


def _quote(subfactors):
    return "; ".join(f"«{s.description}»" for s in subfactors)


def build_explanation(verdict: Verdict) -> str:
    """
    Empieza directamente con los factores causantes (B y C) y cierra con la
    orientación de la tesis. En A no hay causantes: solo la orientación.
    """
    lines = []
    if verdict.causing_factors:
        lines.append("Factores que causan el dictamen:")
    for factor in verdict.causing_factors:
        lines.append(
            f"- {factor.name}: IR {IMPORTANCE_LABELS[factor.relative_importance]}, "
            f"PM {factor.weighted_average_display}, {FODA_LABELS[factor.foda]}."
        )
        not_met = [s for s in factor.failing_subfactors if s.rating == RATING_NOT_MET]
        unknown = [s for s in factor.failing_subfactors if s.rating == RATING_UNKNOWN]
        if not_met:
            lines.append(f"  No cumple: {_quote(not_met)}.")
        if unknown:
            lines.append(f"  No se sabe: {_quote(unknown)}.")
    if lines:
        lines.append("")
    lines.append(GUIDANCE[verdict.recommendation])
    return "\n".join(lines)
