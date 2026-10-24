from django.db.models import Q, QuerySet
from ..models.user import CustomUser
from .audit import count_audit_logs_by_actor

def get_users_list(*, search: str = None, show_inactive: bool = False) -> QuerySet[CustomUser]:
    """
    Retorna la lista de usuarios con búsquedas y filtrado de inactivos optimizados.
    
    Args:
        search (str): Término de búsqueda para email, username, nombre o teléfono.
        show_inactive (bool): Si es True, incluye usuarios con is_active=False.
    """
    # Consulta base optimizada (AbstractUser no tiene muchas relaciones por defecto, 
    # pero si añadimos Roles/Grupos usaríamos select_related aquí).
    users = CustomUser.objects.all()

    # Filtro de inactivos
    if not show_inactive:
        users = users.filter(is_active=True)

    # Búsqueda por múltiples campos
    if search:
        search_filter = (
            Q(email__icontains=search) |
            Q(username__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(phone__icontains=search)
        )
        users = users.filter(search_filter)

    return users.order_by('-created_at')

def get_user_by_email(email: str) -> CustomUser:
    """Obtiene un usuario por email o retorna None."""
    return CustomUser.objects.filter(email=email).first()

def get_active_user_by_id(user_id: int) -> CustomUser:
    """Obtiene un usuario activo por ID o retorna None."""
    return CustomUser.objects.filter(id=user_id, is_active=True).first()


# Relaciones que no cuentan como datos del usuario: se borran con él (CASCADE)
# o las cuenta user_linked_records por separado.
_NOT_LINKED = frozenset({
    'groups', 'user_permissions',           # roles: se quitan al borrar
    'totp_device', 'password_reset_otps',   # 2FA y códigos de recuperación
    'logentry_set',                         # log interno del admin de Django
    'audit_logs', 'impersonation_audit_logs', 'evaluations',
})


def _plural(count: int, singular: str, plural: str) -> str:
    return singular if count == 1 else plural


def user_linked_records(user: CustomUser) -> list[dict]:
    """
    Registros que impiden borrar físicamente al usuario, por categoría.
    En la auditoría solo cuenta lo que el usuario hizo (autor o suplantador),
    no los registros donde él es el objeto (p. ej. "usuario creado por admin").
    """
    audit = count_audit_logs_by_actor(user)
    created = user.evaluations.count()

    items = [
        ('audit_catalog', audit['catalog'], 'cambio en el catálogo GUIOS', 'cambios en el catálogo GUIOS'),
        ('audit_evaluations', audit['evaluations'], 'acción en evaluaciones', 'acciones en evaluaciones'),
        ('evaluations_created', created, 'evaluación creada', 'evaluaciones creadas'),
        ('audit_other', audit['other'], 'registro de auditoría', 'registros de auditoría'),
    ]
    result = [
        {'key': key, 'label': _plural(count, singular, plural), 'count': count}
        for key, count, singular, plural in items if count
    ]

    # Cualquier otra relación futura cuenta como dato vinculado.
    for field in user._meta.get_fields():
        if not (field.is_relation and field.auto_created and not field.concrete):
            continue
        accessor = field.get_accessor_name()
        if accessor in _NOT_LINKED:
            continue
        if field.one_to_one:
            count = int(field.related_model.objects.filter(**{field.field.name: user}).exists())
        else:
            count = getattr(user, accessor).count()
        if count:
            result.append({'key': accessor, 'label': str(field.related_model._meta.verbose_name_plural), 'count': count})
    return result
