"""
apps/guios/api/serializers/evaluation_serializers.py
─────────────────────────────────────────────────────────────────────────────
Serializadores DRF para Evaluaciones Metodológicas GUIOS.
Cumple estrictamente con la separación entre Input Serializers y Output Serializers.
Sin consultas ORM en SerializerMethodField (previene antipatrones N+1).
"""

from rest_framework import serializers
from apps.guios.models import (
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
    AIAssistanceLog,
)



# ─────────────────────────────────────────────────────────────────────────────
# 1. INPUT SERIALIZERS (Validación de entrada)
# ─────────────────────────────────────────────────────────────────────────────

class EvaluationCreateInputSerializer(serializers.Serializer):
    """Valida la creación de una nueva sesión de evaluación."""
    software_name = serializers.CharField(max_length=200, required=True, trim_whitespace=True)
    org_name = serializers.CharField(max_length=200, required=True, trim_whitespace=True)
    software_category = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    software_version = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    software_repo_url = serializers.URLField(required=False, allow_null=True, allow_blank=True, default=None)
    software_description = serializers.CharField(required=False, allow_blank=True, default="")
    org_sector = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    org_description = serializers.CharField(required=False, allow_blank=True, default="")
    ai_enabled = serializers.BooleanField(required=False, default=False)
    auto_compute_literature = serializers.BooleanField(required=False, default=True)


class EvaluationUpdateInputSerializer(serializers.Serializer):
    """Valida la actualización de metadatos descriptivos de la evaluación."""
    software_name = serializers.CharField(max_length=200, required=False, trim_whitespace=True)
    org_name = serializers.CharField(max_length=200, required=False, trim_whitespace=True)
    software_category = serializers.CharField(max_length=100, required=False, allow_blank=True)
    software_version = serializers.CharField(max_length=50, required=False, allow_blank=True)
    software_repo_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    software_description = serializers.CharField(required=False, allow_blank=True)
    org_sector = serializers.CharField(max_length=150, required=False, allow_blank=True)
    org_description = serializers.CharField(required=False, allow_blank=True)


class CalculateLiteratureInputSerializer(serializers.Serializer):
    """Valida parámetros para recalcular literatura / IA."""
    use_ai = serializers.BooleanField(required=False, default=False)
    async_mode = serializers.BooleanField(required=False, default=False)
    ai_citations_by_subfactor = serializers.DictField(
        child=serializers.IntegerField(min_value=0),
        required=False,
        allow_null=True,
    )
    ai_sources_by_factor = serializers.DictField(
        child=serializers.ListField(child=serializers.DictField()),
        required=False,
        allow_null=True,
    )


class AISuggestImportanceInputSerializer(serializers.Serializer):
    """Valida solicitud de sugerencia de Importancia del Decisor (ID)."""
    factor_id = serializers.IntegerField(required=True)


class AISuggestRatingInputSerializer(serializers.Serializer):
    """Valida solicitud de sugerencia de calificación de un subfactor."""
    subfactor_id = serializers.IntegerField(required=True)



class DecisorFactorItemInputSerializer(serializers.Serializer):
    """Valida la asignación de importancia del decisor para un factor."""
    factor_id = serializers.IntegerField(min_value=1)
    decisor_importance = serializers.IntegerField(min_value=1, max_value=4)
    scope_used = serializers.ChoiceField(
        choices=[EvaluationFactor.SCOPE_INTERNAL, EvaluationFactor.SCOPE_EXTERNAL],
        required=False,
        default=EvaluationFactor.SCOPE_INTERNAL,
    )


class ApplyDecisorInputSerializer(serializers.Serializer):
    """Valida el payload del Paso 1-2 (Decisor): lista de factores calificados."""
    factors = serializers.ListField(
        child=DecisorFactorItemInputSerializer(),
        allow_empty=False,
    )


class RateSubfactorsInputSerializer(serializers.Serializer):
    """
    Valida el payload del Paso 3-4 (Calificación de subfactores).
    Diccionario de {subfactor_id: rating (1 a 4)}.
    """
    ratings = serializers.DictField(
        child=serializers.IntegerField(min_value=1, max_value=4),
        allow_empty=False,
    )


class ComputeVerdictInputSerializer(serializers.Serializer):
    """Valida payload opcional para la emisión del dictamen final."""
    ai_executive_summary = serializers.CharField(required=False, allow_blank=True, default="")
    ai_mitigation_plan = serializers.CharField(required=False, allow_blank=True, default="")


# ─────────────────────────────────────────────────────────────────────────────
# 2. OUTPUT SERIALIZERS (Representación de datos)
# ─────────────────────────────────────────────────────────────────────────────

class EvaluationFactorOutputSerializer(serializers.ModelSerializer):
    """Representación de un factor dentro de la sesión de evaluación."""
    factor_id = serializers.IntegerField(source='factor.id', read_only=True)
    factor_name = serializers.CharField(source='factor.name', read_only=True)
    dimension_id = serializers.IntegerField(source='factor.dimension.id', read_only=True)
    dimension_name = serializers.CharField(source='factor.dimension.name', read_only=True)
    dimension_order = serializers.IntegerField(source='factor.dimension.order', read_only=True)
    order = serializers.IntegerField(source='factor.order', read_only=True)

    class Meta:
        model = EvaluationFactor
        fields = [
            'id',
            'factor_id',
            'factor_name',
            'dimension_id',
            'dimension_name',
            'dimension_order',
            'order',
            'systemic_importance_snapshot',
            'subfactors_count_snapshot',
            'citations_count',
            'citation_ratio',
            'literature_importance_calculated',
            'expert_importance_snapshot',
            'decisor_importance',
            'relative_importance',
            'is_relevant',
            'scope_used',
            'ai_literature_sources',
            'ai_suggested_id',
            'ai_id_justification',
            'id_was_ai_accepted',
        ]
        read_only_fields = fields


class EvaluationSubfactorOutputSerializer(serializers.ModelSerializer):
    """Representación de un subfactor dentro de la sesión de evaluación."""
    subfactor_id = serializers.IntegerField(source='subfactor.id', read_only=True)
    factor_id = serializers.IntegerField(source='subfactor.factor_id', read_only=True)
    factor_name = serializers.CharField(source='subfactor.factor.name', read_only=True)
    order = serializers.IntegerField(source='subfactor.order', read_only=True)

    class Meta:
        model = EvaluationSubfactor
        fields = [
            'id',
            'subfactor_id',
            'factor_id',
            'factor_name',
            'order',
            'description_snapshot',
            'ai_citations_count',
            'rating',
            'ai_suggested_rating',
            'ai_rating_justification',
            'rating_was_ai_accepted',
            'saved_at',
        ]
        read_only_fields = fields


class EvaluationResultOutputSerializer(serializers.ModelSerializer):
    """Representación del resultado FODA de un factor relevante."""
    factor_id = serializers.IntegerField(source='factor.id', read_only=True)
    factor_name = serializers.CharField(source='factor.name', read_only=True)
    foda_display = serializers.CharField(source='get_foda_classification_display', read_only=True)

    class Meta:
        model = EvaluationResult
        fields = [
            'id',
            'factor_id',
            'factor_name',
            'weighted_average',
            'meets_threshold',
            'foda_classification',
            'foda_display',
            'calculated_at',
        ]
        read_only_fields = fields


class EvaluationVerdictOutputSerializer(serializers.ModelSerializer):
    """Representación del dictamen final emitido por el motor."""
    recommendation_display = serializers.CharField(source='get_recommendation_display', read_only=True)

    class Meta:
        model = EvaluationVerdict
        fields = [
            'id',
            'recommendation',
            'recommendation_display',
            'explanation_text',
            'ai_executive_summary',
            'ai_mitigation_plan',
            'calculated_at',
        ]
class AIAssistanceLogOutputSerializer(serializers.ModelSerializer):
    """Representación de auditoría inmutable de asistencia de IA."""
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    factor_name = serializers.CharField(source='factor.name', default=None, read_only=True)

    class Meta:
        model = AIAssistanceLog
        fields = [
            'id',
            'request_type',
            'request_type_display',
            'factor_id',
            'factor_name',
            'status',
            'status_display',
            'error_message',
            'response_time_ms',
            'requested_at',
        ]
        read_only_fields = fields


class EvaluationListOutputSerializer(serializers.ModelSerializer):

    """Representación liviana para listado y grillas de evaluaciones."""
    created_by_username = serializers.CharField(source='created_by.username', default=None, read_only=True)
    recommendation = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = [
            'id',
            'uuid',
            'software_name',
            'software_category',
            'software_version',
            'org_name',
            'org_sector',
            'status',
            'ai_enabled',
            'ai_status',
            'created_by_username',
            'started_at',
            'completed_at',
            'recommendation',
        ]
        read_only_fields = fields

    def get_recommendation(self, obj) -> str | None:
        """Accede al veredicto precargado sin generar consulta N+1."""
        verdict = getattr(obj, 'verdict', None)
        return verdict.recommendation if verdict else None


class EvaluationDetailOutputSerializer(serializers.ModelSerializer):
    """
    Representación completa de una sesión de evaluación para el asistente / wizard:
    incluye umbrales de cuartiles, factores, subfactores, resultados FODA y veredicto.
    """
    created_by_username = serializers.CharField(source='created_by.username', default=None, read_only=True)
    factors = EvaluationFactorOutputSerializer(source='evaluation_factors', many=True, read_only=True)
    subfactors = EvaluationSubfactorOutputSerializer(source='evaluation_subfactors', many=True, read_only=True)
    results = EvaluationResultOutputSerializer(source='evaluation_results', many=True, read_only=True)
    verdict = EvaluationVerdictOutputSerializer(read_only=True)

    class Meta:
        model = Evaluation
        fields = [
            'id',
            'uuid',
            'software_name',
            'software_category',
            'software_version',
            'software_repo_url',
            'software_description',
            'org_name',
            'org_sector',
            'org_description',
            'ai_enabled',
            'ai_status',
            'status',
            'q1_threshold',
            'q2_threshold',
            'q3_threshold',
            'q4_threshold',
            'created_by_username',
            'started_at',
            'completed_at',
            'factors',
            'subfactors',
            'results',
            'verdict',
        ]
        read_only_fields = fields
from rest_framework import serializers

from ...models import EvaluationFactor
from ..fields import PlainTextField
from .catalog_serializers import IMPORTANCE_LABELS

SCOPE_CHOICES = [c for c, _ in EvaluationFactor.SCOPE_CHOICES]


# ── Entrada ───────────────────────────────────────────────────────────────────

class EvaluationCreateSerializer(serializers.Serializer):
    """Registro del software candidato y de la organización (RF-PUB-01)."""
    software_name = PlainTextField(max_length=200)
    software_version = PlainTextField(max_length=50, required=False, allow_blank=True, default='')
    software_repo_url = serializers.URLField(required=False, allow_null=True, allow_blank=True, default=None)
    org_name = PlainTextField(max_length=200)
    org_sector = PlainTextField(max_length=150, required=False, allow_blank=True, default='')
    org_description = PlainTextField(max_length=5000, required=False, allow_blank=True, default='')
    ai_enabled = serializers.BooleanField(
        required=False, default=False,
        help_text="Activar asistencia IA (RF-IA-01). Requiere la descripción o el enlace al repositorio; "
                  "si el servidor no tiene IA configurada, queda en falso.",
    )

    def validate_software_repo_url(self, value):
        return value or None

    def validate(self, attrs):
        if attrs.get('ai_enabled') and not (attrs.get('org_description', '').strip() or attrs.get('software_repo_url')):
            raise serializers.ValidationError({
                'ai_enabled': "Para activar la asistencia IA indique la descripción de la organización "
                              "o el enlace al repositorio del software.",
            })
        return attrs


class FactorUpdateSerializer(serializers.Serializer):
    """Un cambio del Paso 1-2. null vuelve el valor a "sin calificar"."""
    decisor_importance = serializers.IntegerField(min_value=1, max_value=4, allow_null=True, required=False)
    scope_used = serializers.ChoiceField(
        choices=SCOPE_CHOICES, allow_null=True, required=False,
        help_text="Solo para el factor con ámbito configurable (Soporte).",
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Envíe decisor_importance o scope_used.")
        return attrs


class SubfactorUpdateSerializer(serializers.Serializer):
    """Una calificación del Paso 3-4. null vuelve a "sin calificar"."""
    rating = serializers.IntegerField(min_value=1, max_value=4, allow_null=True)


# ── Salida ────────────────────────────────────────────────────────────────────

class FailingSubfactorSerializer(serializers.Serializer):
    subfactor_id = serializers.IntegerField()
    description = serializers.CharField()
    rating = serializers.IntegerField(help_text="1 = no cumple, 2 = no se sabe.")


class FactorSummarySerializer(serializers.Serializer):
    factor_id = serializers.IntegerField()
    code = serializers.CharField(allow_null=True)
    name = serializers.CharField()
    suggested_importance = serializers.IntegerField()
    decisor_importance = serializers.IntegerField(allow_null=True)
    relative_importance = serializers.IntegerField(allow_null=True)
    relative_importance_label = serializers.CharField(allow_null=True)
    is_relevant = serializers.BooleanField(allow_null=True)
    scope_used = serializers.CharField(allow_null=True)
    scope_configurable = serializers.BooleanField()
    weighted_average = serializers.DecimalField(
        max_digits=5, decimal_places=2, allow_null=True,
        help_text="PM redondeada a 2 decimales (solo para mostrar).",
    )
    meets_threshold = serializers.BooleanField(allow_null=True, help_text="PM exacta >= 3.")
    foda = serializers.CharField(allow_null=True)
    subfactors_total = serializers.IntegerField()
    subfactors_rated = serializers.IntegerField()
    failing_subfactors = FailingSubfactorSerializer(many=True)


class MissingItemSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=['decisor_importance', 'scope', 'subfactor_rating'])
    factor_id = serializers.IntegerField()
    factor_name = serializers.CharField()
    subfactor_id = serializers.IntegerField(allow_null=True)


class SummarySerializer(serializers.Serializer):
    status = serializers.CharField()
    is_complete = serializers.BooleanField()
    factors = FactorSummarySerializer(many=True)
    missing = MissingItemSerializer(many=True)

    @staticmethod
    def payload(evaluation, factors, outcome):
        records = {str(item.factor_id): item for item in factors}
        rows = []
        for result in outcome.factors:
            item = records[result.code]
            rows.append({
                'factor_id': item.factor_id,
                'code': item.factor.code,
                'name': result.name,
                'suggested_importance': result.suggested_importance,
                'decisor_importance': result.decisor_importance,
                'relative_importance': result.relative_importance,
                'relative_importance_label': IMPORTANCE_LABELS.get(result.relative_importance),
                'is_relevant': result.is_relevant,
                'scope_used': result.scope,
                'scope_configurable': item.factor.scope_configurable,
                'weighted_average': result.weighted_average_display,
                'meets_threshold': result.meets_threshold,
                'foda': result.foda,
                'subfactors_total': len(item.items),
                'subfactors_rated': sum(1 for s in item.items if s.rating is not None),
                'failing_subfactors': [
                    {'subfactor_id': int(s.code), 'description': s.description, 'rating': s.rating}
                    for s in result.failing_subfactors
                ],
            })
        return {
            'status': evaluation.status,
            'is_complete': outcome.is_complete,
            'factors': rows,
            'missing': missing_payload(outcome.missing),
        }


def missing_payload(missing):
    return [
        {
            'kind': m.kind,
            'factor_id': int(m.factor_code),
            'factor_name': m.factor_name,
            'subfactor_id': int(m.subfactor_code) if m.subfactor_code else None,
        }
        for m in missing
    ]


class EvaluationSubfactorStateSerializer(serializers.Serializer):
    subfactor_id = serializers.IntegerField()
    code = serializers.CharField(source='subfactor.code', allow_null=True)
    description = serializers.CharField(source='description_snapshot')
    rating = serializers.IntegerField(allow_null=True)
    ai_suggested_rating = serializers.IntegerField(allow_null=True)
    ai_rating_justification = serializers.CharField()
    rating_was_ai_accepted = serializers.BooleanField()


class EvaluationFactorStateSerializer(serializers.Serializer):
    factor_id = serializers.IntegerField()
    code = serializers.CharField(source='factor.code', allow_null=True)
    dimension = serializers.CharField(source='factor.dimension.name')
    name = serializers.CharField(source='factor_name_snapshot')
    description = serializers.CharField(source='factor.description', help_text="Descripción del factor (catálogo vigente, solo como ayuda).")
    suggested_importance = serializers.IntegerField(source='suggested_importance_snapshot')
    decisor_importance = serializers.IntegerField(allow_null=True)
    relative_importance = serializers.IntegerField(allow_null=True)
    is_relevant = serializers.BooleanField(allow_null=True)
    scope_used = serializers.CharField()
    scope_configurable = serializers.BooleanField(source='factor.scope_configurable')
    ai_suggested_id = serializers.IntegerField(allow_null=True)
    ai_id_justification = serializers.CharField()
    id_was_ai_accepted = serializers.BooleanField()
    subfactors = EvaluationSubfactorStateSerializer(many=True, source='items')


class VerdictSerializer(serializers.Serializer):
    recommendation = serializers.CharField()
    recommendation_label = serializers.CharField(source='get_recommendation_display')
    explanation_text = serializers.CharField()
    ai_executive_summary = serializers.CharField(help_text="Complemento de la IA, separado del dictamen (vacío si no se generó).")
    ai_mitigation_plan = serializers.CharField(help_text="Solo en B o C, si se generó con la IA.")
    calculated_at = serializers.DateTimeField()


class EvaluationStateSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    software_name = serializers.CharField()
    software_version = serializers.CharField()
    software_repo_url = serializers.URLField(allow_null=True)
    org_name = serializers.CharField()
    org_sector = serializers.CharField()
    org_description = serializers.CharField()
    ai_enabled = serializers.BooleanField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(allow_null=True)
    factors = EvaluationFactorStateSerializer(many=True, source='state_factors')
    verdict = serializers.SerializerMethodField()

    def get_verdict(self, obj) -> VerdictSerializer(allow_null=True):
        verdict = getattr(obj, 'verdict', None)
        return VerdictSerializer(verdict).data if verdict else None


class EvaluationCreatedSerializer(EvaluationStateSerializer):
    session_token = serializers.CharField(
        help_text="Se entrega solo al crear. Envíelo en la cabecera X-Evaluation-Token.",
    )


class VerdictResultSerializer(serializers.Serializer):
    verdict = VerdictSerializer()
    summary = SummarySerializer()
