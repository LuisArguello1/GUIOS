"""
apps/guios/selectors/dimension.py
─────────────────────────────────────────────────────────────────────────────
Capa Selector (Repository Pattern) para el modelo Dimension.
ÚNICA capa responsable de ejecutar consultas ORM y optimizar queries.
"""

from django.db.models import Count, Prefetch, Q, QuerySet
from apps.guios.models import Dimension, Factor
from apps.guios.exceptions import DimensionNotFoundError


def get_dimensions_queryset(
    *,
    search: str | None = None,
    is_base: bool | None = None,
) -> QuerySet[Dimension]:
    """
    Retorna el QuerySet optimizado de dimensiones con el conteo de factores activos.
    Previene el antipatrón N+1 anotando 'factors_count' directamente en la consulta.
    """
    qs = Dimension.objects.annotate(
        factors_count=Count('factors', filter=Q(factors__is_active=True))
    ).order_by('order', 'id')

    if search:
        search_stripped = search.strip()
        qs = qs.filter(
            Q(name__icontains=search_stripped) |
            Q(description__icontains=search_stripped)
        )

    if is_base is not None:
        qs = qs.filter(is_base=is_base)

    return qs


def get_dimension_by_id(dimension_id: int) -> Dimension | None:
    """
    Obtiene una dimensión específica por ID incluyendo sus factores activos pre-cargados
    y el conteo total de factores.
    """
    factors_prefetch = Prefetch(
        'factors',
        queryset=Factor.objects.filter(is_active=True).order_by('order', 'id'),
        to_attr='active_factors'
    )

    return (
        Dimension.objects.annotate(
            factors_count=Count('factors', filter=Q(factors__is_active=True))
        )
        .prefetch_related(factors_prefetch)
        .filter(pk=dimension_id)
        .first()
    )


def get_dimension_or_error(dimension_id: int) -> Dimension:
    """
    Obtiene la dimensión por ID o lanza DimensionNotFoundError si no existe.
    """
    dimension = get_dimension_by_id(dimension_id)
    if not dimension:
        raise DimensionNotFoundError(f"La dimensión con ID {dimension_id} no existe.")
    return dimension


def dimension_exists_by_name(name: str, *, exclude_id: int | None = None) -> bool:
    """
    Verifica si ya existe una dimensión con el nombre indicado (case-insensitive).
    Permite excluir un ID para validación en actualizaciones.
    """
    qs = Dimension.objects.filter(name__iexact=name.strip())
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    return qs.exists()
