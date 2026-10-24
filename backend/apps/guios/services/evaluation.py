"""
apps/guios/services/evaluation.py
─────────────────────────────────────────────────────────────────────────────
Capa de servicios de negocio para Evaluaciones de Software en GUIOS.
Orquesta de forma atómica (@transaction.atomic) el ciclo de vida de la evaluación
y delega el cálculo matemático riguroso a methodology.py.
"""

from typing import Optional, Any
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError

from apps.guios.models import Evaluation, EvaluationFactor, EvaluationResult, EvaluationVerdict
from apps.guios.exceptions import (
    EvaluationNotFoundError,
    EvaluationAlreadyCompletedError,
    EvaluationValidationError,
)
from apps.guios.selectors.evaluation import get_evaluation_or_error
from apps.guios.services.methodology import (
    compute_evaluation_literature_metrics,
    apply_step1_decisor_importance,
    apply_step3_subfactor_ratings_and_foda,
    compute_final_verdict,
)


@transaction.atomic
def create_evaluation(
    *,
    software_name: str,
    org_name: str,
    software_category: str = "",
    software_version: str = "",
    software_repo_url: Optional[str] = None,
    software_description: str = "",
    org_sector: str = "",
    org_description: str = "",
    ai_enabled: bool = False,
    user: Optional[Any] = None,
    session_token: Optional[str] = None,
    auto_compute_literature: bool = True,
) -> Evaluation:
    """
    Crea una nueva sesión de evaluación institucional de software libre (FLOSS).
    Si auto_compute_literature es True, inicializa de inmediato la Fase 3 / Paso 0
    poblando los factores, razones r_i, cuartiles e Importancia Sugerida (IS).
    """
    clean_software_name = software_name.strip()
    clean_org_name = org_name.strip()

    if not clean_software_name:
        raise EvaluationValidationError("El nombre del software candidato es obligatorio.")
    if not clean_org_name:
        raise EvaluationValidationError("El nombre de la organización evaluadora es obligatorio.")

    evaluation = Evaluation.objects.create(
        software_name=clean_software_name,
        software_category=software_category.strip(),
        software_version=software_version.strip(),
        software_repo_url=software_repo_url.strip() if software_repo_url else None,
        software_description=software_description.strip(),
        org_name=clean_org_name,
        org_sector=org_sector.strip(),
        org_description=org_description.strip(),
        ai_enabled=ai_enabled,
        created_by=user if user and user.is_authenticated else None,
        session_token=session_token,
        status=Evaluation.STATUS_IN_PROGRESS,
    )

    if auto_compute_literature:
        try:
            compute_evaluation_literature_metrics(evaluation)
        except DjangoValidationError as e:
            raise EvaluationValidationError(str(e))

    return evaluation


@transaction.atomic
def update_evaluation(
    *,
    evaluation_id: int | str,
    software_name: Optional[str] = None,
    software_category: Optional[str] = None,
    software_version: Optional[str] = None,
    software_repo_url: Optional[str] = None,
    software_description: Optional[str] = None,
    org_name: Optional[str] = None,
    org_sector: Optional[str] = None,
    org_description: Optional[str] = None,
) -> Evaluation:
    """
    Actualiza los metadatos descriptivos de la evaluación.
    Impide modificaciones si la evaluación ya fue concluida (STATUS_COMPLETED).
    """
    evaluation = get_evaluation_or_error(evaluation_id)

    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"La evaluación #{evaluation.id} ya se encuentra completada y su historial está protegido."
        )

    update_fields = []

    if software_name is not None:
        clean_name = software_name.strip()
        if not clean_name:
            raise EvaluationValidationError("El nombre del software no puede estar vacío.")
        evaluation.software_name = clean_name
        update_fields.append('software_name')

    if org_name is not None:
        clean_org = org_name.strip()
        if not clean_org:
            raise EvaluationValidationError("El nombre de la organización no puede estar vacío.")
        evaluation.org_name = clean_org
        update_fields.append('org_name')

    if software_category is not None:
        evaluation.software_category = software_category.strip()
        update_fields.append('software_category')

    if software_version is not None:
        evaluation.software_version = software_version.strip()
        update_fields.append('software_version')

    if software_repo_url is not None:
        evaluation.software_repo_url = software_repo_url.strip() if software_repo_url else None
        update_fields.append('software_repo_url')

    if software_description is not None:
        evaluation.software_description = software_description.strip()
        update_fields.append('software_description')

    if org_sector is not None:
        evaluation.org_sector = org_sector.strip()
        update_fields.append('org_sector')

    if org_description is not None:
        evaluation.org_description = org_description.strip()
        update_fields.append('org_description')

    if update_fields:
        evaluation.save(update_fields=update_fields)

    return evaluation


@transaction.atomic
def calculate_evaluation_literature(
    evaluation_id: int | str,
    *,
    ai_citations_by_subfactor: Optional[dict[int, int]] = None,
    ai_sources_by_factor: Optional[dict[int, list[dict]]] = None,
) -> Evaluation:
    """
    Ejecuta el cálculo de literatura científica, cuartiles e Importancia Sugerida (Fase 3 / Paso 0).
    """
    evaluation = get_evaluation_or_error(evaluation_id)

    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"La evaluación #{evaluation.id} ya fue finalizada; no se pueden recalcular sus métricas base."
        )

    try:
        return compute_evaluation_literature_metrics(
            evaluation=evaluation,
            ai_citations_by_subfactor=ai_citations_by_subfactor,
            ai_sources_by_factor=ai_sources_by_factor,
        )
    except DjangoValidationError as e:
        raise EvaluationValidationError(str(e))


@transaction.atomic
def save_decisor_importance(
    evaluation_id: int | str,
    *,
    decisor_data: list[dict],
) -> list[EvaluationFactor]:
    """
    Registra el criterio de importancia del decisor (ID: 1 a 4) y ámbito para cada factor.
    Calcula IR = Matriz(ID, IS) y filtra los factores relevantes (IR > 1).
    """
    evaluation = get_evaluation_or_error(evaluation_id)

    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"La evaluación #{evaluation.id} ya se encuentra completada."
        )

    if not decisor_data:
        raise EvaluationValidationError("Debe proporcionar la lista de factores y su ponderación del decisor.")

    # Validar formato y rango de valores
    for idx, item in enumerate(decisor_data):
        if 'factor_id' not in item:
            raise EvaluationValidationError(f"El elemento #{idx} no incluye 'factor_id'.")
        if 'decisor_importance' not in item:
            raise EvaluationValidationError(f"El elemento #{idx} no incluye 'decisor_importance'.")

        id_val = item['decisor_importance']
        if id_val not in (1, 2, 3, 4):
            raise EvaluationValidationError(
                f"La Importancia del Decisor (ID) debe estar entre 1 y 4 (recibido: {id_val})."
            )

    try:
        return apply_step1_decisor_importance(evaluation=evaluation, decisor_data=decisor_data)
    except DjangoValidationError as e:
        raise EvaluationValidationError(str(e))


@transaction.atomic
def save_subfactor_ratings(
    evaluation_id: int | str,
    *,
    ratings_by_subfactor: dict[int, int],
) -> list[EvaluationResult]:
    """
    Registra las calificaciones (1 a 4) de cumplimiento de subfactores y computa FODA.
    """
    evaluation = get_evaluation_or_error(evaluation_id)

    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"La evaluación #{evaluation.id} ya se encuentra completada."
        )

    if not ratings_by_subfactor:
        raise EvaluationValidationError("Debe enviar las calificaciones de los subfactores evaluados.")

    # Validar que los ratings estén en escala [1, 4]
    clean_ratings: dict[int, int] = {}
    for sf_id, val in ratings_by_subfactor.items():
        try:
            numeric_val = int(val)
        except (ValueError, TypeError):
            raise EvaluationValidationError(f"La calificación para el subfactor #{sf_id} debe ser numérica.")

        if numeric_val not in (1, 2, 3, 4):
            raise EvaluationValidationError(
                f"La calificación para el subfactor #{sf_id} debe estar en el rango de 1 a 4 (recibido: {numeric_val})."
            )
        clean_ratings[int(sf_id)] = numeric_val

    try:
        return apply_step3_subfactor_ratings_and_foda(
            evaluation=evaluation,
            ratings_by_subfactor=clean_ratings,
        )
    except DjangoValidationError as e:
        raise EvaluationValidationError(str(e))


@transaction.atomic
def generate_evaluation_verdict(
    evaluation_id: int | str,
    *,
    ai_executive_summary: str = "",
    ai_mitigation_plan: str = "",
) -> EvaluationVerdict:
    """
    Calcula y emite el dictamen final determinista (Recomendación A, B o C)
    y finaliza la sesión de evaluación (STATUS_COMPLETED).
    """
    evaluation = get_evaluation_or_error(evaluation_id)

    try:
        return compute_final_verdict(
            evaluation=evaluation,
            ai_executive_summary=ai_executive_summary.strip(),
            ai_mitigation_plan=ai_mitigation_plan.strip(),
        )
    except DjangoValidationError as e:
        raise EvaluationValidationError(str(e))


@transaction.atomic
def delete_evaluation(evaluation_id: int | str) -> bool:
    """
    Elimina una sesión de evaluación y sus registros hijos en cascada.
    """
    evaluation = get_evaluation_or_error(evaluation_id)
    evaluation.delete()
    return True
