import hashlib
import hmac
from typing import Optional
from uuid import UUID

from ..models import Evaluation, EvaluationFactor, EvaluationSubfactor
from ..services.engine import FactorInput, SubfactorInput


def hash_session_token(token: str) -> str:
    """En la base solo se guarda el SHA-256 del token de sesión anónima."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def get_evaluation_by_token(evaluation_uuid: UUID, token: str) -> Optional[Evaluation]:
    """Devuelve la evaluación solo si el token corresponde; si no, None."""
    evaluation = Evaluation.objects.filter(uuid=evaluation_uuid).first()
    if evaluation is None or not evaluation.session_token:
        return None
    if not hmac.compare_digest(evaluation.session_token, hash_session_token(token)):
        return None
    return evaluation


def evaluation_factors(evaluation: Evaluation):
    """Factores de la evaluación en el orden del catálogo, con sus subfactores."""
    subfactors = (
        EvaluationSubfactor.objects
        .select_related('subfactor')
        .order_by('subfactor__order', 'subfactor_id')
    )
    factors = list(
        EvaluationFactor.objects
        .filter(evaluation=evaluation)
        .select_related('factor', 'factor__dimension')
        .order_by('factor__dimension__order', 'factor__dimension_id', 'factor__order', 'factor_id')
    )
    by_factor = {}
    for item in subfactors.filter(evaluation=evaluation):
        by_factor.setdefault(item.subfactor.factor_id, []).append(item)
    for item in factors:
        item.items = by_factor.get(item.factor_id, [])
    return factors


def get_evaluation_factor(evaluation: Evaluation, factor_id: int) -> Optional[EvaluationFactor]:
    return (
        EvaluationFactor.objects
        .select_related('factor')
        .filter(evaluation=evaluation, factor_id=factor_id)
        .first()
    )


def get_evaluation_subfactor(evaluation: Evaluation, subfactor_id: int) -> Optional[EvaluationSubfactor]:
    return EvaluationSubfactor.objects.filter(evaluation=evaluation, subfactor_id=subfactor_id).first()


def build_engine_inputs(factors) -> list[FactorInput]:
    """
    Entradas del motor a partir de las instantáneas de la evaluación (RN-08):
    IS, nombre del factor y texto del subfactor no dependen del catálogo vivo.
    Los códigos del motor son los ids del catálogo, para volver a los registros.
    """
    return [
        FactorInput(
            code=str(item.factor_id),
            name=item.factor_name_snapshot,
            suggested_importance=item.suggested_importance_snapshot,
            decisor_importance=item.decisor_importance,
            scope=item.scope_used or None,
            scope_configurable=item.factor.scope_configurable,
            subfactors=tuple(
                SubfactorInput(str(sub.subfactor_id), sub.description_snapshot, sub.rating)
                for sub in item.items
            ),
        )
        for item in factors
    ]

