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
