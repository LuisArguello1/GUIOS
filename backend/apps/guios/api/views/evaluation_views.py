"""
apps/guios/api/views/evaluation_views.py
─────────────────────────────────────────────────────────────────────────────
ViewSet para la gestión completa del ciclo de vida de Evaluaciones GUIOS.
Sigue el patrón arquitectónico Selector -> Service -> ViewSet:
- No ejecuta consultas ORM directas (delega a selectors).
- No contiene lógica de negocio ni cálculos matemáticos (delega a services y methodology).
- Métodos concisos (SRP) con control de permisos granulares por acción.
"""

from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.auth.api.permissions import HasModulePermission
from apps.guios.services.reports import EvaluationPDFReport, EvaluationExcelReport
from apps.guios.selectors.evaluation import (
    get_evaluations_queryset,
    get_evaluation_or_error,
    get_evaluation_detail_or_error,
)
from apps.guios.services.evaluation import (
    create_evaluation,
    update_evaluation,
    calculate_evaluation_literature,
    save_decisor_importance,
    save_subfactor_ratings,
    generate_evaluation_verdict,
    delete_evaluation,
)
from apps.guios.exceptions import (
    EvaluationNotFoundError,
    EvaluationAlreadyCompletedError,
    EvaluationValidationError,
)
from apps.guios.services.ai import ai_service
from apps.guios.models import EvaluationFactor, EvaluationSubfactor
from apps.guios.tasks import execute_evaluation_literature_ai_task
from ..serializers.evaluation_serializers import (
    EvaluationListOutputSerializer,
    EvaluationDetailOutputSerializer,
    EvaluationCreateInputSerializer,
    EvaluationUpdateInputSerializer,
    CalculateLiteratureInputSerializer,
    ApplyDecisorInputSerializer,
    RateSubfactorsInputSerializer,
    ComputeVerdictInputSerializer,
    AISuggestImportanceInputSerializer,
    AISuggestRatingInputSerializer,
    AIAssistanceLogOutputSerializer,
)


@extend_schema(exclude=True)
class EvaluationViewSet(viewsets.GenericViewSet):
    """
    Controlador REST para las Evaluaciones de software bajo la metodología GUIOS.
    Permite iniciar sesiones, consultar avances, procesar literatura, registrar decisiones
    y emitir el veredicto final institucional.
    """
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': 'guios.evaluation_view',
        'retrieve': 'guios.evaluation_view',
        'create': 'guios.evaluation_create',
        'update': 'guios.evaluation_edit',
        'partial_update': 'guios.evaluation_edit',
        'destroy': 'guios.evaluation_delete',
        'calculate_literature': 'guios.evaluation_edit',
        'apply_decisor': 'guios.evaluation_edit',
        'rate_subfactors': 'guios.evaluation_edit',
        'compute_verdict': 'guios.evaluation_edit',
        'ai_suggest_importance': 'guios.evaluation_edit',
        'ai_suggest_rating': 'guios.evaluation_edit',
        'ai_logs': 'guios.evaluation_view',
        'export_pdf': 'guios.evaluation_export',
        'export_excel': 'guios.evaluation_export',
    }


    def get_queryset(self):
        return get_evaluations_queryset(
            user=self.request.user,
            status=self.request.query_params.get('status'),
            software_category=self.request.query_params.get('category'),
            search=self.request.query_params.get('search'),
        )

    def list(self, request):
        """GET /api/v1/guios/evaluations/ - Listado paginado de sesiones de evaluación."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = EvaluationListOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = EvaluationListOutputSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        """GET /api/v1/guios/evaluations/{id}/ - Detalle integral de la sesión con todas sus fases."""
        try:
            evaluation = get_evaluation_detail_or_error(pk)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = EvaluationDetailOutputSerializer(evaluation)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request):
        """POST /api/v1/guios/evaluations/ - Inicia una nueva evaluación de software."""
        serializer = EvaluationCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            eval_res = create_evaluation(
                user=request.user,
                **serializer.validated_data,
            )
            evaluation = eval_res[0] if isinstance(eval_res, tuple) else eval_res
        except EvaluationValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_or_error(evaluation.id)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        """PUT /api/v1/guios/evaluations/{id}/ - Actualización total de metadatos descriptivos."""
        return self._perform_update(request, pk)

    def partial_update(self, request, pk=None):
        """PATCH /api/v1/guios/evaluations/{id}/ - Actualización parcial de metadatos descriptivos."""
        return self._perform_update(request, pk)

    def _perform_update(self, request, pk):
        serializer = EvaluationUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            update_evaluation(evaluation_id=pk, **serializer.validated_data)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_or_error(pk)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """DELETE /api/v1/guios/evaluations/{id}/ - Elimina la sesión de evaluación."""
        try:
            delete_evaluation(evaluation_id=pk)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)

    # ─────────────────────────────────────────────────────────────────────────
    # ACCIONES METODOLÓGICAS (Fases GUIOS)
    # ─────────────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='calculate-literature')
    def calculate_literature(self, request, pk=None):
        """
        POST /api/v1/guios/evaluations/{id}/calculate-literature/
        Fase 3 / Paso 0: Ejecuta el cálculo de razones r_i, cuartiles e Importancia Sugerida (IS).
        Soporta modo asíncrono con Celery (async_mode=True) o extracción directa con IA (use_ai=True).
        """
        serializer = CalculateLiteratureInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            evaluation = get_evaluation_or_error(pk)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        if serializer.validated_data.get('async_mode'):
            task = execute_evaluation_literature_ai_task.delay(int(evaluation.id))
            return Response({
                'status': 'searching',
                'task_id': str(task.id),
                'message': 'Búsqueda de literatura científica y cálculo de cuartiles con IA iniciada en segundo plano.',
            }, status=status.HTTP_202_ACCEPTED)

        ai_citations = serializer.validated_data.get('ai_citations_by_subfactor')
        ai_sources = serializer.validated_data.get('ai_sources_by_factor')

        if serializer.validated_data.get('use_ai') and not ai_citations:
            ai_result = ai_service.search_literature_and_citations(evaluation=evaluation)
            ai_citations = ai_result.get('citations_by_subfactor')
            ai_sources = ai_result.get('sources_by_factor')

        try:
            calculate_evaluation_literature(
                evaluation_id=pk,
                ai_citations_by_subfactor=ai_citations,
                ai_sources_by_factor=ai_sources,
            )
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_or_error(pk)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='apply-decisor')
    def apply_decisor(self, request, pk=None):
        """
        POST /api/v1/guios/evaluations/{id}/apply-decisor/
        Fase 4 / Pasos 1 y 2: Registra la Importancia del Decisor (ID), calcula IR y filtra factores relevantes.
        """
        serializer = ApplyDecisorInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            save_decisor_importance(
                evaluation_id=pk,
                decisor_data=serializer.validated_data['factors'],
            )
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_or_error(pk)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='rate-subfactors')
    def rate_subfactors(self, request, pk=None):
        """
        POST /api/v1/guios/evaluations/{id}/rate-subfactors/
        Fase 4 / Pasos 3, 4 y 5: Registra calificaciones de subfactores y genera matriz FODA.
        """
        serializer = RateSubfactorsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            save_subfactor_ratings(
                evaluation_id=pk,
                ratings_by_subfactor=serializer.validated_data['ratings'],
            )
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_or_error(pk)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='compute-verdict')
    def compute_verdict(self, request, pk=None):
        """
        POST /api/v1/guios/evaluations/{id}/compute-verdict/
        Fase 4 / Paso 6: Emite el dictamen institucional final (A, B o C) y cierra la evaluación.
        """
        serializer = ComputeVerdictInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            generate_evaluation_verdict(
                evaluation_id=pk,
                **serializer.validated_data,
            )
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_or_error(pk)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='ai-suggest-importance')
    def ai_suggest_importance(self, request, pk=None):
        """
        POST /api/v1/guios/evaluations/{id}/ai-suggest-importance/
        Sugerencia asistida por IA de la Importancia del Decisor (ID: 1 a 4).
        """
        serializer = AISuggestImportanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        factor_id = serializer.validated_data['factor_id']

        try:
            evaluation = get_evaluation_or_error(pk)
            eval_factor = EvaluationFactor.objects.get(evaluation=evaluation, factor_id=factor_id)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except EvaluationFactor.DoesNotExist:
            return Response({'error': f'Factor #{factor_id} no está registrado en la evaluación #{pk}.'}, status=status.HTTP_404_NOT_FOUND)

        suggestion = ai_service.suggest_factor_importance(
            evaluation=evaluation,
            factor=eval_factor.factor,
            is_suggested=eval_factor.systemic_importance_snapshot,
        )

        eval_factor.ai_suggested_id = suggestion.get('suggested_id')
        eval_factor.ai_id_justification = suggestion.get('justification', '')
        eval_factor.save(update_fields=['ai_suggested_id', 'ai_id_justification'])

        return Response(suggestion, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='ai-suggest-rating')
    def ai_suggest_rating(self, request, pk=None):
        """
        POST /api/v1/guios/evaluations/{id}/ai-suggest-rating/
        Sugerencia asistida por IA de la calificación de un subfactor (1 a 4).
        """
        serializer = AISuggestRatingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subfactor_id = serializer.validated_data['subfactor_id']

        try:
            evaluation = get_evaluation_or_error(pk)
            eval_subfactor = EvaluationSubfactor.objects.get(evaluation=evaluation, subfactor_id=subfactor_id)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except EvaluationSubfactor.DoesNotExist:
            return Response({'error': f'Subfactor #{subfactor_id} no está registrado en la evaluación #{pk}.'}, status=status.HTTP_404_NOT_FOUND)

        suggestion = ai_service.suggest_subfactor_rating(
            evaluation=evaluation,
            subfactor=eval_subfactor.subfactor,
        )

        eval_subfactor.ai_suggested_rating = suggestion.get('suggested_rating')
        eval_subfactor.ai_rating_justification = suggestion.get('justification', '')
        eval_subfactor.save(update_fields=['ai_suggested_rating', 'ai_rating_justification'])

        return Response(suggestion, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='ai-logs')
    def ai_logs(self, request, pk=None):
        """
        GET /api/v1/guios/evaluations/{id}/ai-logs/
        Historial de auditoría inmutable de solicitudes de IA realizadas en la evaluación.
        """
        try:
            evaluation = get_evaluation_or_error(pk)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        logs = evaluation.ai_logs.all().select_related('factor')
        serializer = AIAssistanceLogOutputSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request, pk=None):
        """
        GET /api/v1/guios/evaluations/{id}/export-pdf/
        Genera y descarga el Dossier Técnico oficial de la evaluación en PDF.
        """
        try:
            evaluation = get_evaluation_detail_or_error(pk)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        pdf_buffer = EvaluationPDFReport.generate(evaluation)
        clean_name = "".join(c for c in evaluation.software_name if c.isalnum() or c in ('_', '-')).strip()
        filename = f"Evaluacion_GUIOS_{clean_name}_{evaluation.id}.pdf"

        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], url_path='export-excel')
    def export_excel(self, request, pk=None):
        """
        GET /api/v1/guios/evaluations/{id}/export-excel/
        Genera y descarga el Dossier Técnico de la evaluación en Excel (.xlsx).
        """
        try:
            evaluation = get_evaluation_detail_or_error(pk)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        excel_buffer = EvaluationExcelReport.generate(evaluation)
        clean_name = "".join(c for c in evaluation.software_name if c.isalnum() or c in ('_', '-')).strip()
        filename = f"Evaluacion_GUIOS_{clean_name}_{evaluation.id}.xlsx"

        response = HttpResponse(
            excel_buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

from django.conf import settings
from django_ratelimit.core import is_ratelimited
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from ...selectors.evaluation import (
    evaluation_factors,
    get_evaluation_by_token,
    get_evaluation_factor,
    get_evaluation_subfactor,
)
from ...services import evaluation as evaluation_service
from ..serializers.evaluation_serializers import (
    EvaluationCreatedSerializer,
    EvaluationCreateSerializer,
    EvaluationStateSerializer,
    FactorUpdateSerializer,
    SubfactorUpdateSerializer,
    SummarySerializer,
    VerdictResultSerializer,
    VerdictSerializer,
    missing_payload,
)
from .catalog_views import PublicGuiosView

TOKEN_HEADER = 'X-Evaluation-Token'
TAGS = ['GUIOS público']

TOKEN_PARAMETER = OpenApiParameter(
    TOKEN_HEADER, OpenApiTypes.STR, OpenApiParameter.HEADER, required=True,
    description="Token de sesión anónima devuelto al crear la evaluación.",
)
ERRORS = {
    403: OpenApiResponse(description="Falta la cabecera X-Evaluation-Token."),
    404: OpenApiResponse(description="Evaluación inexistente o token incorrecto."),
}
LOCKED = {409: OpenApiResponse(description="La evaluación ya tiene dictamen y está cerrada.")}


def locked_response(exc):
    return Response({'detail': str(exc), 'code': 'evaluation_locked'}, status=status.HTTP_409_CONFLICT)


class EvaluationAccessMixin:
    def get_evaluation(self, request, evaluation_uuid):
        token = request.headers.get(TOKEN_HEADER)
        if not token:
            raise PermissionDenied(f"Falta la cabecera {TOKEN_HEADER}.")
        evaluation = get_evaluation_by_token(evaluation_uuid, token)
        if evaluation is None:
            raise NotFound("Evaluación no encontrada.")
        return evaluation

    def summary_response(self, evaluation):
        factors, outcome = evaluation_service.compute_outcome(evaluation)
        return Response(SummarySerializer(SummarySerializer.payload(evaluation, factors, outcome)).data)

    @staticmethod
    def state_data(evaluation, serializer_class=EvaluationStateSerializer, **extra):
        evaluation.state_factors = evaluation_factors(evaluation)
        data = serializer_class(evaluation).data
        data.update(extra)
        return data


CREATE_RATE_LIMITED = {429: OpenApiResponse(description="Demasiadas evaluaciones desde esta IP.")}


def create_rate_limited(request):
    """Crear y duplicar comparten el límite por IP (GUIOS_EVALUATION_CREATE_RATE)."""
    if is_ratelimited(
        request, group='guios:create_evaluation', key='ip',
        rate=settings.GUIOS_EVALUATION_CREATE_RATE, method='POST', increment=True,
    ):
        return Response(
            {'detail': "Se alcanzó el límite de evaluaciones nuevas desde esta red. Intente más tarde.",
             'code': 'rate_limited'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    return None


class EvaluationCreateView(EvaluationAccessMixin, PublicGuiosView):
    @extend_schema(
        tags=TAGS,
        summary="Registrar una evaluación",
        description=(
            "Crea la evaluación con las instantáneas del catálogo activo (IS, nombre del factor "
            "y texto del subfactor); todo arranca sin calificar. Devuelve el session_token, que "
            "solo se entrega aquí. Límite por IP: GUIOS_EVALUATION_CREATE_RATE."
        ),
        request=EvaluationCreateSerializer,
        responses={201: EvaluationCreatedSerializer, **CREATE_RATE_LIMITED},
    )
    def post(self, request):
        limited = create_rate_limited(request)
        if limited:
            return limited
        serializer = EvaluationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evaluation, token = evaluation_service.create_evaluation(**serializer.validated_data)
        data = self.state_data(evaluation, EvaluationCreatedSerializer, session_token=token)
        return Response(data, status=status.HTTP_201_CREATED)


class EvaluationDetailView(EvaluationAccessMixin, PublicGuiosView):
    @extend_schema(
        tags=TAGS, summary="Estado de la evaluación", parameters=[TOKEN_PARAMETER],
        responses={200: EvaluationStateSerializer, **ERRORS},
    )
    def get(self, request, evaluation_uuid):
        evaluation = self.get_evaluation(request, evaluation_uuid)
        return Response(self.state_data(evaluation))


class EvaluationSummaryView(EvaluationAccessMixin, PublicGuiosView):
    @extend_schema(
        tags=TAGS, summary="Resumen calculado por el motor",
        description="IR, relevancia, PM, FODA y la lista de pendientes. Se puede pedir en cualquier momento.",
        parameters=[TOKEN_PARAMETER], responses={200: SummarySerializer, **ERRORS},
    )
    def get(self, request, evaluation_uuid):
        return self.summary_response(self.get_evaluation(request, evaluation_uuid))


class EvaluationFactorView(EvaluationAccessMixin, PublicGuiosView):
    @extend_schema(
        tags=TAGS, summary="Guardar la ID o el ámbito de un factor",
        description="Un cambio por petición (guardado automático). null vuelve a sin calificar.",
        parameters=[TOKEN_PARAMETER], request=FactorUpdateSerializer,
        responses={200: SummarySerializer, 400: OpenApiResponse(description="Valor fuera de rango o ámbito no elegible."), **ERRORS, **LOCKED},
    )
    def patch(self, request, evaluation_uuid, factor_id):
        evaluation = self.get_evaluation(request, evaluation_uuid)
        item = get_evaluation_factor(evaluation, factor_id)
        if item is None:
            raise NotFound("El factor no pertenece a esta evaluación.")
        serializer = FactorUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            if 'scope_used' in data:
                evaluation_service.set_scope(evaluation, item, data['scope_used'])
            if 'decisor_importance' in data:
                evaluation_service.set_decisor_importance(evaluation, item, data['decisor_importance'])
        except evaluation_service.EvaluationLocked as exc:
            return locked_response(exc)
        except evaluation_service.InvalidChange as exc:
            return Response({'detail': str(exc), 'code': 'invalid_change'}, status=status.HTTP_400_BAD_REQUEST)
        return self.summary_response(evaluation)


class EvaluationSubfactorView(EvaluationAccessMixin, PublicGuiosView):
    @extend_schema(
        tags=TAGS, summary="Guardar la calificación de un subfactor",
        description="Un cambio por petición (guardado automático). null vuelve a sin calificar.",
        parameters=[TOKEN_PARAMETER], request=SubfactorUpdateSerializer,
        responses={200: SummarySerializer, 400: OpenApiResponse(description="Valor fuera de rango."), **ERRORS, **LOCKED},
    )
    def patch(self, request, evaluation_uuid, subfactor_id):
        evaluation = self.get_evaluation(request, evaluation_uuid)
        item = get_evaluation_subfactor(evaluation, subfactor_id)
        if item is None:
            raise NotFound("El subfactor no pertenece a esta evaluación.")
        serializer = SubfactorUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            evaluation_service.set_rating(evaluation, item, serializer.validated_data['rating'])
        except evaluation_service.EvaluationLocked as exc:
            return locked_response(exc)
        return self.summary_response(evaluation)


class EvaluationVerdictView(EvaluationAccessMixin, PublicGuiosView):
    @extend_schema(
        tags=TAGS, summary="Generar el dictamen",
        description=(
            "Rechazado (400, code evaluation_incomplete) con la lista de pendientes si falta algo. "
            "Si está completo, guarda resultados y dictamen, cierra la evaluación y lo registra en "
            "la auditoría, todo en una transacción."
        ),
        parameters=[TOKEN_PARAMETER], request=None,
        responses={201: VerdictResultSerializer, 400: OpenApiResponse(description="Evaluación incompleta."), **ERRORS, **LOCKED},
    )
    def post(self, request, evaluation_uuid):
        evaluation = self.get_evaluation(request, evaluation_uuid)
        try:
            evaluation, verdict = evaluation_service.generate_verdict(evaluation)
        except evaluation_service.EvaluationLocked as exc:
            return locked_response(exc)
        except evaluation_service.EvaluationIncomplete as exc:
            return Response(
                {'detail': "No se puede generar el dictamen: faltan datos por evaluar.",
                 'code': 'evaluation_incomplete',
                 'missing': missing_payload(exc.missing)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        factors, outcome = evaluation_service.compute_outcome(evaluation)
        return Response(
            {
                'verdict': VerdictSerializer(verdict).data,
                'summary': SummarySerializer(SummarySerializer.payload(evaluation, factors, outcome)).data,
            },
            status=status.HTTP_201_CREATED,
        )


class EvaluationDuplicateView(EvaluationAccessMixin, PublicGuiosView):
    @extend_schema(
        tags=TAGS, summary="Duplicar una evaluación",
        description=(
            "Crea una evaluación nueva en progreso, con su propio session_token, copiando el registro, "
            "las ID, los ámbitos y las calificaciones de la original (con sus instantáneas). Sirve para "
            "corregir una evaluación cerrada sin perder el trabajo. La original no cambia."
        ),
        parameters=[TOKEN_PARAMETER], request=None,
        responses={201: EvaluationCreatedSerializer, **ERRORS, **CREATE_RATE_LIMITED},
    )
    def post(self, request, evaluation_uuid):
        original = self.get_evaluation(request, evaluation_uuid)
        limited = create_rate_limited(request)
        if limited:
            return limited
        evaluation, token = evaluation_service.duplicate_evaluation(original)
        data = self.state_data(evaluation, EvaluationCreatedSerializer, session_token=token)
        return Response(data, status=status.HTTP_201_CREATED)
