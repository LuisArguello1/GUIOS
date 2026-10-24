from django.db.models import Q, QuerySet
from django.contrib.contenttypes.models import ContentType

from ..models.audit import AuditLog
from ..models.totp import TOTPDevice
from ..models.user import CustomUser

def get_audit_logs(*, search: str = None, model_name: str = None, user_id: int = None) -> QuerySet[AuditLog]:
    """
    Retorna la lista de logs de auditoría con optimizaciones y filtros.
    """
    # select_related('content_type') evita N+1 al acceder a model_name
    logs = AuditLog.objects.select_related('user', 'content_type').all()

    if model_name:
        logs = logs.filter(content_type__model__iexact=model_name)

    if user_id:
        logs = logs.filter(user_id=user_id)

    if search:
        search_filter = (
            Q(content_type__model__icontains=search) |
            Q(object_id__icontains=search) |
            Q(user__email__icontains=search) |
            Q(request_id__icontains=search)
        )
        logs = logs.filter(search_filter)

    return logs.order_by('-timestamp')

def get_audit_log_detail(pk: int) -> AuditLog:
    """Obtiene el detalle de un log con su usuario pre-cargado."""
    return AuditLog.objects.select_related('user').filter(pk=pk).first()


_CATALOG_MODELS = ('dimension', 'factor', 'subfactor')


def count_audit_logs_by_actor(user) -> dict[str, int]:
    """
    Registros de auditoría que el usuario hizo (autor o suplantador) sobre
    otras cosas, por categoría: cambios en el catálogo GUIOS, acciones en
    evaluaciones (modelos de evaluación y exportaciones) y el resto.

    No cuentan los registros donde el usuario es el objeto ("usuario creado
    por admin", cambios a su propio perfil) ni los de su dispositivo 2FA,
    confirmado o no: el 2FA se borra con el usuario. Las APIs de 2FA solo
    actúan sobre el dispositivo de quien hace la petición.
    """
    own_profile = Q(content_type=ContentType.objects.get_for_model(CustomUser), object_id=str(user.pk))
    two_factor = Q(content_type=ContentType.objects.get_for_model(TOTPDevice))
    authored = (
        AuditLog.objects
        .filter(Q(user=user) | Q(impersonated_by=user))
        .exclude(own_profile | two_factor)
    )
    catalog_q = Q(content_type__app_label='guios', content_type__model__in=_CATALOG_MODELS)
    evaluation_q = (Q(content_type__app_label='guios') | Q(action='EXPORT')) & ~catalog_q
    catalog = authored.filter(catalog_q).count()
    evaluations = authored.filter(evaluation_q).count()
    return {'catalog': catalog, 'evaluations': evaluations, 'other': authored.count() - catalog - evaluations}
