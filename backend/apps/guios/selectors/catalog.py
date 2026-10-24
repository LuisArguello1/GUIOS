from django.db.models import Count, Exists, OuterRef, Prefetch, Q, QuerySet

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


# ── Administración (Paso 7) ───────────────────────────────────────────────────

def admin_dimensions() -> QuerySet[Dimension]:
    return Dimension.objects.annotate(factors_count=Count('factors', distinct=True)).order_by('order', 'id')


def admin_factors() -> QuerySet[Factor]:
    return (
        Factor.objects
        .select_related('dimension')
        .annotate(
            subfactors_count=Count('subfactors', distinct=True),
            active_subfactors_count=Count('subfactors', filter=Q(subfactors__is_active=True), distinct=True),
            evaluations_count=Count('evaluation_factors__evaluation', distinct=True),
        )
        .order_by('dimension__order', 'dimension_id', 'order', 'id')
    )


def admin_subfactors() -> QuerySet[Subfactor]:
    return (
        Subfactor.objects
        .select_related('factor', 'factor__dimension')
        .annotate(evaluations_count=Count('evaluation_subfactors__evaluation', distinct=True))
        .order_by('factor__dimension__order', 'factor__order', 'factor_id', 'order', 'id')
    )


def get_admin_catalog_tree() -> list[Dimension]:
    """Árbol completo (incluye inactivos) con conteos para la vista del catálogo."""
    factors = admin_factors().prefetch_related(
        Prefetch('subfactors', queryset=admin_subfactors(), to_attr='admin_subfactors'),
    )
    return list(admin_dimensions().prefetch_related(
        Prefetch('factors', queryset=factors, to_attr='admin_factors'),
    ))
