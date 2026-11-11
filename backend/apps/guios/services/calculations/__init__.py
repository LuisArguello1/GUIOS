"""
Cálculos deterministas de la metodología GUIOS.

Cada módulo contiene una sola fórmula. Este paquete solo los reexporta.
"""

from apps.guios.services.calculations.citation_ratio import calculate_citation_ratio
from apps.guios.services.calculations.expert_importance import calculate_expert_importance
from apps.guios.services.calculations.foda import (
    FODA_OPPORTUNITY,
    FODA_STRENGTH,
    FODA_THREAT,
    FODA_WEAKNESS,
    classify_foda,
)
from apps.guios.services.calculations.literature_importance import assign_literature_importance
from apps.guios.services.calculations.literature_thresholds import calculate_literature_thresholds
from apps.guios.services.calculations.matrix import COMBINATION_MATRIX, combine_importance
from apps.guios.services.calculations.quartiles import calculate_quartiles
from apps.guios.services.calculations.relative_importance import (
    calculate_relative_importance,
    is_factor_relevant,
)
from apps.guios.services.calculations.suggested_importance import (
    calculate_suggested_importance,
    calculate_systemic_importance,
)
from apps.guios.services.calculations.verdict import (
    RECOMMENDATION_A,
    RECOMMENDATION_B,
    RECOMMENDATION_C,
    VerdictFactor,
    classify_recommendation,
)
from apps.guios.services.calculations.weighted_average import (
    ADOPTION_THRESHOLD,
    calculate_weighted_average,
    meets_adoption_threshold,
)

__all__ = [
    "ADOPTION_THRESHOLD",
    "COMBINATION_MATRIX",
    "FODA_OPPORTUNITY",
    "FODA_STRENGTH",
    "FODA_THREAT",
    "FODA_WEAKNESS",
    "RECOMMENDATION_A",
    "RECOMMENDATION_B",
    "RECOMMENDATION_C",
    "VerdictFactor",
    "assign_literature_importance",
    "calculate_citation_ratio",
    "calculate_expert_importance",
    "calculate_literature_thresholds",
    "calculate_quartiles",
    "calculate_relative_importance",
    "calculate_suggested_importance",
    "calculate_systemic_importance",
    "calculate_weighted_average",
    "classify_foda",
    "classify_recommendation",
    "combine_importance",
    "is_factor_relevant",
    "meets_adoption_threshold",
]
