"""
Motor de cálculo de GUIOS (Paso 4 del plan, docs/ANALISIS_GUIOS_ORIGINAL.md §8).

Funciones puras: no importan Django, no consultan la base de datos y no usan IA
(RNF-12, RN-14). Reciben dataclasses con datos simples y devuelven resultados.
El servicio que lee los modelos (Paso 5) arma las entradas y guarda las salidas.

Reglas (tesis, Rea Sánchez 2022):
- IR = matriz de la Fig. 5.10 (p. 89) con IS e ID; el factor es relevante si IR > 1.
- PM = suma de calificaciones / número de subfactores (Sección 5.2.3, p. 89),
  con Decimal exacto. La comparación con 3.00 usa el valor exacto; el redondeo a
  dos decimales es solo para mostrar. La calificación 2 ("Desconozco") cuenta.
- FODA derivada de la PM y del ámbito (Ec. 5.3, p. 91).
- Dictamen (pp. 104-106, decisión P1): C si algún factor negativo tiene IR 3 o 4;
  B si los negativos solo tienen IR 2; A si no hay negativos.
- Sin dictamen mientras falte algo de un factor relevante (decisión P2).
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional, Sequence

IRRELEVANT = 1
OPTIONAL = 2
IMPORTANT = 3
FUNDAMENTAL = 4
IMPORTANCE_VALUES = (IRRELEVANT, OPTIONAL, IMPORTANT, FUNDAMENTAL)

RATING_NOT_MET = 1
RATING_UNKNOWN = 2
RATING_PARTIAL = 3
RATING_MET = 4
RATING_VALUES = (RATING_NOT_MET, RATING_UNKNOWN, RATING_PARTIAL, RATING_MET)

THRESHOLD = Decimal("3")
DISPLAY_QUANTUM = Decimal("0.01")

SCOPE_INTERNAL = "internal"
SCOPE_EXTERNAL = "external"
SCOPES = (SCOPE_INTERNAL, SCOPE_EXTERNAL)

FODA_STRENGTH = "strength"
FODA_WEAKNESS = "weakness"
FODA_OPPORTUNITY = "opportunity"
FODA_THREAT = "threat"
NEGATIVE_FODA = (FODA_WEAKNESS, FODA_THREAT)

RECOMMENDATION_A = "A"
RECOMMENDATION_B = "B"
RECOMMENDATION_C = "C"

MISSING_DECISOR_IMPORTANCE = "decisor_importance"
MISSING_SCOPE = "scope"
MISSING_SUBFACTOR_RATING = "subfactor_rating"

# Fig. 5.10 (p. 89): IR = IMPORTANCE_MATRIX[ID][IS - 1].
IMPORTANCE_MATRIX = {
    IRRELEVANT: (1, 1, 2, 2),
    OPTIONAL: (1, 2, 2, 3),
    IMPORTANT: (2, 2, 3, 3),
    FUNDAMENTAL: (2, 3, 3, 4),
}


# ── Entradas ──────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class SubfactorInput:
    code: str
    description: str
    rating: Optional[int] = None


@dataclass(frozen=True)
class FactorInput:
    """
    ``scope`` es el ámbito efectivo: 'internal' o 'external'. Para el factor con
    ámbito configurable (Soporte) es ``None`` mientras el evaluador no lo elija.
    """
    code: str
    name: str
    suggested_importance: int
    decisor_importance: Optional[int] = None
    scope: Optional[str] = None
    scope_configurable: bool = False
    subfactors: Sequence[SubfactorInput] = ()


# ── Salidas ───────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class FailingSubfactor:
    """Subfactor calificado por debajo de 3: 1 = no cumple, 2 = no se sabe."""
    code: str
    description: str
    rating: int


@dataclass(frozen=True)
class FactorResult:
    code: str
    name: str
    suggested_importance: int
    decisor_importance: Optional[int]
    relative_importance: Optional[int]
    is_relevant: Optional[bool]
    scope: Optional[str]
    weighted_average: Optional[Decimal]
    meets_threshold: Optional[bool]
    foda: Optional[str]
    failing_subfactors: tuple = ()

    @property
    def is_negative(self) -> bool:
        return self.foda in NEGATIVE_FODA

    @property
    def weighted_average_display(self) -> Optional[Decimal]:
        if self.weighted_average is None:
            return None
        return display_pm(self.weighted_average)


@dataclass(frozen=True)
class MissingItem:
    kind: str
    factor_code: str
    factor_name: str
    subfactor_code: Optional[str] = None


@dataclass(frozen=True)
class Verdict:
    recommendation: str
    causing_factors: tuple = ()


@dataclass(frozen=True)
class EvaluationOutcome:
    factors: tuple
    missing: tuple
    verdict: Optional[Verdict]

    @property
    def is_complete(self) -> bool:
        return not self.missing


# ── Cálculos ──────────────────────────────────────────────────────────────────

def _check_importance(value, label):
    if value not in IMPORTANCE_VALUES or isinstance(value, bool):
        raise ValueError(f"{label} debe estar entre 1 y 4; se recibió {value!r}.")


def _check_rating(value):
    if value not in RATING_VALUES or isinstance(value, bool):
        raise ValueError(f"La calificación debe estar entre 1 y 4; se recibió {value!r}.")


def relative_importance(suggested_importance: int, decisor_importance: int) -> int:
    """IR según la matriz de la Fig. 5.10."""
    _check_importance(suggested_importance, "IS")
    _check_importance(decisor_importance, "ID")
    return IMPORTANCE_MATRIX[decisor_importance][suggested_importance - 1]


def is_relevant(relative: int) -> bool:
    """Un factor es relevante si su IR es mayor que Irrelevante (1)."""
    _check_importance(relative, "IR")
    return relative > IRRELEVANT


def weighted_average(ratings: Sequence[int]) -> Decimal:
    """PM exacta: suma de calificaciones / número de subfactores."""
    if not ratings:
        raise ValueError("No se puede calcular la PM de un factor sin subfactores.")
    for rating in ratings:
        _check_rating(rating)
    return Decimal(sum(ratings)) / Decimal(len(ratings))


def display_pm(value: Decimal) -> Decimal:
    """PM redondeada a dos decimales, solo para mostrar."""
    return value.quantize(DISPLAY_QUANTUM, rounding=ROUND_HALF_UP)


def meets_threshold(value: Decimal) -> bool:
    """Cumple si la PM exacta es mayor o igual que 3."""
    return value >= THRESHOLD


def classify_foda(scope: str, meets: bool) -> str:
    """Ec. 5.3: el ámbito y el umbral determinan el cuadrante FODA."""
    if scope == SCOPE_INTERNAL:
        return FODA_STRENGTH if meets else FODA_WEAKNESS
    if scope == SCOPE_EXTERNAL:
        return FODA_OPPORTUNITY if meets else FODA_THREAT
    raise ValueError(f"Ámbito no válido: {scope!r} (internal o external).")


def recommendation(results: Sequence[FactorResult]) -> Verdict:
    """
    Dictamen sobre factores relevantes ya calculados. Devuelve los factores que
    lo causan: los negativos con IR 3 o 4 (C) o con IR 2 (B); ninguno en A.
    """
    negatives = [r for r in results if r.is_relevant and r.is_negative]
    critical = tuple(r for r in negatives if r.relative_importance >= IMPORTANT)
    if critical:
        return Verdict(RECOMMENDATION_C, critical)
    if negatives:
        return Verdict(RECOMMENDATION_B, tuple(negatives))
    return Verdict(RECOMMENDATION_A, ())


def evaluate_factor(factor: FactorInput):
    """Calcula un factor. Devuelve (FactorResult, lista de MissingItem)."""
    _check_importance(factor.suggested_importance, f"IS de {factor.code}")
    if factor.scope is None and not factor.scope_configurable:
        raise ValueError(f"El factor {factor.code} tiene ámbito fijo y no lo recibió.")
    if factor.scope is not None and factor.scope not in SCOPES:
        raise ValueError(f"Ámbito no válido en {factor.code}: {factor.scope!r}.")

    def result(**values):
        base = dict(
            code=factor.code,
            name=factor.name,
            suggested_importance=factor.suggested_importance,
            decisor_importance=factor.decisor_importance,
            relative_importance=None,
            is_relevant=None,
            scope=factor.scope,
            weighted_average=None,
            meets_threshold=None,
            foda=None,
        )
        base.update(values)
        return FactorResult(**base)

    def missing(kind, subfactor_code=None):
        return MissingItem(kind, factor.code, factor.name, subfactor_code)

    if factor.decisor_importance is None:
        # Sin ID no se sabe si el factor es relevante: solo se pide la ID.
        return result(), [missing(MISSING_DECISOR_IMPORTANCE)]

    relative = relative_importance(factor.suggested_importance, factor.decisor_importance)
    relevant = is_relevant(relative)
    if not relevant:
        # IR = 1: no entra en PM, FODA ni dictamen, y no pide nada más.
        return result(relative_importance=relative, is_relevant=False), []

    if not factor.subfactors:
        raise ValueError(f"El factor relevante {factor.code} no tiene subfactores.")

    pending = []
    if factor.scope is None:
        pending.append(missing(MISSING_SCOPE))
    for subfactor in factor.subfactors:
        if subfactor.rating is None:
            pending.append(missing(MISSING_SUBFACTOR_RATING, subfactor.code))
        else:
            _check_rating(subfactor.rating)

    if any(s.rating is None for s in factor.subfactors):
        return result(relative_importance=relative, is_relevant=True), pending

    average = weighted_average([s.rating for s in factor.subfactors])
    meets = meets_threshold(average)
    failing = tuple(
        FailingSubfactor(s.code, s.description, s.rating)
        for s in factor.subfactors
        if s.rating < RATING_PARTIAL
    )
    foda = classify_foda(factor.scope, meets) if factor.scope is not None else None
    return result(
        relative_importance=relative,
        is_relevant=True,
        weighted_average=average,
        meets_threshold=meets,
        foda=foda,
        failing_subfactors=failing,
    ), pending


def evaluate(factors: Sequence[FactorInput]) -> EvaluationOutcome:
    """
    Calcula toda la evaluación. El dictamen solo se emite si no falta nada:
    ID de cada factor y, en los relevantes, el ámbito y todas las calificaciones.
    """
    results = []
    missing = []
    for factor in factors:
        factor_result, factor_missing = evaluate_factor(factor)
        results.append(factor_result)
        missing.extend(factor_missing)

    verdict = None if missing else recommendation(results)
    return EvaluationOutcome(tuple(results), tuple(missing), verdict)
