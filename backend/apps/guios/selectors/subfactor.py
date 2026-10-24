"""
apps/guios/selectors/subfactor.py
─────────────────────────────────────────────────────────────────────────────
Capa Selector (Repository Pattern) para el modelo Subfactor.
ÚNICA capa responsable de ejecutar consultas ORM y optimizar queries.
Previene N+1 mediante select_related con Factor y Dimension.
"""

from django.db.models import Q, QuerySet
from apps.guios.models import Subfactor
from apps.guios.exceptions import SubfactorNotFoundError


def get_subfactors_queryset(
    *,
    factor_id: int | None = None,
    dimension_id: int | None = None,
    is_base: bool | None = None,
    is_active: bool | None = None,
    search: str | None = None,
) -> QuerySet[Subfactor]:
    """
    Retorna el QuerySet optimizado de subfactores con el factor y su dimensión
    asociada (select_related) para prevenir N+1 queries.
    """
    qs = (
        Subfactor.objects.select_related('factor', 'factor__dimension')
        .order_by('factor__dimension__order', 'factor__order', 'order', 'id')
    )

    if factor_id is not None:
        qs = qs.filter(factor_id=factor_id)

    if dimension_id is not None:
        qs = qs.filter(factor__dimension_id=dimension_id)

    if is_base is not None:
        qs = qs.filter(is_base=is_base)

    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    if search:
        search_stripped = search.strip()
        qs = qs.filter(
            Q(description__icontains=search_stripped) |
            Q(keywords_ia__icontains=search_stripped) |
            Q(factor__name__icontains=search_stripped) |
            Q(factor__dimension__name__icontains=search_stripped)
        )

    return qs


def get_subfactor_by_id(subfactor_id: int) -> Subfactor | None:
    """
    Obtiene un subfactor por su ID precargando el factor y la dimensión asociada.
    """
    return (
        Subfactor.objects.select_related('factor', 'factor__dimension')
        .filter(pk=subfactor_id)
        .first()
    )


def get_subfactor_or_error(subfactor_id: int) -> Subfactor:
    """
    Obtiene el subfactor por ID o lanza SubfactorNotFoundError si no existe.
    """
    subfactor = get_subfactor_by_id(subfactor_id)
    if not subfactor:
        raise SubfactorNotFoundError(f"El subfactor con ID {subfactor_id} no existe.")
    return subfactor


def subfactor_exists_in_factor(
    factor_id: int,
    description: str,
    *,
    exclude_id: int | None = None
) -> bool:
    """
    Verifica si ya existe un subfactor con la misma descripción (case-insensitive)
    dentro del mismo factor.
    """
    qs = Subfactor.objects.filter(factor_id=factor_id, description__iexact=description.strip())
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    return qs.exists()
