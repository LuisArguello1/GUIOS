from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth.api.permissions import HasModulePermission

from ...selectors.admin import dashboard_metrics
from ..serializers.admin_evaluation_serializers import MetricsSerializer


class MetricsView(APIView):
    """Métricas de GUIOS para el tablero (RF-ADM-19)."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_permission = 'dashboard.view'

    @extend_schema(
        tags=['GUIOS administración: tablero'], summary="Métricas del tablero",
        description="Total de evaluaciones, en progreso y completadas, dictámenes A/B/C y las 10 más recientes.",
        responses=MetricsSerializer,
    )
    def get(self, request):
        return Response(MetricsSerializer(dashboard_metrics()).data)
