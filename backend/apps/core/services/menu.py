from django.db import transaction
from django.db.models import F
from apps.core.models.menuGroup import MenuGroup
from apps.core.models.menuModule import MenuModule
from ..selectors.menu import (
    get_menu_groups_ordered_by_order_and_id,
    get_menu_modules_by_group_ordered,
    get_max_menu_group_order,
    get_max_menu_module_order_for_group,
    get_menu_group_for_update,
    get_menu_module_for_update,
    get_menu_groups_count,
    get_menu_modules_count_for_group,
)


def _normalize_target_order(new_order: int, total_slots: int) -> int:
    """Normaliza el orden destino para que siempre quede en [1, total_slots]."""
    if total_slots <= 1:
        return 1
    if new_order < 1:
        return 1
    if new_order > total_slots:
        return total_slots
    return new_order


def _next_menu_group_temp_order() -> int:
    """
    Orden temporal seguro (positivo) para mover una categoría fuera del camino
    sin violar constraints de tipo CHECK en BD.
    """
    max_order = get_max_menu_group_order()
    return max_order + 1


def _next_menu_module_temp_order(*, group: MenuGroup) -> int:
    """
    Orden temporal seguro (positivo) para módulos dentro del grupo destino.
    """
    max_order = get_max_menu_module_order_for_group(group)
    return max_order + 1


def _reindex_menu_groups() -> None:
    """
    Re-indexa todas las categorías para que sean 1, 2, 3...
    Usa bulk_update en lugar de N saves individuales.
    """
    groups = get_menu_groups_ordered_by_order_and_id()
    to_update = []
    for i, group in enumerate(groups, start=1):
        if group.order != i:
            group.order = i
            to_update.append(group)
    if to_update:
        MenuGroup.objects.bulk_update(to_update, ['order'])


def _reindex_modules(group: MenuGroup) -> None:
    """
    Re-indexa todos los módulos de un grupo para que sean 1, 2, 3...
    Usa bulk_update.
    """
    modules = get_menu_modules_by_group_ordered(group)
    to_update = []
    for i, module in enumerate(modules, start=1):
        if module.order != i:
            module.order = i
            to_update.append(module)
    if to_update:
        MenuModule.objects.bulk_update(to_update, ['order'])


def update_menu_group_order(*, group: MenuGroup, new_order: int) -> MenuGroup:
    """
    Actualiza el orden de una categoría y re-indexa globalmente.

    Usa un orden temporal positivo seguro para evitar violar constraints
    durante los desplazamientos.
    """
    with transaction.atomic():
        group = get_menu_group_for_update(group.pk)
        total_slots = get_menu_groups_count()
        new_order = _normalize_target_order(new_order, total_slots)

        if group.order == new_order:
            return group

        old_order = group.order
        temp_order = _next_menu_group_temp_order()

        # Usar orden temporal POSITIVO para sacar al elemento del camino
        # sin romper check constraints (order >= 0).
        MenuGroup.objects.filter(id=group.id).update(order=temp_order)

        if new_order > old_order:
            # Se mueve hacia abajo: los que estaban entre (old+1, new] suben uno
            MenuGroup.objects.filter(
                order__gt=old_order,
                order__lte=new_order
            ).exclude(id=group.id).update(order=F('order') - 1)
        else:
            # Se mueve hacia arriba: los que estaban entre [new, old-1] bajan uno
            MenuGroup.objects.filter(
                order__gte=new_order,
                order__lt=old_order
            ).exclude(id=group.id).update(order=F('order') + 1)

        # Confirmar el nuevo orden
        MenuGroup.objects.filter(id=group.id).update(order=new_order)
        group.order = new_order

        # Normalizar por si quedaron huecos
        _reindex_menu_groups()

    return group


def update_menu_module_order(
    *,
    module: MenuModule,
    new_order: int,
    new_group: MenuGroup | None = None,
) -> MenuModule:
    """
    Actualiza el orden de un módulo y re-indexa su grupo (o ambos si cambia de grupo).

    Usa orden temporal positivo seguro para evitar constraint violations,
    y manejo explícito de new_group=None.
    """
    with transaction.atomic():
        module = get_menu_module_for_update(module.pk)
        old_group = module.group
        # new_group=None significa "no cambia de grupo", no "grupo nulo"
        target_group = new_group if new_group is not None else old_group
        old_order = module.order
        group_changed = old_group != target_group

        total_slots = get_menu_modules_count_for_group(target_group, exclude_id=module.id) + 1
        new_order = _normalize_target_order(new_order, total_slots)

        if not group_changed and old_order == new_order:
            return module

        temp_order = _next_menu_module_temp_order(group=target_group)

        # Sacar el módulo del orden actual con valor temporal
        MenuModule.objects.filter(id=module.id).update(order=temp_order, group=target_group)

        if not group_changed:
            # Mismo grupo: reordenar igual que con grupos
            if new_order > old_order:
                MenuModule.objects.filter(
                    group=target_group,
                    order__gt=old_order,
                    order__lte=new_order,
                ).exclude(id=module.id).update(order=F('order') - 1)
            elif new_order < old_order:
                MenuModule.objects.filter(
                    group=target_group,
                    order__gte=new_order,
                    order__lt=old_order,
                ).exclude(id=module.id).update(order=F('order') + 1)
        else:
            # Cambio de grupo: cerrar hueco en grupo origen, abrir espacio en destino
            MenuModule.objects.filter(
                group=old_group,
                order__gt=old_order,
            ).update(order=F('order') - 1)

            MenuModule.objects.filter(
                group=target_group,
                order__gte=new_order,
            ).exclude(id=module.id).update(order=F('order') + 1)

        MenuModule.objects.filter(id=module.id).update(order=new_order, group=target_group)
        module.group = target_group
        module.order = new_order

        # Normalizar grupos afectados
        _reindex_modules(target_group)
        if group_changed:
            _reindex_modules(old_group)

    return module


def update_menu_group_basic_info(*, group: MenuGroup, name: str) -> MenuGroup:
    name = name.strip()
    if not name:
        raise ValueError("El nombre del grupo no puede estar vacío.")
    group.name = name
    group.save(update_fields=['name'])
    return group


def update_menu_module_basic_info(*, module: MenuModule, label: str) -> MenuModule:
    label = label.strip()
    if not label:
        raise ValueError("La etiqueta del módulo no puede estar vacía.")
    module.label = label
    module.save(update_fields=['label'])
    return module