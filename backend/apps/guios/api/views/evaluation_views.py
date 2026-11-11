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

from apps.auth.api.permissions import HasModulePermission
from apps.guios.services.reports import EvaluationPDFReport, EvaluationExcelReport
from apps.guios.selectors.evaluation import (
    get_evaluations_queryset,
    get_evaluation_or_error,
    get_evaluation_detail_or_error,
)
from .security_utils import get_client_ip_hash
from apps.guios.services.evaluation import (
    create_evaluation,
    update_evaluation,
    calculate_evaluation_literature,
    save_decisor_importance,
    save_subfactor_ratings,
    generate_evaluation_verdict,
    delete_evaluation,
    store_factor_rating_suggestions,
    restore_ai_suggestions_from_logs,
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

        restore_ai_suggestions_from_logs(evaluation)
        serializer = EvaluationDetailOutputSerializer(evaluation)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request):
        """POST /api/v1/guios/evaluations/ - Inicia una nueva evaluación de software."""
        serializer = EvaluationCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        consent_ip_hash = get_client_ip_hash(request)

        try:
            evaluation = create_evaluation(
                user=request.user,
                consent_ip_hash=consent_ip_hash,
                **serializer.validated_data,
            )
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

    @action(detail=True, methods=['post'], url_path='ai-suggest-factor-ratings')
    def ai_suggest_factor_ratings(self, request, pk=None):
        """
        POST /api/v1/guios/evaluations/{id}/ai-suggest-factor-ratings/
        Califica con IA todos los subfactores del factor indicado, no el catálogo entero.
        """
        serializer = AISuggestImportanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        factor_id = serializer.validated_data['factor_id']

        try:
            evaluation = get_evaluation_or_error(pk)
            rows = list(
                EvaluationSubfactor.objects.select_related('subfactor', 'subfactor__factor').filter(
                    evaluation=evaluation,
                    subfactor__factor_id=factor_id,
                )
            )
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        if not rows:
            return Response(
                {'error': f'El factor #{factor_id} no tiene subfactores en esta evaluación.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        suggestion = ai_service.suggest_factor_ratings(
            evaluation=evaluation,
            factor=rows[0].subfactor.factor,
            subfactors=[row.subfactor for row in rows],
        )
        stored = store_factor_rating_suggestions(rows, suggestion.get('ratings') or {})
        return Response({'factor_id': factor_id, 'ratings': stored}, status=status.HTTP_200_OK)

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

