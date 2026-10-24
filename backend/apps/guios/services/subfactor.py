"""
apps/guios/services/subfactor.py
─────────────────────────────────────────────────────────────────────────────
Capa Service para la lógica de negocio y mutaciones del modelo Subfactor.
Asegura atomicidad de transacciones, valida reglas de integridad de negocio
y delega queries a selectors.
"""

from django.db import transaction

from apps.guios.models import Subfactor
from apps.guios.exceptions import (
    SubfactorNotFoundError,
    SubfactorAlreadyExistsError,
    SubfactorCannotBeDeletedError,
)
from apps.guios.selectors.factor import get_factor_or_error
from apps.guios.selectors.subfactor import (
    get_subfactor_or_error,
    subfactor_exists_in_factor,
)


@transaction.atomic
def create_subfactor(
    *,
    factor_id: int,
    description: str,
    base_citations_count: int = 1,
    keywords_ia: str = "",
    order: int = 0,
    is_active: bool = True,
) -> Subfactor:
    """
    Crea un nuevo subfactor (afirmación verificable) asociado a un factor.
    Valida la existencia del factor y previene descripciones duplicadas en el mismo factor.
    """
    factor = get_factor_or_error(factor_id)
    clean_desc = description.strip()

    if subfactor_exists_in_factor(factor_id, clean_desc):
        raise SubfactorAlreadyExistsError(
            f"Ya existe un subfactor con la misma descripción en el factor '{factor.name}'."
        )

    subfactor = Subfactor.objects.create(
        factor=factor,
        description=clean_desc,
        base_citations_count=base_citations_count,
        keywords_ia=(keywords_ia or "").strip(),
        order=order,
        is_base=False,
        is_active=is_active,
    )

    return subfactor


@transaction.atomic
def update_subfactor(
    *,
    subfactor_id: int,
    factor_id: int | None = None,
    description: str | None = None,
    base_citations_count: int | None = None,
    keywords_ia: str | None = None,
    order: int | None = None,
    is_active: bool | None = None,
) -> Subfactor:
    """
    Actualiza los campos de un subfactor existente con validación de unicidad
    de descripción dentro del factor destino.
    """
    subfactor = get_subfactor_or_error(subfactor_id)
    target_factor_id = factor_id if factor_id is not None else subfactor.factor_id
    target_factor = get_factor_or_error(target_factor_id)

    if description is not None or factor_id is not None:
        target_desc = (description or subfactor.description).strip()
        if subfactor_exists_in_factor(target_factor_id, target_desc, exclude_id=subfactor.id):
            raise SubfactorAlreadyExistsError(
                f"Ya existe un subfactor con la misma descripción en el factor '{target_factor.name}'."
            )
        subfactor.description = target_desc
        subfactor.factor = target_factor

    if base_citations_count is not None:
        subfactor.base_citations_count = base_citations_count

    if keywords_ia is not None:
        subfactor.keywords_ia = keywords_ia.strip()

    if order is not None:
        subfactor.order = order

    if is_active is not None:
        subfactor.is_active = is_active

    subfactor.save()
    return subfactor


@transaction.atomic
def delete_subfactor(*, subfactor_id: int) -> None:
    """
    Elimina un subfactor validando las reglas de integridad de negocio:
    1. PROHIBIDO eliminar subfactores base de la tesis (is_base=True).
    2. PROHIBIDO eliminar subfactores referenciados en evaluaciones existentes (evaluation_subfactors).
    """
    subfactor = get_subfactor_or_error(subfactor_id)

    # Regla 1: No eliminar subfactores base
    if subfactor.is_base:
        raise SubfactorCannotBeDeletedError(
            f"No es posible eliminar el subfactor '{subfactor.description[:60]}...' "
            f"porque pertenece al catálogo base oficial de la metodología GUIOS (Rea Sánchez, 2022)."
        )

    # Regla 2: No eliminar subfactores presentes en evaluaciones
    if subfactor.evaluation_subfactors.exists():
        raise SubfactorCannotBeDeletedError(
            f"No es posible eliminar el subfactor '{subfactor.description[:60]}...' "
            f"porque está referenciado en evaluaciones registradas en el sistema."
        )

    subfactor.delete()
