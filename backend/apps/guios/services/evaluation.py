"""
apps/guios/services/evaluation.py
─────────────────────────────────────────────────────────────────────────────
Capa de servicios de negocio para Evaluaciones de Software en GUIOS.
Orquesta de forma atómica (@transaction.atomic) el ciclo de vida de la evaluación
y delega el cálculo matemático riguroso a methodology.py.
"""

from typing import Optional, Any
from django.core.cache import cache
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError

from apps.guios.models import (
    AIAssistanceLog,
    Evaluation,
    EvaluationFactor,
    EvaluationResult,
    EvaluationVerdict,
)
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
    org_size: str = "",
    it_staff: str = "",
    replaced_software: str = "",
    target_timeline: str = "",
    current_platforms: str = "",
    main_goal: str = "",
    ai_enabled: bool = False,
    user: Optional[Any] = None,
    session_token: Optional[str] = None,
    auto_compute_literature: bool = True,
    data_storage_consent: bool = False,
    ai_processing_consent: bool = False,
    consent_ip_hash: str = "",
    privacy_policy_version: str = "1.0",
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

    if not data_storage_consent:
        raise EvaluationValidationError(
            "Debe autorizar el almacenamiento anónimo de los datos para fines estadísticos e investigación."
        )
    if ai_enabled and not ai_processing_consent:
        raise EvaluationValidationError(
            "Para habilitar la IA debe autorizar el procesamiento de los datos por los modelos cognitivos."
        )

    evaluation = Evaluation.objects.create(
        software_name=clean_software_name,
        software_category=software_category.strip(),
        software_version=software_version.strip(),
        software_repo_url=software_repo_url.strip() if software_repo_url else None,
        software_description=software_description.strip(),
        org_name=clean_org_name,
        org_sector=org_sector.strip(),
        org_description=org_description.strip(),
        org_size=org_size.strip(),
        it_staff=it_staff.strip(),
        replaced_software=replaced_software.strip(),
        target_timeline=target_timeline.strip(),
        current_platforms=current_platforms.strip(),
        main_goal=main_goal.strip(),
        ai_enabled=ai_enabled,
        created_by=user if user and user.is_authenticated else None,
        session_token=session_token,
        status=Evaluation.STATUS_IN_PROGRESS,
        data_storage_consent=data_storage_consent,
        ai_processing_consent=ai_processing_consent,
        consent_timestamp=timezone.now() if data_storage_consent else None,
        consent_ip_hash=consent_ip_hash,
        privacy_policy_version=privacy_policy_version,
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
    org_size: Optional[str] = None,
    it_staff: Optional[str] = None,
    replaced_software: Optional[str] = None,
    target_timeline: Optional[str] = None,
    current_platforms: Optional[str] = None,
    main_goal: Optional[str] = None,
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

    if org_size is not None:
        evaluation.org_size = org_size.strip()
        update_fields.append('org_size')

    if it_staff is not None:
        evaluation.it_staff = it_staff.strip()
        update_fields.append('it_staff')

    if replaced_software is not None:
        evaluation.replaced_software = replaced_software.strip()
        update_fields.append('replaced_software')

    if target_timeline is not None:
        evaluation.target_timeline = target_timeline.strip()
        update_fields.append('target_timeline')

    if current_platforms is not None:
        evaluation.current_platforms = current_platforms.strip()
        update_fields.append('current_platforms')

    if main_goal is not None:
        evaluation.main_goal = main_goal.strip()
        update_fields.append('main_goal')

    if update_fields:
        evaluation.save(update_fields=update_fields)

    return evaluation


def _scale_1_to_4(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number < 1 or number > 4:
        return None
    return number


def _positive_id(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number < 1:
        return None
    return number


def _rating_items(payload: dict, request: dict):
    ratings = payload.get("ratings")
    if isinstance(ratings, dict):
        for key, item in ratings.items():
            if isinstance(item, dict):
                yield key, item
        return
    if isinstance(ratings, list):
        for item in ratings:
            if isinstance(item, dict):
                yield item.get("subfactor_id") or item.get("id"), item
        return
    subfactor_id = request.get("subfactor_id")
    if subfactor_id is not None and payload.get("suggested_rating") is not None:
        yield subfactor_id, {
            "rating": payload.get("suggested_rating"),
            "justification": payload.get("justification") or "",
        }


def restore_ai_suggestions_from_logs(evaluation: Evaluation) -> None:
    """
    Copia la última sugerencia exitosa de cada factor y subfactor desde AIAssistanceLog
    hacia las columnas de la evaluación. El detalle y el asistente leen esas columnas.
    """
    logs = AIAssistanceLog.objects.filter(
        evaluation_id=evaluation.id,
        status=AIAssistanceLog.STATUS_SUCCESS,
        request_type__in=(
            AIAssistanceLog.REQ_FACTOR_IMPORTANCE,
            AIAssistanceLog.REQ_SUBFACTOR_RATING,
        ),
    ).order_by("requested_at", "id")

    factors = {row.factor_id: row for row in evaluation.evaluation_factors.all()}
    subfactors = {row.subfactor_id: row for row in evaluation.evaluation_subfactors.all()}

    for log in logs:
        payload = log.response_payload if isinstance(log.response_payload, dict) else {}
        request = log.request_payload if isinstance(log.request_payload, dict) else {}
        if log.request_type == AIAssistanceLog.REQ_FACTOR_IMPORTANCE:
            factor_id = log.factor_id if log.factor_id is not None else _positive_id(request.get("factor_id"))
            row = factors.get(factor_id)
            suggested = _scale_1_to_4(payload.get("suggested_id"))
            if row is None or suggested is None:
                continue
            justification = str(payload.get("justification") or "").strip()
            if not justification and (row.ai_id_justification or "").strip():
                continue
            if row.ai_suggested_id == suggested and (row.ai_id_justification or "") == justification:
                continue
            row.ai_suggested_id = suggested
            row.ai_id_justification = justification
            row.save(update_fields=["ai_suggested_id", "ai_id_justification"])
            continue

        for key, item in _rating_items(payload, request):
            subfactor_id = _positive_id(item.get("subfactor_id") or item.get("id") or key)
            rating = _scale_1_to_4(item.get("rating") if item.get("rating") is not None else item.get("suggested_rating"))
            row = subfactors.get(subfactor_id) if subfactor_id is not None else None
            if row is None or rating is None:
                continue
            justification = str(item.get("justification") or "").strip()
            if not justification and (row.ai_rating_justification or "").strip():
                continue
            if row.ai_suggested_rating == rating and (row.ai_rating_justification or "") == justification:
                continue
            row.ai_suggested_rating = rating
            row.ai_rating_justification = justification
            row.save(update_fields=["ai_suggested_rating", "ai_rating_justification"])


def store_factor_rating_suggestions(rows, ratings: dict | None) -> list[dict]:
    """Guarda las notas sugeridas del factor activo sin cerrar la calificación oficial."""
    stored: list[dict] = []
    for row in rows:
        item = (ratings or {}).get(row.subfactor_id)
        if item is None:
            item = (ratings or {}).get(str(row.subfactor_id))
        if not isinstance(item, dict):
            continue
        try:
            rating = int(item.get("rating") or item.get("suggested_rating"))
        except (TypeError, ValueError):
            continue
        if rating < 1 or rating > 4:
            continue
        justification = str(item.get("justification") or "")
        row.ai_suggested_rating = rating
        row.ai_rating_justification = justification
        row.save(update_fields=["ai_suggested_rating", "ai_rating_justification"])
        stored.append({
            "subfactor_id": row.subfactor_id,
            "suggested_rating": rating,
            "justification": justification,
        })
    return stored


@transaction.atomic
def calculate_evaluation_literature(
    evaluation_id: int | str,
    *,
    ai_citations_by_subfactor: Optional[dict[int, int]] = None,
    ai_sources_by_factor: Optional[dict[int, list[dict]]] = None,
    ai_ratings_by_subfactor: Optional[dict] = None,
    ai_importance_by_factor: Optional[dict] = None,
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
            ai_ratings_by_subfactor=ai_ratings_by_subfactor,
            ai_importance_by_factor=ai_importance_by_factor,
        )
    except DjangoValidationError as e:
        raise EvaluationValidationError(str(e))


_PHASES_LOCKED_CACHE_TTL = 86400 * 30


def _phases_locked_cache_key(evaluation_id: int | str) -> str:
    return f"guios_eval_phases_locked:{evaluation_id}"


def is_evaluation_phases_locked(evaluation: Evaluation) -> bool:
    """
    Determina si las Fases 1 y 2 están bloqueadas porque la evaluación ya avanzó a Fase 3
    o ya fue finalizada.
    """
    if evaluation.status == Evaluation.STATUS_COMPLETED:
        return True
    if EvaluationVerdict.objects.filter(evaluation_id=evaluation.id).exists():
        return True
    if str(evaluation.privacy_policy_version or '').endswith('-locked'):
        return True
    return bool(cache.get(_phases_locked_cache_key(evaluation.id)))


@transaction.atomic
def lock_evaluation_phases(evaluation_id: int | str) -> Evaluation:
    """
    Persiste el bloqueo de las Fases 1 y 2 cuando el usuario confirma su avance a la Fase 3.
    Requiere que exista al menos un resultado calculado para factores relevantes.
    """
    evaluation = get_evaluation_or_error(evaluation_id)

    relevant_factor_ids = EvaluationFactor.objects.filter(
        evaluation_id=evaluation.id,
        is_relevant=True,
    ).values_list('factor_id', flat=True)
    has_results = EvaluationResult.objects.filter(
        evaluation_id=evaluation.id,
        factor_id__in=relevant_factor_ids,
    ).exists()
    if not has_results:
        raise EvaluationValidationError(
            "Debes calificar y guardar al menos un factor relevante antes de avanzar y bloquear las fases 1 y 2."
        )

    cache.set(_phases_locked_cache_key(evaluation.id), True, timeout=_PHASES_LOCKED_CACHE_TTL)

    current_version = str(evaluation.privacy_policy_version or '1.0')
    if not current_version.endswith('-locked'):
        suffix = '-locked'
        max_base_len = 20 - len(suffix)
        evaluation.privacy_policy_version = f"{current_version[:max_base_len]}{suffix}"
        evaluation.save(update_fields=['privacy_policy_version'])

    return evaluation


@transaction.atomic
def disable_evaluation_ai(evaluation_id: int | str) -> Evaluation:
    """
    Desactiva la asistencia de IA para una evaluación específica (cuando el usuario elige
    'Continuar sin IA'), asegurando las métricas base del catálogo y desbloqueando la edición.
    """
    evaluation = get_evaluation_or_error(evaluation_id)
    if evaluation.status == Evaluation.STATUS_COMPLETED:
        return evaluation

    if not evaluation.evaluation_factors.exists():
        calculate_evaluation_literature(evaluation_id=evaluation.id)

    evaluation.ai_enabled = False
    evaluation.ai_status = Evaluation.AI_STATUS_PENDING
    evaluation.save(update_fields=['ai_enabled', 'ai_status'])
    return evaluation


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

    if is_evaluation_phases_locked(evaluation):
        raise EvaluationAlreadyCompletedError(
            "Las fases 1 y 2 están bloqueadas porque la evaluación ya avanzó a la Fase 3."
        )

    if evaluation.ai_enabled and evaluation.ai_status == Evaluation.AI_STATUS_SEARCHING:
        raise EvaluationValidationError(
            "La búsqueda de literatura sigue en curso. Espere a que termine para registrar la importancia del decisor."
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

    if is_evaluation_phases_locked(evaluation):
        raise EvaluationAlreadyCompletedError(
            "Las fases 1 y 2 están bloqueadas porque la evaluación ya avanzó a la Fase 3."
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
