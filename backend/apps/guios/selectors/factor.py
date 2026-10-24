"""
apps/guios/selectors/factor.py
─────────────────────────────────────────────────────────────────────────────
Capa Selector (Repository Pattern) para el modelo Factor.
ÚNICA capa responsable de ejecutar consultas ORM y optimizar queries.
Previene N+1 mediante select_related y anotaciones de conteo.
"""

from django.db.models import Count, Prefetch, Q, QuerySet
from apps.guios.models import Factor, Subfactor
from apps.guios.exceptions import FactorNotFoundError


def get_factors_queryset(
    *,
    dimension_id: int | None = None,
    scope: str | None = None,
    is_base: bool | None = None,
    is_active: bool | None = None,
    search: str | None = None,
) -> QuerySet[Factor]:
    """
    Retorna el QuerySet optimizado de factores con la dimensión asociada
    (select_related) y el conteo de subfactores (annotate) para evitar N+1.
    """
    qs = (
        Factor.objects.select_related('dimension')
        .annotate(subfactors_count=Count('subfactors', distinct=True))
        .order_by('dimension__order', 'order', 'id')
    )

    if dimension_id is not None:
        qs = qs.filter(dimension_id=dimension_id)

    if scope:
        qs = qs.filter(scope=scope)

    if is_base is not None:
        qs = qs.filter(is_base=is_base)

    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    if search:
        search_stripped = search.strip()
        qs = qs.filter(
            Q(name__icontains=search_stripped) |
            Q(dimension__name__icontains=search_stripped)
        )

    return qs


def get_factor_by_id(factor_id: int) -> Factor | None:
    """
    Obtiene un factor por ID pre-cargando su dimensión, sus subfactores
    ordenados y el conteo total de subfactores.
    """
    subfactors_prefetch = Prefetch(
        'subfactors',
        queryset=Subfactor.objects.order_by('order', 'id'),
        to_attr='prefetched_subfactors'
    )

    return (
        Factor.objects.select_related('dimension')
        .annotate(subfactors_count=Count('subfactors', distinct=True))
        .prefetch_related(subfactors_prefetch)
        .filter(pk=factor_id)
        .first()
    )


def get_factor_or_error(factor_id: int) -> Factor:
    """
    Obtiene el factor por ID o lanza FactorNotFoundError si no existe.
    """
    factor = get_factor_by_id(factor_id)
    if not factor:
        raise FactorNotFoundError(f"El factor con ID {factor_id} no existe.")
    return factor


def factor_exists_in_dimension(
    dimension_id: int,
    name: str,
    *,
    exclude_id: int | None = None
) -> bool:
    """
    Verifica si ya existe un factor con el mismo nombre dentro de la misma dimensión (case-insensitive).
    """
    qs = Factor.objects.filter(dimension_id=dimension_id, name__iexact=name.strip())
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    return qs.exists()
