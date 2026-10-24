"""
apps/guios/selectors/ai_log.py
───────────────────────────────────────────────────────────────────────────────
Capa de selectores (lectura de datos) para AIAssistanceLog.
ÚNICA capa autorizada para realizar consultas ORM sobre logs de IA.
Previene antipatrones N+1 aplicando select_related para evaluation y factor.
"""
from django.db.models import QuerySet, Q
from apps.guios.models.ai_log import AIAssistanceLog
from apps.guios.exceptions import EvaluationNotFoundError


def get_ai_logs_queryset(
    user=None,
    evaluation_id: int | str | None = None,
    request_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> QuerySet[AIAssistanceLog]:
    """
    Retorna el QuerySet optimizado de logs de asistencia de IA con filtros opcionales.
    """
    qs = (
        AIAssistanceLog.objects.all()
        .select_related('evaluation', 'factor')
        .order_by('-requested_at')
    )

    if evaluation_id:
        qs = qs.filter(evaluation_id=evaluation_id)

    if request_type:
        qs = qs.filter(request_type=request_type)

    if status:
        qs = qs.filter(status=status)

    if search:
        search_term = search.strip()
        qs = qs.filter(
            Q(evaluation__software_name__icontains=search_term)
            | Q(evaluation__org_name__icontains=search_term)
            | Q(factor__name__icontains=search_term)
            | Q(error_message__icontains=search_term)
        )

    return qs


def get_ai_log_by_id_or_error(log_id: int | str) -> AIAssistanceLog:
    """
    Obtiene un registro individual de log de IA o lanza excepción de dominio.
    """
    try:
        return (
            AIAssistanceLog.objects.select_related('evaluation', 'factor')
            .get(pk=log_id)
        )
    except AIAssistanceLog.DoesNotExist:
        raise EvaluationNotFoundError(f"Log de asistencia de IA #{log_id} no encontrado.")
