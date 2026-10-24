from django.db.models import Q, QuerySet
from ..models.user import CustomUser

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
