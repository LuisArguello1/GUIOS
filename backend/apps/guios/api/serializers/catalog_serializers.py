from rest_framework import serializers

from ...models import EvaluationFactor, EvaluationSubfactor

IMPORTANCE_LABELS = dict(EvaluationFactor.IMPORTANCE_CHOICES)
RATING_LABELS = dict(EvaluationSubfactor.RATING_CHOICES)


class CatalogSubfactorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField(allow_null=True)
    description = serializers.CharField()
    order = serializers.IntegerField()


class CatalogFactorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField(allow_null=True)
    name = serializers.CharField()
    description = serializers.CharField()
    suggested_importance = serializers.IntegerField(help_text="IS de la guía (Tabla 5.3), como referencia.")
    suggested_importance_label = serializers.SerializerMethodField()
    scope = serializers.CharField(help_text="internal, external o both (solo Soporte).")
    scope_configurable = serializers.BooleanField()
    order = serializers.IntegerField()
    subfactors = CatalogSubfactorSerializer(many=True, source='active_subfactors')

    def get_suggested_importance_label(self, obj) -> str:
        return IMPORTANCE_LABELS[obj.suggested_importance]


class CatalogDimensionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField(allow_null=True)
    name = serializers.CharField()
    description = serializers.CharField()
    order = serializers.IntegerField()
    factors = CatalogFactorSerializer(many=True, source='evaluable_factors')


class ScaleItemSerializer(serializers.Serializer):
    value = serializers.IntegerField()
    label = serializers.CharField()


class CatalogSerializer(serializers.Serializer):
    dimensions = CatalogDimensionSerializer(many=True)
    importance_scale = ScaleItemSerializer(many=True)
    rating_scale = ScaleItemSerializer(many=True)

    @staticmethod
    def payload(dimensions):
        return {
            'dimensions': dimensions,
            'importance_scale': [{'value': v, 'label': l} for v, l in IMPORTANCE_LABELS.items()],
            'rating_scale': [{'value': v, 'label': l} for v, l in RATING_LABELS.items()],
        }
