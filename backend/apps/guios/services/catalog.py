"""
Reglas del CRUD administrativo del catálogo (Paso 7, docs/ANALISIS_GUIOS_ORIGINAL.md §8.2):

1. RN-07 / PROTECT: no se elimina una dimensión con factores, un factor con
   subfactores o evaluaciones, ni un subfactor con calificaciones (409).
2. Catálogo base (is_base): no se elimina; code, IS y ámbito son de solo lectura.
3. scope_configurable se deduce del ámbito ("both" = configurable).
4. Un factor activo debe tener al menos un subfactor activo: los factores nuevos se
   crean inactivos y no se puede quitar el último subfactor activo de uno activo.
5. Un subfactor con evaluaciones no se mueve a otro factor.

Los cambios los audita la señal genérica de apps/auth (el catálogo no está excluido).
"""
from django.db import transaction
from django.db.models import ProtectedError

from ..models import (
    Dimension,
    EvaluationFactor,
    EvaluationResult,
    EvaluationSubfactor,
    Factor,
    Subfactor,
)

BASE_LOCKED_FACTOR_FIELDS = ('suggested_importance', 'scope')


class CatalogConflict(Exception):
    """La operación viola la integridad del catálogo (respuesta 409)."""


class CatalogRuleError(Exception):
    """La operación viola una regla de negocio del catálogo (respuesta 400)."""

    def __init__(self, message, field=None):
        super().__init__(message)
        self.field = field


def _active_subfactors(factor: Factor, exclude_pk=None):
    queryset = Subfactor.objects.filter(factor=factor, is_active=True)
    if exclude_pk is not None:
        queryset = queryset.exclude(pk=exclude_pk)
    return queryset


def _ensure_factor_keeps_active_subfactor(factor: Factor, leaving_pk: int):
    """Regla 4: un factor activo no puede quedarse sin subfactores activos."""
    if factor.is_active and not _active_subfactors(factor, exclude_pk=leaving_pk).exists():
        raise CatalogRuleError(
            f"El factor «{factor.name}» está activo y se quedaría sin subfactores activos. "
            "Desactive primero el factor o agregue otro subfactor activo.",
        )


def _apply(instance, data):
    for field, value in data.items():
        setattr(instance, field, value)


# ── Dimensiones ───────────────────────────────────────────────────────────────

def create_dimension(**data) -> Dimension:
    return Dimension.objects.create(**data)


def update_dimension(dimension: Dimension, **data) -> Dimension:
    _apply(dimension, data)
    dimension.save()
    return dimension


def delete_dimension(dimension: Dimension) -> None:
    if dimension.is_base:
        raise CatalogConflict("Las dimensiones del catálogo base no se eliminan.")
    if dimension.factors.exists():
        raise CatalogConflict("La dimensión tiene factores asociados; no se puede eliminar (RF-ADM-31).")
    dimension.delete()


# ── Factores ──────────────────────────────────────────────────────────────────

def create_factor(**data) -> Factor:
    """Regla 4: el factor nace inactivo hasta que tenga un subfactor activo."""
    data.pop('is_active', None)
    data['scope_configurable'] = data.get('scope') == Factor.SCOPE_BOTH
    return Factor.objects.create(is_active=False, **data)


@transaction.atomic
def update_factor(factor: Factor, **data) -> Factor:
    if factor.is_base:
        locked = [f for f in BASE_LOCKED_FACTOR_FIELDS if f in data and data[f] != getattr(factor, f)]
        if locked:
            raise CatalogRuleError(
                "En los factores del catálogo base, la IS y el ámbito no se modifican (Tabla 5.3).",
                field=locked[0],
            )
    if 'scope' in data:
        data['scope_configurable'] = data['scope'] == Factor.SCOPE_BOTH
    if data.get('is_active') and not factor.is_active and not _active_subfactors(factor).exists():
        raise CatalogRuleError(
            "Un factor solo se puede activar si tiene al menos un subfactor activo.", field='is_active',
        )
    _apply(factor, data)
    factor.save()
    return factor


def factor_has_evaluations(factor: Factor) -> bool:
    return (
        EvaluationFactor.objects.filter(factor=factor).exists()
        or EvaluationResult.objects.filter(factor=factor).exists()
    )


@transaction.atomic
def delete_factor(factor: Factor) -> None:
    if factor.is_base:
        raise CatalogConflict("Los factores del catálogo base no se eliminan; puede desactivarlos.")
    if factor.subfactors.exists():
        raise CatalogConflict("El factor tiene subfactores; elimínelos o muévalos primero (RF-ADM-32).")
    if factor_has_evaluations(factor):
        raise CatalogConflict("El factor tiene evaluaciones registradas; puede desactivarlo (RN-07).")
    try:
        factor.delete()
    except ProtectedError as exc:  # defensa adicional: PROTECT en la base de datos
        raise CatalogConflict("El factor está referenciado por otros registros (RN-07).") from exc


# ── Subfactores ───────────────────────────────────────────────────────────────

def subfactor_has_evaluations(subfactor: Subfactor) -> bool:
    return EvaluationSubfactor.objects.filter(subfactor=subfactor).exists()


def create_subfactor(**data) -> Subfactor:
    return Subfactor.objects.create(**data)


@transaction.atomic
def update_subfactor(subfactor: Subfactor, **data) -> Subfactor:
    new_factor = data.get('factor')
    moving = new_factor is not None and new_factor.pk != subfactor.factor_id
    if moving and subfactor_has_evaluations(subfactor):
        raise CatalogRuleError(
            "El subfactor tiene evaluaciones registradas y no se puede mover a otro factor.", field='factor',
        )
    deactivating = data.get('is_active') is False and subfactor.is_active
    if subfactor.is_active and (moving or deactivating):
        _ensure_factor_keeps_active_subfactor(subfactor.factor, leaving_pk=subfactor.pk)
    _apply(subfactor, data)
    subfactor.save()
    return subfactor


@transaction.atomic
def delete_subfactor(subfactor: Subfactor) -> None:
    if subfactor.is_base:
        raise CatalogConflict("Los subfactores del catálogo base no se eliminan; puede desactivarlos.")
    if subfactor_has_evaluations(subfactor):
        raise CatalogConflict("El subfactor tiene calificaciones registradas en evaluaciones (RN-07).")
    if subfactor.is_active:
        _ensure_factor_keeps_active_subfactor(subfactor.factor, leaving_pk=subfactor.pk)
    try:
        subfactor.delete()
    except ProtectedError as exc:
        raise CatalogConflict("El subfactor está referenciado por otros registros (RN-07).") from exc
