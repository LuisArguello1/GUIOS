from django.db.models import Exists, OuterRef, Prefetch, QuerySet

from ..models import Dimension, Factor, Subfactor


def active_subfactors() -> QuerySet[Subfactor]:
    return Subfactor.objects.filter(is_active=True).order_by('order', 'id')


def evaluable_factors() -> QuerySet[Factor]:
    """
    Factores activos con al menos un subfactor activo (§8.2: un factor sin
    subfactores activos no se puede evaluar), en el orden del catálogo.
    """
    has_active_subfactors = Exists(
        Subfactor.objects.filter(factor=OuterRef('pk'), is_active=True)
    )
    return (
        Factor.objects
        .filter(is_active=True)
        .filter(has_active_subfactors)
        .select_related('dimension')
        .prefetch_related(Prefetch('subfactors', queryset=active_subfactors(), to_attr='active_subfactors'))
        .order_by('dimension__order', 'dimension_id', 'order', 'id')
    )


def get_active_catalog() -> list[Dimension]:
    """
    Catálogo para evaluar: dimensiones con sus factores evaluables y sus
    subfactores activos. Las dimensiones sin factores evaluables se omiten.
    Cada dimensión recibe ``evaluable_factors`` y cada factor ``active_subfactors``.
    """
    dimensions = list(
        Dimension.objects
        .prefetch_related(Prefetch('factors', queryset=evaluable_factors(), to_attr='evaluable_factors'))
        .order_by('order', 'id')
    )
    return [d for d in dimensions if d.evaluable_factors]
