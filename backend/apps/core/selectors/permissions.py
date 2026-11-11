"""
core/selectors/permissions.py
─────────────────────────────────────────────────────────────────────────────
Funciones de consulta de permisos granulares por módulo.

Uso centralizado para evitar queries duplicadas en views, serializers
y el sistema de permisos DRF.
"""
from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from django.db.models import QuerySet

from apps.core.models.modulePermission import ModulePermission

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser


def get_user_permission_codenames(user: "AbstractBaseUser") -> frozenset[str]:
    """
    Retorna el conjunto de codenames de permisos que tiene el usuario,
    calculados a partir de sus grupos (roles).

    - Superuser → frozenset vacío (la capa de permisos retorna True por bypass).
    - Sin grupos → frozenset vacío (sin acceso).
    - Los permisos son aditivos si el usuario tiene varios grupos.
    """
    if not user or not user.is_authenticated:
        return frozenset()

    if user.is_superuser:
        # El superuser tiene acceso a todos los permisos
        all_perms = set(ModulePermission.objects.values_list("codename", flat=True))
        all_perms.add("*")
        return frozenset(all_perms)

    group_ids = list(user.groups.values_list("id", flat=True))
    if not group_ids:
        return frozenset()

    codenames = (
        ModulePermission.objects
        .filter(groups__in=group_ids)
        .values_list("codename", flat=True)
        .distinct()
    )
    return frozenset(codenames)


def user_has_permission(user: "AbstractBaseUser", codename: str) -> bool:
    """
    Verifica si el usuario tiene un permiso específico.

    Orden de evaluación:
    1. No autenticado → False
    2. Superuser → True (bypass total)
    3. Staff no-superuser → se verifica igual que cualquier usuario
       (el staff normal necesita roles asignados)
    4. Consulta M:N groups → ModulePermission
    """
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    group_ids = list(user.groups.values_list("id", flat=True))
    if not group_ids:
        return False

    return ModulePermission.objects.filter(
        codename=codename,
        groups__in=group_ids,
    ).exists()


def get_permissions_for_group(group_id: int) -> QuerySet:
    """
    Retorna el QuerySet de ModulePermission asignados a un grupo (rol).
    """
    return (
        ModulePermission.objects
        .filter(groups__id=group_id)
        .select_related("module", "module__group")
        .order_by("module__group__order", "module__order", "order")
    )


def get_full_permission_tree() -> QuerySet:
    """
    Retorna todos los ModulePermission activos, prefetcheados con su módulo.
    Útil para la UI de configuración de roles.
    """
    return (
        ModulePermission.objects
        .select_related("module", "module__group")
        .prefetch_related("groups")
        .order_by("module__group__order", "module__order", "order")
    )


def get_permissions_by_ids(ids: list[int]) -> QuerySet[ModulePermission]:
    """Retorna los permisos correspondientes a los IDs indicados."""
    return ModulePermission.objects.filter(id__in=ids)


def get_permissions_assigned_to_group(group) -> QuerySet[ModulePermission]:
    """Retorna los permisos asignados a un grupo."""
    return ModulePermission.objects.filter(groups=group)

