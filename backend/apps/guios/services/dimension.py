"""
apps/guios/services/dimension.py
─────────────────────────────────────────────────────────────────────────────
Capa Service para la lógica de negocio y orquestación del modelo Dimension.
Garantiza atomicidad transaccional y cumplimiento de reglas de dominio.
"""

from django.db import transaction
from apps.guios.models import Dimension
from apps.guios.exceptions import (
    DimensionAlreadyExistsError,
    DimensionCannotBeDeletedError,
)
from apps.guios.selectors.dimension import (
    get_dimension_or_error,
    dimension_exists_by_name,
)


@transaction.atomic
def create_dimension(
    *,
    name: str,
    description: str = "",
    order: int = 0,
) -> Dimension:
    """
    Crea una nueva dimensión en el catálogo.
    Valida la unicidad del nombre antes de persistir.
    """
    clean_name = name.strip()
    if dimension_exists_by_name(clean_name):
        raise DimensionAlreadyExistsError(f"Ya existe una dimensión con el nombre '{clean_name}'.")

    dimension = Dimension.objects.create(
        name=clean_name,
        description=description.strip() if description else "",
        order=max(0, int(order)),
        is_base=False,  # Dimensiones creadas por usuarios nunca son base de la tesis
    )

    return dimension


@transaction.atomic
def update_dimension(
    dimension_id: int,
    *,
    name: str | None = None,
    description: str | None = None,
    order: int | None = None,
) -> Dimension:
    """
    Actualiza una dimensión existente.
    Si se modifica el nombre, verifica que no colisione con otra dimensión.
    """
    dimension = get_dimension_or_error(dimension_id)
    update_fields: list[str] = ['updated_at']

    if name is not None:
        clean_name = name.strip()
        if clean_name != dimension.name:
            if dimension_exists_by_name(clean_name, exclude_id=dimension.id):
                raise DimensionAlreadyExistsError(f"Ya existe otra dimensión con el nombre '{clean_name}'.")
            dimension.name = clean_name
            update_fields.append('name')

    if description is not None:
        dimension.description = description.strip()
        update_fields.append('description')

    if order is not None:
        dimension.order = max(0, int(order))
        update_fields.append('order')

    if len(update_fields) > 1:
        dimension.save(update_fields=update_fields)

    return dimension


@transaction.atomic
def delete_dimension(dimension_id: int) -> None:
    """
    Elimina una dimensión del sistema.
    
    Reglas de negocio estrictas:
    1. Si is_base=True (pertenece a la tesis doctoral): PROHIBIDO eliminar.
    2. Si tiene factores asociados: PROHIBIDO eliminar para mantener integridad referencial.
    """
    dimension = get_dimension_or_error(dimension_id)

    if dimension.is_base:
        raise DimensionCannotBeDeletedError(
            f"La dimensión '{dimension.name}' pertenece al catálogo base de la metodología y no puede ser eliminada."
        )

    if dimension.factors.exists():
        total_factors = dimension.factors.count()
        raise DimensionCannotBeDeletedError(
            f"No se puede eliminar la dimensión '{dimension.name}' porque contiene {total_factors} factor(es) asociados."
        )

    dimension.delete()
