"""
apps/guios/api/views/ai_log_views.py
───────────────────────────────────────────────────────────────────────────────
Controlador REST para auditoría y consulta de Logs de Asistencia de IA (GUIOS).
Hereda de ReadOnlyModelViewSet para garantizar la inmutabilidad de los registros.
Sigue el patrón Selector -> ViewSet sin consultas ORM directas.
"""
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from apps.guios.selectors.ai_log import (
    get_ai_logs_queryset,
    get_ai_log_by_id_or_error,
)
from apps.guios.exceptions import EvaluationNotFoundError
from ..serializers.ai_log_serializers import (
    AILogListOutputSerializer,
    AILogDetailOutputSerializer,
)


class AILogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Vista de auditoría para inspeccionar las interacciones con el motor de Inteligencia Artificial.
    Permite filtrar por evaluación, tipo de solicitud, estado y búsqueda textual.
    """
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': 'guios.evaluation_view',
        'retrieve': 'guios.evaluation_view',
    }

    def get_queryset(self):
        return get_ai_logs_queryset(
            user=self.request.user,
            evaluation_id=self.request.query_params.get('evaluation_id'),
            request_type=self.request.query_params.get('request_type'),
            status=self.request.query_params.get('status'),
            search=self.request.query_params.get('search'),
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AILogDetailOutputSerializer
        return AILogListOutputSerializer

    def retrieve(self, request, pk=None):
        try:
            instance = get_ai_log_by_id_or_error(pk)
        except EvaluationNotFoundError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)
