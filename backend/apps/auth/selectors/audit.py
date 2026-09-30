from django.db.models import Q, QuerySet
from ..models.audit import AuditLog

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
