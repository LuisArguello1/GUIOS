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
from apps.guios.services.evaluation import is_evaluation_phases_locked



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
    org_size = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    it_staff = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    replaced_software = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    target_timeline = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    current_platforms = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    main_goal = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    ai_enabled = serializers.BooleanField(required=False, default=False)
    auto_compute_literature = serializers.BooleanField(required=False, default=True)
    data_storage_consent = serializers.BooleanField(required=True)
    ai_processing_consent = serializers.BooleanField(required=False, default=False)
    privacy_policy_version = serializers.CharField(max_length=20, required=False, default="1.0")

    def validate(self, attrs):
        if not attrs.get('data_storage_consent'):
            raise serializers.ValidationError({
                'data_storage_consent': 'Debe otorgar su consentimiento para el almacenamiento y análisis estadístico anónimo para iniciar la evaluación.'
            })
        if attrs.get('ai_enabled') and not attrs.get('ai_processing_consent'):
            raise serializers.ValidationError({
                'ai_processing_consent': 'Para utilizar la asistencia de Inteligencia Artificial, debe autorizar el procesamiento de la información técnica por los modelos cognitivos.'
            })
        return attrs


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
    org_size = serializers.CharField(max_length=100, required=False, allow_blank=True)
    it_staff = serializers.CharField(max_length=100, required=False, allow_blank=True)
    replaced_software = serializers.CharField(max_length=200, required=False, allow_blank=True)
    target_timeline = serializers.CharField(max_length=100, required=False, allow_blank=True)
    current_platforms = serializers.CharField(max_length=150, required=False, allow_blank=True)
    main_goal = serializers.CharField(max_length=200, required=False, allow_blank=True)


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


class RepoHealthSyncInputSerializer(serializers.Serializer):
    """Valida la URL opcional para sincronizar el pulso técnico del repositorio."""
    repo_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)



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
        try:
            return obj.verdict.recommendation if hasattr(obj, 'verdict') and obj.verdict else None
        except Exception:
            return None


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
    phases_locked = serializers.SerializerMethodField()
    recommendation = serializers.SerializerMethodField()
    recommendation_display = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = [
            'id',
            'uuid',
            'software_name',
            'software_category',
            'software_version',
            'software_repo_url',
            'repo_health_metrics',
            'software_description',
            'org_name',
            'org_sector',
            'org_description',
            'org_size',
            'it_staff',
            'replaced_software',
            'target_timeline',
            'current_platforms',
            'main_goal',
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
            'data_storage_consent',
            'ai_processing_consent',
            'consent_timestamp',
            'privacy_policy_version',
            'phases_locked',
            'recommendation',
            'recommendation_display',
            'factors',
            'subfactors',
            'results',
            'verdict',
        ]
        read_only_fields = fields

    def get_phases_locked(self, obj) -> bool:
        return is_evaluation_phases_locked(obj)

    def get_recommendation(self, obj) -> str | None:
        try:
            return obj.verdict.recommendation if hasattr(obj, 'verdict') and obj.verdict else None
        except Exception:
            return None

    def get_recommendation_display(self, obj) -> str | None:
        try:
            return obj.verdict.get_recommendation_display() if hasattr(obj, 'verdict') and obj.verdict else None
        except Exception:
            return None
