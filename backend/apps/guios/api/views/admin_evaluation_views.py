from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission

from ...selectors.admin import evaluation_history, get_evaluation_by_uuid, get_evaluation_detail
from ...services import export as export_service
from ..pagination import AdminPagination
from ..serializers.admin_evaluation_serializers import (
    EvaluationDetailSerializer,
    EvaluationListSerializer,
    HistoryFilterSerializer,
)

TAGS = ['GUIOS administración: evaluaciones']
FILTER_PARAMETERS = [
    OpenApiParameter('software', str, description="Nombre del software (contiene)."),
    OpenApiParameter('organization', str, description="Nombre de la organización (contiene)."),
    OpenApiParameter('recommendation', str, enum=['A', 'B', 'C']),
    OpenApiParameter('status', str, enum=['in_progress', 'completed']),
    OpenApiParameter('date_from', OpenApiTypes.DATE, description="Inicio desde (incluida)."),
    OpenApiParameter('date_to', OpenApiTypes.DATE, description="Inicio hasta (incluida)."),
]


class EvaluationAdminViewSet(viewsets.ViewSet):
    """Historial, detalle de solo lectura y exportaciones (RF-ADM-34 a 36)."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': 'evaluations.view',
        'retrieve': 'evaluations.view',
        'export_csv': 'evaluations.export',
        'export_pdf': 'evaluations.export',
    }
    lookup_field = 'uuid'
    lookup_value_regex = '[0-9a-f-]{36}'

    def filters(self, request):
        serializer = HistoryFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def detail_or_404(self, uuid):
        evaluation = get_evaluation_by_uuid(uuid)
        if evaluation is None:
            raise NotFound("Evaluación no encontrada.")
        return get_evaluation_detail(evaluation)

    @extend_schema(tags=TAGS, summary="Historial de evaluaciones", parameters=FILTER_PARAMETERS + [
        OpenApiParameter('page', int), OpenApiParameter('page_size', int, description="Máximo 100."),
    ], responses=EvaluationListSerializer(many=True))
    def list(self, request):
        queryset = evaluation_history(**self.filters(request))
        paginator = AdminPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(EvaluationListSerializer(page, many=True).data)

    @extend_schema(
        tags=TAGS, summary="Detalle de una evaluación (solo lectura)",
        description=(
            "Completada: resultados y dictamen guardados (results_source=stored). "
            "En progreso: valores calculados por el motor con las instantáneas (results_source=calculated)."
        ),
        responses={200: EvaluationDetailSerializer, 404: OpenApiResponse(description="No existe.")},
    )
    def retrieve(self, request, uuid=None):
        return Response(EvaluationDetailSerializer(self.detail_or_404(uuid)).data)

    @extend_schema(
        tags=TAGS, summary="Exportar el historial filtrado en CSV", parameters=FILTER_PARAMETERS,
        responses={(200, 'text/csv'): OpenApiTypes.BINARY},
    )
    @action(detail=False, methods=['get'], url_path='export/csv')
    def export_csv(self, request):
        filters = self.filters(request)
        content = export_service.export_history_csv(evaluation_history(**filters), user=request.user, filters=filters)
        response = HttpResponse(content, content_type='text/csv; charset=utf-8')
        stamp = timezone.localtime().strftime('%Y%m%d-%H%M')
        response['Content-Disposition'] = f'attachment; filename="evaluaciones-guios-{stamp}.csv"'
        return response

    @extend_schema(
        tags=TAGS, summary="Exportar el detalle en PDF",
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY, 404: OpenApiResponse(description="No existe.")},
    )
    @action(detail=True, methods=['get'], url_path='export/pdf')
    def export_pdf(self, request, uuid=None):
        detail = self.detail_or_404(uuid)
        content = export_service.export_evaluation_pdf(detail, user=request.user)
        response = HttpResponse(content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="evaluacion-guios-{uuid}.pdf"'
        return response
