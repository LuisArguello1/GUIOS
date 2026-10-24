"""
Motor Metodológico GUIOS PRO
Implementa los cálculos matemáticos del Capítulo 5 y Capítulo 6 de la tesis doctoral:
- Ecuación 5.1: Razón de citas r_i = TC_i / NS_i
- Interpolación lineal de cuartiles q1, q2, q3, q4
- Ecuación 5.2: Asignación de Importancia de la Literatura (IL: 1 a 4)
- Figura 5.10: Matriz de Combinación discreta (IS = IL x IE, IR = IS x ID)
- Ecuación 5.3: Ponderación Media (PM), umbral >= 3.0 y matriz FODA
- Regla de Recomendación Final (A, B, C)
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.guios.models import (
    Factor,
    Subfactor,
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. MATRIZ DE COMBINACIÓN METODOLÓGICA (Figura 5.10 de la Tesis)
# Cruza: (IE x IL -> IS) y (ID x IS -> IR)
# Filas: IE o ID (1: Irrelevante, 2: Opcional, 3: Importante, 4: Fundamental)
# Columnas: IL o IS (1: Irrelevante, 2: Opcional, 3: Importante, 4: Fundamental)
# ─────────────────────────────────────────────────────────────────────────────

COMBINATION_MATRIX: dict[int, dict[int, int]] = {
    1: {1: 1, 2: 1, 3: 2, 4: 2},
    2: {1: 1, 2: 2, 3: 2, 4: 3},
    3: {1: 2, 2: 2, 3: 3, 4: 3},
    4: {1: 2, 2: 3, 3: 3, 4: 4},
}


def combine_importance(row_val: int, col_val: int) -> int:
    """
    Retorna el cruce discreto de importancia según la Matriz de la Figura 5.10.
    Garantiza valores en el rango [1, 4].
    """
    row = max(1, min(4, int(row_val)))
    col = max(1, min(4, int(col_val)))
    return COMBINATION_MATRIX[row][col]


def calculate_systemic_importance(literature_importance: int, expert_importance: int) -> int:
    """
    Calcula la Importancia Sistémica/Sugerida (IS) cruzando IE x IL según la Figura 5.10 de la tesis.
    """
    return combine_importance(row_val=expert_importance, col_val=literature_importance)


# ─────────────────────────────────────────────────────────────────────────────
# 2. CÁLCULO DE CUARTILES CON INTERPOLACIÓN LINEAL (Capítulo 5)
# ─────────────────────────────────────────────────────────────────────────────

def calculate_quartiles(values: Sequence[float | Decimal]) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """
    Calcula los 4 cuartiles (q1: 25%, q2: 50%, q3: 75%, q4: 100%) ordenando
    los valores ascendentemente y aplicando interpolación lineal exacta.
    
    Manejo de casos de borde:
    - Lista vacía o todos ceros: retorna (0.0, 0.0, 0.0, 0.0).
    - Un solo valor: todos los cuartiles equivalen a ese valor.
    """
    if not values:
        zero = Decimal('0.0000')
        return zero, zero, zero, zero

    sorted_vals = sorted([Decimal(str(v)) for v in values])
    n = len(sorted_vals)

    if n == 1:
        val = sorted_vals[0].quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        return val, val, val, val

    def get_percentile(p: float) -> Decimal:
        """Interpolación lineal p in [0.0, 1.0]."""
        idx = (n - 1) * p
        low = int(idx)
        high = min(low + 1, n - 1)
        weight = Decimal(str(idx - low))
        res = (Decimal('1') - weight) * sorted_vals[low] + weight * sorted_vals[high]
        return res.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

    q1 = get_percentile(0.25)
    q2 = get_percentile(0.50)
    q3 = get_percentile(0.75)
    q4 = sorted_vals[-1].quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

    return q1, q2, q3, q4


def assign_literature_importance(
    ri: Decimal,
    q1: Decimal,
    q2: Decimal,
    q3: Decimal,
    q4: Decimal,
) -> int:
    """
    Asigna el indicador IL in {1, 2, 3, 4} según la Ecuación (5.2) de la tesis:
    - ri <= q1       -> 1 (Irrelevante)
    - q1 < ri <= q2  -> 2 (Opcional)
    - q2 < ri <= q3  -> 3 (Importante)
    - q3 < ri <= q4  -> 4 (Fundamental)
    """
    if ri <= q1:
        return 1
    if ri <= q2:
        return 2
    if ri <= q3:
        return 3
    return 4


# ─────────────────────────────────────────────────────────────────────────────
# 3. FASE 3 / PASO 0: PROCESAMIENTO DE LITERATURA Y CÁLCULO DE CUARTILES
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def compute_evaluation_literature_metrics(
    evaluation: Evaluation,
    ai_citations_by_subfactor: dict[int, int] | None = None,
    ai_sources_by_factor: dict[int, list[dict]] | None = None,
) -> Evaluation:
    """
    Toma los factores activos con subfactores, calcula la razón r_i = TC_i / NS_i,
    obtiene los cuartiles (q1, q2, q3, q4), asigna IL, cruza con IE para obtener IS
    y deja poblados los registros de EvaluationFactor y EvaluationSubfactor.
    
    Si ai_citations_by_subfactor es None, usa las citas base del catálogo de la tesis.
    """
    # 1. Obtener factores activos con subfactores activos
    factors = Factor.objects.filter(is_active=True).prefetch_related(
        'subfactors'
    ).select_related('dimension').order_by('dimension__order', 'order', 'id')

    factor_data: list[dict] = []
    r_values: list[Decimal] = []

    for factor in factors:
        active_subfactors = [sf for sf in factor.subfactors.all() if sf.is_active]
        ns = len(active_subfactors)
        if ns == 0:
            continue  # Se descartan factores sin subfactores tal como en la tesis (Cap. 5)

        # Contabilizar citas del factor (TC_i = suma de citas de sus subfactores)
        if ai_citations_by_subfactor:
            tc = sum(ai_citations_by_subfactor.get(sf.id, 0) for sf in active_subfactors)
        else:
            tc = sum(sf.base_citations_count for sf in active_subfactors)

        ri = (Decimal(str(tc)) / Decimal(str(ns))).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        r_values.append(ri)

        factor_data.append({
            'factor': factor,
            'subfactors': active_subfactors,
            'ns': ns,
            'tc': tc,
            'ri': ri,
            'ie': factor.expert_importance,
        })

    if not factor_data:
        raise ValidationError("No existen factores activos con subfactores para evaluar.")

    # 2. Calcular los cuartiles q1, q2, q3, q4 de esta evaluación
    q1, q2, q3, q4 = calculate_quartiles(r_values)
    evaluation.q1_threshold = q1
    evaluation.q2_threshold = q2
    evaluation.q3_threshold = q3
    evaluation.q4_threshold = q4
    evaluation.ai_status = Evaluation.AI_STATUS_COMPLETED
    evaluation.save(update_fields=['q1_threshold', 'q2_threshold', 'q3_threshold', 'q4_threshold', 'ai_status'])

    # 3. Crear o actualizar EvaluationFactor y EvaluationSubfactor
    for item in factor_data:
        factor: Factor = item['factor']
        ri: Decimal = item['ri']
        il = assign_literature_importance(ri, q1, q2, q3, q4)
        ie = item['ie']
        # Cruce metodológico: IS = Matriz(IE, IL)
        is_val = combine_importance(ie, il)

        sources = (ai_sources_by_factor or {}).get(factor.id, [])

        eval_factor, _ = EvaluationFactor.objects.update_or_create(
            evaluation=evaluation,
            factor=factor,
            defaults={
                'systemic_importance_snapshot': is_val,
                'subfactors_count_snapshot': item['ns'],
                'citations_count': item['tc'],
                'citation_ratio': ri,
                'literature_importance_calculated': il,
                'expert_importance_snapshot': ie,
                'ai_literature_sources': sources,
                'scope_used': factor.scope if factor.scope in [Factor.SCOPE_INTERNAL, Factor.SCOPE_EXTERNAL] else Factor.SCOPE_INTERNAL,
            }
        )

        # Poblar EvaluationSubfactor inicial
        for sf in item['subfactors']:
            sf_citations = (ai_citations_by_subfactor or {}).get(sf.id, sf.base_citations_count)
            EvaluationSubfactor.objects.update_or_create(
                evaluation=evaluation,
                subfactor=sf,
                defaults={
                    'description_snapshot': sf.description,
                    'ai_citations_count': sf_citations,
                }
            )

    return evaluation


# ─────────────────────────────────────────────────────────────────────────────
# 4. FASE 4 / PASOS 1 Y 2: RELEVANCIA Y ÁMBITO (Importancia del Decisor ID -> IR)
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def apply_step1_decisor_importance(
    evaluation: Evaluation,
    decisor_data: list[dict],
) -> list[EvaluationFactor]:
    """
    Aplica la Importancia del Decisor (ID: 1 a 4) y el ámbito seleccionado para cada factor.
    Calcula IR = Matriz(ID, IS) y marca is_relevant = (IR > 1).
    
    Formato esperado de decisor_data:
    [
        {'factor_id': int, 'decisor_importance': int, 'scope_used': str (opcional)}
    ]
    """
    updated_factors: list[EvaluationFactor] = []

    for entry in decisor_data:
        factor_id = entry['factor_id']
        id_val = int(entry['decisor_importance'])

        eval_factor = EvaluationFactor.objects.get(evaluation=evaluation, factor_id=factor_id)
        is_val = eval_factor.systemic_importance_snapshot

        # Cruce metodológico: IR = Matriz(ID, IS)
        ir_val = combine_importance(id_val, is_val)
        is_relevant = ir_val > 1  # Relevante si IR in {2, 3, 4}

        eval_factor.decisor_importance = id_val
        eval_factor.relative_importance = ir_val
        eval_factor.is_relevant = is_relevant

        if 'scope_used' in entry and entry['scope_used']:
            eval_factor.scope_used = entry['scope_used']

        eval_factor.save(update_fields=[
            'decisor_importance',
            'relative_importance',
            'is_relevant',
            'scope_used',
        ])
        updated_factors.append(eval_factor)

    return updated_factors


# ─────────────────────────────────────────────────────────────────────────────
# 5. FASE 4 / PASOS 3 Y 4: CALIFICACIÓN DE SUBFACTORES Y MATRIZ FODA
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def apply_step3_subfactor_ratings_and_foda(
    evaluation: Evaluation,
    ratings_by_subfactor: dict[int, int],
) -> list[EvaluationResult]:
    """
    Guarda las calificaciones (1 a 4) para los subfactores de los factores relevantes,
    calcula la Ponderación Media PM = sum(calif) / n (redondeada a 1 decimal),
    evalúa si cumple el umbral metodológico (PM >= 3.0) y clasifica en la matriz FODA.
    """
    # 1. Actualizar calificaciones individuales en EvaluationSubfactor
    for sf_id, rating in ratings_by_subfactor.items():
        EvaluationSubfactor.objects.filter(
            evaluation=evaluation,
            subfactor_id=sf_id,
        ).update(rating=max(1, min(4, int(rating))))

    # 2. Procesar cada factor relevante
    relevant_eval_factors = EvaluationFactor.objects.filter(
        evaluation=evaluation,
        is_relevant=True,
    ).select_related('factor')

    results: list[EvaluationResult] = []

    for ef in relevant_eval_factors:
        sub_ratings = list(
            EvaluationSubfactor.objects.filter(
                evaluation=evaluation,
                subfactor__factor=ef.factor,
                subfactor__is_active=True,
            ).values_list('rating', flat=True)
        )

        # Filtrar valores no nulos
        valid_ratings = [r for r in sub_ratings if r is not None]
        if not valid_ratings:
            continue

        # PM redondeado a 1 decimal
        raw_avg = Decimal(str(sum(valid_ratings))) / Decimal(str(len(valid_ratings)))
        pm = raw_avg.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
        meets_threshold = pm >= Decimal('3.0')

        # Clasificación FODA según Ecuación (5.3)
        is_internal = (ef.scope_used == EvaluationFactor.SCOPE_INTERNAL)
        if meets_threshold:
            foda = EvaluationResult.FODA_STRENGTH if is_internal else EvaluationResult.FODA_OPPORTUNITY
        else:
            foda = EvaluationResult.FODA_WEAKNESS if is_internal else EvaluationResult.FODA_THREAT

        result, _ = EvaluationResult.objects.update_or_create(
            evaluation=evaluation,
            factor=ef.factor,
            defaults={
                'weighted_average': pm,
                'meets_threshold': meets_threshold,
                'foda_classification': foda,
            }
        )
        results.append(result)

    return results


# ─────────────────────────────────────────────────────────────────────────────
# 6. FASE 4 / PASOS 5 Y 6: DICTAMEN FINAL Y RECOMENDACIÓN (A, B, C)
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def compute_final_verdict(
    evaluation: Evaluation,
    ai_executive_summary: str = "",
    ai_mitigation_plan: str = "",
) -> EvaluationVerdict:
    """
    Emite el dictamen determinista de acuerdo a las reglas de la tesis GUIOS (Cap. 6, Fig. 6.5/6.6):
    - Recomendación A (Adoptar sin observaciones): Todos los factores relevantes cumplen PM >= 3.0.
    - Recomendación B (Es posible adoptar, con matices): Existen factores con PM < 3.0 (Debilidades o Amenazas),
      pero el 100% de dichos factores tienen una Importancia Relativa IR == 2 (Opcional).
    - Recomendación C (Se sugiere analizar la adopción y posponerla): Existe al menos un factor con PM < 3.0
      cuya Importancia Relativa es IR >= 3 (Importante o Fundamental), o acumulación crítica de deficiencias.
    """
    results = EvaluationResult.objects.filter(evaluation=evaluation).select_related('factor')
    if not results.exists():
        raise ValidationError("No existen resultados calculados para emitir un dictamen.")

    # Mapear factor_id a su IR
    ef_map = {
        ef.factor_id: ef.relative_importance
        for ef in EvaluationFactor.objects.filter(evaluation=evaluation, is_relevant=True)
    }

    critical_failures: list[str] = []
    optional_failures: list[str] = []

    for r in results:
        if not r.meets_threshold:
            ir = ef_map.get(r.factor_id, 1)
            name = r.factor.name
            foda_lbl = r.get_foda_classification_display()
            if ir >= 3:
                critical_failures.append(f"{name} ({foda_lbl}, PM: {r.weighted_average}, IR: {ir})")
            elif ir == 2:
                optional_failures.append(f"{name} ({foda_lbl}, PM: {r.weighted_average}, IR: 2)")

    if not critical_failures and not optional_failures:
        recommendation = EvaluationVerdict.RECOMMENDATION_A
        explanation = (
            "El software candidato satisface holgadamente todos los criterios de adopción evaluados. "
            "Todos los factores relevantes superaron el umbral metodológico (PM >= 3.0). "
            "Se emite la Recomendación A: Adoptar sin observaciones."
        )
    elif not critical_failures and optional_failures:
        recommendation = EvaluationVerdict.RECOMMENDATION_B
        failed_list = "; ".join(optional_failures)
        explanation = (
            "El software candidato es viable para adopción pero presenta debilidades o amenazas en factores opcionales (IR=2): "
            f"[{failed_list}]. Se emite la Recomendación B: Es posible adoptar, con matices (requiere plan de acción preventivo)."
        )
    else:
        recommendation = EvaluationVerdict.RECOMMENDATION_C
        failed_list = "; ".join(critical_failures)
        explanation = (
            "El software candidato presenta debilidades o amenazas en factores de alta importancia (IR >= 3): "
            f"[{failed_list}]. Se emite la Recomendación C: Se sugiere analizar la adopción y posponerla hasta que "
            "se cuente con recursos técnicos o planes de mitigación estructurales."
        )

    from django.utils import timezone
    evaluation.status = Evaluation.STATUS_COMPLETED
    evaluation.completed_at = timezone.now()
    evaluation.save(update_fields=['status', 'completed_at'])

    verdict, _ = EvaluationVerdict.objects.update_or_create(
        evaluation=evaluation,
        defaults={
            'recommendation': recommendation,
            'explanation_text': explanation,
            'ai_executive_summary': ai_executive_summary,
            'ai_mitigation_plan': ai_mitigation_plan,
        }
    )

    return verdict
