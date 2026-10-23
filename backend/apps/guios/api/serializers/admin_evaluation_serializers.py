from rest_framework import serializers

from ...models import Evaluation, EvaluationVerdict


class HistoryFilterSerializer(serializers.Serializer):
    """Filtros del historial (RF-ADM-34). Las fechas filtran por fecha de inicio."""
    software = serializers.CharField(required=False, allow_blank=True)
    organization = serializers.CharField(required=False, allow_blank=True)
    recommendation = serializers.ChoiceField(choices=['A', 'B', 'C'], required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=[c for c, _ in Evaluation.STATUS_CHOICES], required=False, allow_blank=True)
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get('date_from') and attrs.get('date_to') and attrs['date_from'] > attrs['date_to']:
            raise serializers.ValidationError({'date_to': "La fecha final es anterior a la inicial."})
        return attrs


class EvaluationListSerializer(serializers.ModelSerializer):
    recommendation = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = ['uuid', 'software_name', 'software_version', 'org_name', 'org_sector', 'status',
                  'recommendation', 'ai_enabled', 'started_at', 'completed_at']

    def get_recommendation(self, obj) -> str | None:
        verdict = getattr(obj, 'verdict', None)
        return verdict.recommendation if verdict else None


class AdminSubfactorSerializer(serializers.Serializer):
    subfactor_id = serializers.IntegerField()
    code = serializers.CharField(allow_null=True)
    description = serializers.CharField(help_text="Instantánea del texto al iniciar la evaluación.")
    rating = serializers.IntegerField(allow_null=True)


class AdminFailingSubfactorSerializer(serializers.Serializer):
    subfactor_id = serializers.IntegerField()
    description = serializers.CharField()
    rating = serializers.IntegerField(help_text="1 = no cumple, 2 = no se sabe.")


class AdminFactorDetailSerializer(serializers.Serializer):
    factor_id = serializers.IntegerField()
    code = serializers.CharField(allow_null=True)
    dimension = serializers.CharField()
    name = serializers.CharField(help_text="Instantánea del nombre del factor.")
    suggested_importance = serializers.IntegerField(help_text="Instantánea de la IS.")
    decisor_importance = serializers.IntegerField(allow_null=True)
    relative_importance = serializers.IntegerField(allow_null=True)
    is_relevant = serializers.BooleanField(allow_null=True)
    scope_used = serializers.CharField(allow_null=True)
    scope_configurable = serializers.BooleanField()
    weighted_average = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    meets_threshold = serializers.BooleanField(allow_null=True)
    foda = serializers.CharField(allow_null=True)
    failing_subfactors = AdminFailingSubfactorSerializer(many=True)
    subfactors = AdminSubfactorSerializer(many=True)


class AdminMissingSerializer(serializers.Serializer):
    kind = serializers.CharField()
    factor_id = serializers.IntegerField()
    factor_name = serializers.CharField()
    subfactor_id = serializers.IntegerField(allow_null=True)


class AdminVerdictSerializer(serializers.ModelSerializer):
    recommendation_label = serializers.CharField(source='get_recommendation_display')

    class Meta:
        model = EvaluationVerdict
        fields = ['recommendation', 'recommendation_label', 'explanation_text', 'ai_executive_summary',
                  'ai_mitigation_plan', 'calculated_at']


class EvaluationDetailSerializer(serializers.Serializer):
    """Detalle de solo lectura (RF-ADM-35)."""
    evaluation = serializers.SerializerMethodField()
    results_source = serializers.ChoiceField(
        choices=['stored', 'calculated'],
        help_text="stored: resultados y dictamen guardados (completada); calculated: motor (en progreso).",
    )
    factors = AdminFactorDetailSerializer(many=True)
    missing = AdminMissingSerializer(many=True)
    verdict = AdminVerdictSerializer(allow_null=True)

    def get_evaluation(self, obj) -> dict:
        evaluation = obj['evaluation']
        return {
            **EvaluationListSerializer(evaluation).data,
            'software_repo_url': evaluation.software_repo_url,
            'org_description': evaluation.org_description,
        }


class RecentEvaluationSerializer(EvaluationListSerializer):
    class Meta(EvaluationListSerializer.Meta):
        fields = ['uuid', 'software_name', 'org_name', 'status', 'recommendation', 'started_at', 'completed_at']


class VerdictCountSerializer(serializers.Serializer):
    A = serializers.IntegerField()
    B = serializers.IntegerField()
    C = serializers.IntegerField()


class MetricsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    completed = serializers.IntegerField()
    verdicts = VerdictCountSerializer()
    recent = RecentEvaluationSerializer(many=True)
