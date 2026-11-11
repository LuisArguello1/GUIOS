"""
apps/guios/services/factor.py
─────────────────────────────────────────────────────────────────────────────
Capa Service para la lógica de negocio y mutaciones del modelo Factor.
Asegura atomicidad de transacciones, valida reglas de negocio y delega queries a selectors.
"""

from django.db import transaction

from apps.guios.models import Factor
from apps.guios.exceptions import (
    FactorNotFoundError,
    FactorAlreadyExistsError,
    FactorCannotBeDeletedError,
)
from apps.guios.selectors.dimension import get_dimension_or_error
from apps.guios.selectors.factor import (
    get_factor_or_error,
    factor_exists_in_dimension,
)
from apps.guios.services.calculations.suggested_importance import calculate_systemic_importance


@transaction.atomic
def create_factor(
    *,
    dimension_id: int,
    name: str,
    scope: str = Factor.SCOPE_INTERNAL,
    scope_configurable: bool = False,
    expert_importance: int = 3,
    literature_importance_base: int = 1,
    systemic_importance: int | None = None,
    order: int = 0,
    is_active: bool = True,
) -> Factor:
    """
    Crea un nuevo factor dentro de una dimensión.
    Si no se provee 'systemic_importance', se autocalcula usando la matriz
    metodológica cruzando (literature_importance_base x expert_importance).
    """
    # 1. Validar existencia de la dimensión padre
    dimension = get_dimension_or_error(dimension_id)

    # 2. Validar unicidad del nombre dentro de la dimensión
    clean_name = name.strip()
    if factor_exists_in_dimension(dimension_id, clean_name):
        raise FactorAlreadyExistsError(
            f"Ya existe un factor con el nombre '{clean_name}' en la dimensión '{dimension.name}'."
        )

    # 3. Calcular IS si no fue explícitamente suministrado
    if systemic_importance is None:
        systemic_importance = calculate_systemic_importance(
            literature_importance=literature_importance_base,
            expert_importance=expert_importance,
        )

    # 4. Crear factor
    factor = Factor.objects.create(
        dimension=dimension,
        name=clean_name,
        scope=scope,
        scope_configurable=scope_configurable,
        expert_importance=expert_importance,
        literature_importance_base=literature_importance_base,
        systemic_importance=systemic_importance,
        order=order,
        is_base=False,
        is_active=is_active,
    )

    return factor


@transaction.atomic
def update_factor(
    *,
    factor_id: int,
    dimension_id: int | None = None,
    name: str | None = None,
    scope: str | None = None,
    scope_configurable: bool | None = None,
    expert_importance: int | None = None,
    literature_importance_base: int | None = None,
    systemic_importance: int | None = None,
    order: int | None = None,
    is_active: bool | None = None,
) -> Factor:
    """
    Actualiza los campos de un factor existente con validación de unicidad
    y recálculo automático de IS si cambian IE o IL sin IS explícito.
    """
    factor = get_factor_or_error(factor_id)
    target_dimension_id = dimension_id if dimension_id is not None else factor.dimension_id
    dimension = get_dimension_or_error(target_dimension_id)

    # Validar unicidad si cambia el nombre o la dimensión
    if name is not None or dimension_id is not None:
        target_name = (name or factor.name).strip()
        if factor_exists_in_dimension(target_dimension_id, target_name, exclude_id=factor.id):
            raise FactorAlreadyExistsError(
                f"Ya existe un factor con el nombre '{target_name}' en la dimensión '{dimension.name}'."
            )
        factor.name = target_name
        factor.dimension = dimension

    if scope is not None:
        factor.scope = scope

    if scope_configurable is not None:
        factor.scope_configurable = scope_configurable

    if order is not None:
        factor.order = order

    if is_active is not None:
        factor.is_active = is_active

    # Manejo de métricas de importancia
    ie_changed = expert_importance is not None and expert_importance != factor.expert_importance
    il_changed = literature_importance_base is not None and literature_importance_base != factor.literature_importance_base

    if expert_importance is not None:
        factor.expert_importance = expert_importance

    if literature_importance_base is not None:
        factor.literature_importance_base = literature_importance_base

    if systemic_importance is not None:
        factor.systemic_importance = systemic_importance
    elif ie_changed or il_changed:
        # Recalcular IS si cambiaron IE o IL sin haber recibido IS manual
        factor.systemic_importance = calculate_systemic_importance(
            literature_importance=factor.literature_importance_base,
            expert_importance=factor.expert_importance,
        )

    factor.save()
    return factor


@transaction.atomic
def delete_factor(*, factor_id: int) -> None:
    """
    Elimina un factor validando las reglas de integridad de negocio:
    1. PROHIBIDO eliminar factores base de la tesis (is_base=True).
    2. PROHIBIDO eliminar factores que posean subfactores asociados.
    3. PROHIBIDO eliminar factores asociados a evaluaciones existentes.
    """
    factor = get_factor_or_error(factor_id)

    # Regla 1: No eliminar factores base
    if factor.is_base:
        raise FactorCannotBeDeletedError(
            f"No es posible eliminar el factor '{factor.name}' porque pertenece "
            f"al catálogo base oficial de la metodología GUIOS (Rea Sánchez, 2022)."
        )

    # Regla 2: No eliminar con subfactores asociados
    subfactors_count = factor.subfactors.count()
    if subfactors_count > 0:
        raise FactorCannotBeDeletedError(
            f"No es posible eliminar el factor '{factor.name}' porque contiene "
            f"{subfactors_count} subfactor(es) asociado(s). Elimine o reasigne "
            f"los subfactores primero."
        )

    # Regla 3: No eliminar con evaluaciones existentes
    if factor.evaluation_factors.exists():
        raise FactorCannotBeDeletedError(
            f"No es posible eliminar el factor '{factor.name}' porque está "
            f"referenciado en evaluaciones registradas en el sistema."
        )

    factor.delete()
