from typing import Optional, List
from django.db.models import Prefetch, Max, QuerySet
from ..models.menuGroup import MenuGroup
from ..models.menuModule import MenuModule
from ..models.modulePermission import ModulePermission


def get_menu_tree_for_user(user) -> List[MenuGroup]:
    """
    Retorna el árbol de menús filtrado por roles del usuario.
    Superuser ve todos los módulos activos.
    Usuario regular ve sólo los de sus grupos.
    """
    # Solo el superuser ve todo; el resto (incluyendo staff) se filtra por roles
    if user.is_superuser:
        allowed_modules_qs = MenuModule.objects.filter(is_active=True)
    else:
        user_group_ids = list(user.groups.values_list('id', flat=True))

        # Si el usuario no tiene ningún grupo asignado, retornar vacío
        if not user_group_ids:
            return []

        allowed_modules_qs = MenuModule.objects.filter(
            is_active=True,
            roles__in=user_group_ids,
        ).distinct()

    menu_tree = MenuGroup.objects.prefetch_related(
        Prefetch(
            'modules',
            queryset=allowed_modules_qs.order_by('order'),
            to_attr='allowed_modules',
        )
    ).order_by('order', 'name')

    # allowed_modules es una lista Python (to_attr), bool() es idiomático aquí
    return [group for group in menu_tree if group.allowed_modules]


def get_full_active_menu_tree() -> QuerySet[MenuGroup]:
    """
    Retorna todas las categorías y módulos activos (sin filtrar por roles).
    """
    modules_qs = MenuModule.objects.filter(is_active=True).order_by('order')
    return MenuGroup.objects.prefetch_related(
        Prefetch('modules', queryset=modules_qs, to_attr='allowed_modules')
    ).order_by('order', 'name')


def get_menu_groups_with_modules_and_permissions() -> QuerySet[MenuGroup]:
    """
    Retorna las categorías de menú pre-cargando sus módulos activos y sus
    permisos correspondientes de forma eficiente en exactamente 3 consultas.
    """
    permissions_qs = ModulePermission.objects.all().order_by('order')
    modules_qs = MenuModule.objects.filter(is_active=True).prefetch_related(
        Prefetch('permissions', queryset=permissions_qs)
    ).order_by('order')

    return MenuGroup.objects.prefetch_related(
        Prefetch('modules', queryset=modules_qs, to_attr='active_modules')
    ).order_by('order', 'name')


def get_menu_groups_by_ids(ids: List[int]) -> QuerySet[MenuGroup]:
    """Retorna los grupos de menú correspondientes a los IDs indicados."""
    return MenuGroup.objects.filter(id__in=ids)


def get_menu_modules_by_ids(ids: List[int]) -> QuerySet[MenuModule]:
    """Retorna los módulos de menú correspondientes a los IDs indicados."""
    return MenuModule.objects.filter(id__in=ids)


def get_menu_group_by_id(group_id: int) -> Optional[MenuGroup]:
    """Obtiene una categoría de menú por su ID."""
    return MenuGroup.objects.filter(id=group_id).first()


def get_menu_module_by_id(module_id: int) -> Optional[MenuModule]:
    """Obtiene un módulo de menú por su ID."""
    return MenuModule.objects.filter(id=module_id).first()


def get_menu_groups_ordered_by_order_and_id() -> List[MenuGroup]:
    """Retorna la lista de todas las categorías ordenadas."""
    return list(MenuGroup.objects.order_by('order', 'id'))


def get_menu_modules_by_group_ordered(group: MenuGroup) -> List[MenuModule]:
    """Retorna la lista de todos los módulos de un grupo ordenados."""
    return list(MenuModule.objects.filter(group=group).order_by('order', 'id'))


def get_max_menu_group_order() -> int:
    """Retorna el orden máximo actual entre las categorías de menú."""
    return MenuGroup.objects.aggregate(max_order=Max('order')).get('max_order') or 0


def get_max_menu_module_order_for_group(group: MenuGroup) -> int:
    """Retorna el orden máximo actual de los módulos de un grupo."""
    return (
        MenuModule.objects.filter(group=group)
        .aggregate(max_order=Max('order'))
        .get('max_order')
        or 0
    )


def get_menu_group_for_update(group_id: int) -> Optional[MenuGroup]:
    """Obtiene una categoría de menú con bloqueo de escritura."""
    return MenuGroup.objects.select_for_update().filter(pk=group_id).first()


def get_menu_module_for_update(module_id: int) -> Optional[MenuModule]:
    """Obtiene un módulo de menú con bloqueo de escritura."""
    return MenuModule.objects.select_for_update().select_related('group').filter(pk=module_id).first()


def get_menu_groups_count() -> int:
    """Retorna la cantidad total de categorías de menú."""
    return MenuGroup.objects.count()


def get_menu_modules_count_for_group(group: MenuGroup, exclude_id: Optional[int] = None) -> int:
    """Retorna la cantidad total de módulos de un grupo, opcionalmente excluyendo uno."""
    qs = MenuModule.objects.filter(group=group)
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    return qs.count()