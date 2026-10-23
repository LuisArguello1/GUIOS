from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from ...selectors.evaluation import get_evaluation_factor
from ...services import ai
from ...services import evaluation as evaluation_service
from ...services.ai import assistance
from ...services.ai.provider import AIError, AITimeout
from ..serializers.ai_serializers import (
    AIReportSerializer,
    AIStatusSerializer,
    ImportanceSuggestionsSerializer,
    RatingSuggestionsSerializer,
)
from .catalog_views import PublicGuiosView
from .evaluation_views import ERRORS, LOCKED, TAGS, TOKEN_PARAMETER, EvaluationAccessMixin, locked_response

AI_ERRORS = {
    **ERRORS,
    400: OpenApiResponse(description="La evaluación no tiene activada la asistencia de IA (ai_not_enabled)."),
    502: OpenApiResponse(description="El servicio de IA falló o su respuesta no cumple el formato (ai_error, ai_invalid_response)."),
    503: OpenApiResponse(description="La IA no está configurada en el servidor (ai_unavailable)."),
    504: OpenApiResponse(description="El servicio de IA no respondió a tiempo (ai_timeout)."),
}
MANUAL = " Puede continuar la evaluación en modo manual."


def _error(detail, code, http_status):
    return Response({'detail': detail, 'code': code}, status=http_status)


class AIGuiosView(EvaluationAccessMixin, PublicGuiosView):
    """Vistas de IA: límite propio por IP (GUIOS_AI_RATE) y errores que no cortan la evaluación."""
    throttle_scope = 'guios_ai'

    def run(self, operation):
        try:
            return operation()
        except assistance.AIUnavailable as exc:
            return _error(str(exc), 'ai_unavailable', status.HTTP_503_SERVICE_UNAVAILABLE)
        except assistance.AINotEnabled as exc:
            return _error(str(exc), 'ai_not_enabled', status.HTTP_400_BAD_REQUEST)
        except assistance.FactorNotRelevant as exc:
            return _error(str(exc), 'factor_not_relevant', status.HTTP_400_BAD_REQUEST)
        except assistance.VerdictRequired as exc:
            return _error(str(exc), 'verdict_required', status.HTTP_409_CONFLICT)
        except evaluation_service.EvaluationLocked as exc:
            return locked_response(exc)
        except AITimeout as exc:
            return _error(str(exc) + MANUAL, exc.code, status.HTTP_504_GATEWAY_TIMEOUT)
        except AIError as exc:
            return _error(str(exc) + MANUAL, exc.code, status.HTTP_502_BAD_GATEWAY)


class AIStatusView(PublicGuiosView):
    @extend_schema(
        tags=TAGS, summary="Disponibilidad de la asistencia de IA",
        description="Indica si el servidor tiene IA configurada. Nunca expone la clave ni el modelo.",
        responses=AIStatusSerializer,
    )
    def get(self, request):
        return Response({'available': ai.is_available()})


class AIImportanceView(AIGuiosView):
    @extend_schema(
        tags=TAGS, summary="IA: sugerir la ID de cada factor (Paso 1-2)",
        description=(
            "Guarda en cada factor la ID sugerida y su justificación; la ID sigue sin calificar "
            "hasta que el evaluador la elige (RN-05)."
        ),
        parameters=[TOKEN_PARAMETER], request=None,
        responses={200: ImportanceSuggestionsSerializer, **AI_ERRORS, **LOCKED},
    )
    def post(self, request, evaluation_uuid):
        evaluation = self.get_evaluation(request, evaluation_uuid)
        return self.run(lambda: Response(
            ImportanceSuggestionsSerializer.payload(assistance.suggest_importance(evaluation)),
        ))


class AIRatingsView(AIGuiosView):
    @extend_schema(
        tags=TAGS, summary="IA: sugerir las calificaciones de un factor (Paso 3-4)",
        description=(
            "Solo para factores relevantes (con ID e IR > 1); si no, 400 factor_not_relevant sin llamar "
            "a la IA. Guarda la calificación sugerida y su justificación en cada subfactor."
        ),
        parameters=[TOKEN_PARAMETER], request=None,
        responses={200: RatingSuggestionsSerializer, **AI_ERRORS, **LOCKED},
    )
    def post(self, request, evaluation_uuid, factor_id):
        evaluation = self.get_evaluation(request, evaluation_uuid)
        if get_evaluation_factor(evaluation, factor_id) is None:
            raise NotFound("El factor no pertenece a esta evaluación.")
        return self.run(lambda: Response(
            RatingSuggestionsSerializer.payload(factor_id, assistance.suggest_ratings(evaluation, factor_id)),
        ))


class AIReportView(AIGuiosView):
    @extend_schema(
        tags=TAGS, summary="IA: resumen ejecutivo y plan de mitigación",
        description=(
            "Solo después del dictamen (si no, 409 verdict_required). El plan de mitigación se genera "
            "si el dictamen es B o C. Se guarda separado del dictamen, que no cambia."
        ),
        parameters=[TOKEN_PARAMETER], request=None,
        responses={200: AIReportSerializer, **AI_ERRORS, 409: OpenApiResponse(description="Aún no hay dictamen.")},
    )
    def post(self, request, evaluation_uuid):
        evaluation = self.get_evaluation(request, evaluation_uuid)
        return self.run(lambda: Response(AIReportSerializer(assistance.generate_report(evaluation)).data))
