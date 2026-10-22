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

    def validate_software_repo_url(self, value):
        return value or None


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


class EvaluationFactorStateSerializer(serializers.Serializer):
    factor_id = serializers.IntegerField()
    code = serializers.CharField(source='factor.code', allow_null=True)
    dimension = serializers.CharField(source='factor.dimension.name')
    name = serializers.CharField(source='factor_name_snapshot')
    suggested_importance = serializers.IntegerField(source='suggested_importance_snapshot')
    decisor_importance = serializers.IntegerField(allow_null=True)
    relative_importance = serializers.IntegerField(allow_null=True)
    is_relevant = serializers.BooleanField(allow_null=True)
    scope_used = serializers.CharField()
    scope_configurable = serializers.BooleanField(source='factor.scope_configurable')
    subfactors = EvaluationSubfactorStateSerializer(many=True, source='items')


class VerdictSerializer(serializers.Serializer):
    recommendation = serializers.CharField()
    recommendation_label = serializers.CharField(source='get_recommendation_display')
    explanation_text = serializers.CharField()
    calculated_at = serializers.DateTimeField()


class EvaluationStateSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    software_name = serializers.CharField()
    software_version = serializers.CharField()
    software_repo_url = serializers.URLField(allow_null=True)
    org_name = serializers.CharField()
    org_sector = serializers.CharField()
    org_description = serializers.CharField()
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
