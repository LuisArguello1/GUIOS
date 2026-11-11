"""
apps/guios/api/views/public_evaluation_views.py
─────────────────────────────────────────────────────────────────────────────
Controlador REST público para evaluaciones de software bajo la metodología GUIOS.
Permite el acceso anónimo mediante UUID público (sin requerir autenticación ni sesión activa),
cumpliendo con la especificación del Módulo Público (RF-PUB-01 a RF-PUB-07, US-08 a US-11 y US-13/14):
- Catálogo activo de evaluación (Dimensión -> Factor -> Subfactor).
- Inicio de evaluación anónima (con o sin IA).
- Registro del criterio del decisor (ID) y cálculo de relevancia (IR).
- Calificación de subfactores y cálculo de Ponderación Media (PM) y FODA.
- Emisión de dictamen institucional determinista (A, B o C) y resumen ejecutivo con IA.
- Sugerencias cognitivas de IA orientativas (RN-05).
- Descarga de Dossier Técnico en PDF y Excel.
"""

import logging
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.guios.models import Evaluation, EvaluationFactor, EvaluationSubfactor
from apps.guios.exceptions import (
    EvaluationNotFoundError,
    EvaluationAlreadyCompletedError,
    EvaluationValidationError,
)
from apps.guios.selectors.evaluation import (
    get_evaluation_by_uuid_or_error,
    get_evaluation_detail_by_uuid_or_error,
)
from apps.guios.selectors.dimension import get_public_catalog_queryset
from apps.guios.services.evaluation import (
    create_evaluation,
    update_evaluation,
    calculate_evaluation_literature,
    save_decisor_importance,
    save_subfactor_ratings,
    generate_evaluation_verdict,
    store_factor_rating_suggestions,
    restore_ai_suggestions_from_logs,
)
from apps.guios.tasks import enqueue_literature_search
from apps.guios.services.ai import ai_service
from apps.guios.services.ai.verdict_narrative import build_predetermined_narrative
from apps.guios.services.reports import EvaluationPDFReport, EvaluationExcelReport

from .security_utils import get_client_ip_hash
from ..serializers.dimension_serializers import PublicCatalogDimensionSerializer
from ..serializers.evaluation_serializers import (
    EvaluationDetailOutputSerializer,
    EvaluationCreateInputSerializer,
    EvaluationUpdateInputSerializer,
    ApplyDecisorInputSerializer,
    RateSubfactorsInputSerializer,
    ComputeVerdictInputSerializer,
    AISuggestImportanceInputSerializer,
    AISuggestRatingInputSerializer,
)

logger = logging.getLogger(__name__)


class PublicEvaluationViewSet(viewsets.GenericViewSet):
    """
    Controlador público para el módulo de evaluación institucional GUIOS PRO.
    No requiere autenticación y utiliza el campo `uuid` como identificador público único.
    """
    permission_classes = [permissions.AllowAny]
    lookup_field = 'uuid'

    def get_queryset(self):
        return Evaluation.objects.none()

    # ─────────────────────────────────────────────────────────────────────────
    # 1. CATÁLOGO PÚBLICO
    # ─────────────────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='catalog')
    def catalog(self, request):
        """
        GET /api/v1/guios/public/evaluations/catalog/
        Retorna el catálogo activo completo de dimensiones, factores y subfactores
        para consulta pública en el asistente de evaluación.
        """
        catalog_qs = get_public_catalog_queryset()
        serializer = PublicCatalogDimensionSerializer(catalog_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ─────────────────────────────────────────────────────────────────────────
    # 2. INICIO Y DETALLE DE EVALUACIÓN ANÓNIMA
    # ─────────────────────────────────────────────────────────────────────────

    def create(self, request):
        """
        POST /api/v1/guios/public/evaluations/
        Inicia una nueva sesión de evaluación anónima (RF-PUB-01, US-08).
        Genera el snapshot de factores y cuartiles de forma determinista y retorna el UUID público.
        """
        serializer = EvaluationCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_token = request.headers.get('X-Session-Token') or request.data.get('session_token')
        if session_token and not str(session_token).strip():
            session_token = None
        elif session_token:
            session_token = str(session_token).strip()

        consent_ip_hash = get_client_ip_hash(request)

        try:
            user = request.user if request.user and request.user.is_authenticated else None
            evaluation = create_evaluation(
                user=user,
                session_token=session_token,
                consent_ip_hash=consent_ip_hash,
                **serializer.validated_data,
            )
            if evaluation.ai_enabled:
                if not evaluation.evaluation_factors.exists():
                    calculate_evaluation_literature(evaluation_id=evaluation.id)
                enqueue_literature_search(evaluation.id)

            detailed = get_evaluation_detail_by_uuid_or_error(str(evaluation.uuid))
            return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_201_CREATED)
        except EvaluationValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.exception("Error al crear evaluación pública: %s", e)
            return Response(
                {
                    'error': f"Error al inicializar la sesión de evaluación: {str(e)}",
                    'detail': str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def retrieve(self, request, uuid=None):
        """
        GET /api/v1/guios/public/evaluations/{uuid}/
        Retorna el detalle completo de la evaluación en curso o completada, incluyendo
        factores evaluados, subfactores, resultados FODA y veredicto.
        """
        try:
            evaluation = get_evaluation_detail_by_uuid_or_error(uuid)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        restore_ai_suggestions_from_logs(evaluation)
        serializer = EvaluationDetailOutputSerializer(evaluation)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, uuid=None):
        """
        PATCH /api/v1/guios/public/evaluations/{uuid}/
        Permite actualizar metadatos descriptivos de la evaluación (software, organización)
        mientras siga en estado 'in_progress'.
        """
        try:
            eval_obj = get_evaluation_by_uuid_or_error(uuid)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = EvaluationUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            update_evaluation(evaluation_id=eval_obj.id, **serializer.validated_data)
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_by_uuid_or_error(uuid)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    # ─────────────────────────────────────────────────────────────────────────
    # 3. PASOS 1 Y 2: CONFIGURACIÓN DE FACTORES E IMPORTANCIA DEL DECISOR (ID -> IR)
    # ─────────────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='apply-decisor')
    def apply_decisor(self, request, uuid=None):
        """
        POST /api/v1/guios/public/evaluations/{uuid}/apply-decisor/
        Registra la Importancia del Decisor (ID: 1 a 4) y ámbito de cada factor (RF-PUB-02, US-09).
        Calcula inmediatamente IR = Matriz(ID, IS) y determina los factores relevantes (IR > 1).
        """
        try:
            eval_obj = get_evaluation_by_uuid_or_error(uuid)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = ApplyDecisorInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            save_decisor_importance(
                evaluation_id=eval_obj.id,
                decisor_data=serializer.validated_data['factors'],
            )
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_by_uuid_or_error(uuid)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    # ─────────────────────────────────────────────────────────────────────────
    # 4. PASOS 3 Y 4: CALIFICACIÓN DE SUBFACTORES Y CÁLCULO DE PM / FODA PROVISIONAL
    # ─────────────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='rate-subfactors')
    def rate_subfactors(self, request, uuid=None):
        """
        POST /api/v1/guios/public/evaluations/{uuid}/rate-subfactors/
        Registra calificaciones de subfactores y calcula la Ponderación Media (PM) y FODA
        para los factores completados (RF-PUB-04, US-10).
        """
        try:
            eval_obj = get_evaluation_by_uuid_or_error(uuid)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = RateSubfactorsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            save_subfactor_ratings(
                evaluation_id=eval_obj.id,
                ratings_by_subfactor=serializer.validated_data['ratings'],
            )
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_by_uuid_or_error(uuid)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    # ─────────────────────────────────────────────────────────────────────────
    # 5. PASOS 5 Y 6: DICTAMEN FINAL, ASISTENCIA IA Y CIERRE DE EVALUACIÓN
    # ─────────────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='compute-verdict')
    def compute_verdict(self, request, uuid=None):
        """
        POST /api/v1/guios/public/evaluations/{uuid}/compute-verdict/
        Emite el dictamen final determinista (Recomendación A, B o C) según la metodología (RF-PUB-05, US-11).
        Si la IA está habilitada y no se enviaron resúmenes explícitos, genera el Resumen Ejecutivo
        y el Plan de Mitigación mediante el motor de IA con degradación elegante (RF-IA-04, RF-IA-05).
        """
        try:
            eval_obj = get_evaluation_by_uuid_or_error(uuid)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = ComputeVerdictInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ai_summary = serializer.validated_data.get('ai_executive_summary', '')
        ai_mitigation = serializer.validated_data.get('ai_mitigation_plan', '')

        results_qs = eval_obj.evaluation_results.select_related('factor')
        factor_rows = {
            row.factor_id: row
            for row in eval_obj.evaluation_factors.select_related('factor')
        }
        factors_payload = []
        for result in results_qs:
            factor_row = factor_rows.get(result.factor_id)
            factors_payload.append({
                'factor': result.factor.name,
                'pm': float(result.weighted_average),
                'foda': result.get_foda_classification_display(),
                'ir': factor_row.relative_importance if factor_row else None,
                'alcance': factor_row.scope_used if factor_row else '',
                'supera_umbral': result.meets_threshold,
            })
        strengths = [item for item in factors_payload if item['supera_umbral']]
        weaknesses = [item for item in factors_payload if not item['supera_umbral']]
        ir_summary = [
            {
                'factor': row.factor.name,
                'ir': row.relative_importance,
                'es_relevante': row.is_relevant,
            }
            for row in factor_rows.values()
        ]

        from apps.guios.services.methodology import determine_final_recommendation
        try:
            tentative_rec, tentative_explanation = determine_final_recommendation(results_qs)
        except Exception:
            tentative_rec, tentative_explanation = '', ''

        predetermined = build_predetermined_narrative(
            software_name=eval_obj.software_name,
            org_name=eval_obj.org_name,
            org_sector=eval_obj.org_sector,
            recommendation=tentative_rec or 'A',
            explanation_text=tentative_explanation,
            factors=factors_payload,
        )

        if eval_obj.ai_enabled and (not ai_summary or not ai_mitigation) and tentative_rec:
            try:
                ai_response = ai_service.generate_executive_summary_and_verdict(
                    evaluation=eval_obj,
                    recommendation=tentative_rec,
                    explanation_text=tentative_explanation,
                    weaknesses=weaknesses,
                    strengths=strengths,
                    ir_summary=ir_summary,
                    factors=factors_payload,
                )
                if not ai_summary:
                    ai_summary = ai_response.get('executive_summary', '')
                if not ai_mitigation:
                    ai_mitigation = ai_response.get('mitigation_plan', '')
            except Exception as exc:
                logger.warning(
                    "Error al generar resumen ejecutivo de IA para evaluación pública UUID %s: %s. "
                    "Se usa el texto predeterminado del motor.",
                    uuid,
                    exc,
                )

        if not ai_summary:
            ai_summary = predetermined['executive_summary']
        if not ai_mitigation:
            ai_mitigation = predetermined['mitigation_plan']

        try:
            generate_evaluation_verdict(
                evaluation_id=eval_obj.id,
                ai_executive_summary=ai_summary,
                ai_mitigation_plan=ai_mitigation,
            )
        except (EvaluationAlreadyCompletedError, EvaluationValidationError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed = get_evaluation_detail_by_uuid_or_error(uuid)
        return Response(EvaluationDetailOutputSerializer(detailed).data, status=status.HTTP_200_OK)

    # ─────────────────────────────────────────────────────────────────────────
    # 6. ASISTENCIA COGNITIVA DE IA (SUGERENCIAS ORIENTATIVAS RN-05)
    # ─────────────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='ai-suggest-importance')
    def ai_suggest_importance(self, request, uuid=None):
        """
        POST /api/v1/guios/public/evaluations/{uuid}/ai-suggest-importance/
        Sugerencia asistida por IA de la Importancia del Decisor (ID: 1 a 4) para un factor (RF-IA-02, US-13).
        """
        serializer = AISuggestImportanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        factor_id = serializer.validated_data['factor_id']

        try:
            eval_obj = get_evaluation_by_uuid_or_error(uuid)
            eval_factor = EvaluationFactor.objects.select_related('factor').get(
                evaluation=eval_obj,
                factor_id=factor_id,
            )
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except EvaluationFactor.DoesNotExist:
            return Response({'error': f'Factor #{factor_id} no está registrado en la evaluación.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            suggestion = ai_service.suggest_factor_importance(
                evaluation=eval_obj,
                factor=eval_factor.factor,
                is_suggested=eval_factor.systemic_importance_snapshot,
            )
            eval_factor.ai_suggested_id = suggestion.get('suggested_id')
            eval_factor.ai_id_justification = suggestion.get('justification', '')
            eval_factor.save(update_fields=['ai_suggested_id', 'ai_id_justification'])
            return Response(suggestion, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.exception("Error al sugerir ID con IA en evaluación pública %s: %s", uuid, exc)
            return Response(
                {'error': 'El servicio de IA no se encuentra disponible temporalmente. Puede continuar manualmente.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    @action(detail=True, methods=['post'], url_path='ai-suggest-rating')
    def ai_suggest_rating(self, request, uuid=None):
        """
        POST /api/v1/guios/public/evaluations/{uuid}/ai-suggest-rating/
        Sugerencia asistida por IA de la calificación de cumplimiento de un subfactor (RF-IA-03, US-13).
        """
        serializer = AISuggestRatingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subfactor_id = serializer.validated_data['subfactor_id']

        try:
            eval_obj = get_evaluation_by_uuid_or_error(uuid)
            eval_subfactor = EvaluationSubfactor.objects.select_related('subfactor').get(
                evaluation=eval_obj,
                subfactor_id=subfactor_id,
            )
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except EvaluationSubfactor.DoesNotExist:
            return Response({'error': f'Subfactor #{subfactor_id} no está registrado en la evaluación.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            suggestion = ai_service.suggest_subfactor_rating(
                evaluation=eval_obj,
                subfactor=eval_subfactor.subfactor,
            )
            eval_subfactor.ai_suggested_rating = suggestion.get('suggested_rating')
            eval_subfactor.ai_rating_justification = suggestion.get('justification', '')
            eval_subfactor.save(update_fields=['ai_suggested_rating', 'ai_rating_justification'])
            return Response(suggestion, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.exception("Error al sugerir calificación de subfactor con IA en evaluación pública %s: %s", uuid, exc)
            return Response(
                {'error': 'El servicio de IA no se encuentra disponible temporalmente. Puede continuar manualmente.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    @action(detail=True, methods=['post'], url_path='ai-suggest-factor-ratings')
    def ai_suggest_factor_ratings(self, request, uuid=None):
        """
        POST /api/v1/guios/public/evaluations/{uuid}/ai-suggest-factor-ratings/
        Califica con IA todos los subfactores del factor que el usuario está viendo.
        """
        serializer = AISuggestImportanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        factor_id = serializer.validated_data['factor_id']

        try:
            eval_obj = get_evaluation_by_uuid_or_error(uuid)
            rows = list(
                EvaluationSubfactor.objects.select_related('subfactor', 'subfactor__factor').filter(
                    evaluation=eval_obj,
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

        try:
            suggestion = ai_service.suggest_factor_ratings(
                evaluation=eval_obj,
                factor=rows[0].subfactor.factor,
                subfactors=[row.subfactor for row in rows],
            )
            stored = store_factor_rating_suggestions(rows, suggestion.get('ratings') or {})
            return Response({'factor_id': factor_id, 'ratings': stored}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception(
                "Error al sugerir calificaciones del factor %s en evaluación pública %s: %s",
                factor_id,
                uuid,
                exc,
            )
            return Response(
                {'error': 'El servicio de IA no se encuentra disponible temporalmente. Puede continuar manualmente.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    # ─────────────────────────────────────────────────────────────────────────
    # 7. EXPORTACIÓN PÚBLICA DE REPORTES (PDF Y EXCEL)
    # ─────────────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request, uuid=None):
        """
        GET /api/v1/guios/public/evaluations/{uuid}/export-pdf/
        Genera y descarga el Dossier Técnico oficial de la evaluación en PDF.
        """
        try:
            evaluation = get_evaluation_detail_by_uuid_or_error(uuid)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        pdf_buffer = EvaluationPDFReport.generate(evaluation)
        clean_name = "".join(c for c in evaluation.software_name if c.isalnum() or c in ('_', '-')).strip()
        filename = f"Evaluacion_GUIOS_{clean_name}_{str(evaluation.uuid)[:8]}.pdf"

        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['get'], url_path='export-excel')
    def export_excel(self, request, uuid=None):
        """
        GET /api/v1/guios/public/evaluations/{uuid}/export-excel/
        Genera y descarga el Dossier Metodológico en formato Excel (.xlsx).
        """
        try:
            evaluation = get_evaluation_detail_by_uuid_or_error(uuid)
        except EvaluationNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        excel_buffer = EvaluationExcelReport.generate(evaluation)
        clean_name = "".join(c for c in evaluation.software_name if c.isalnum() or c in ('_', '-')).strip()
        filename = f"Evaluacion_GUIOS_{clean_name}_{str(evaluation.uuid)[:8]}.xlsx"

        response = HttpResponse(
            excel_buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response
