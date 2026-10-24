"""
apps/guios/api/serializers/factor_serializers.py
─────────────────────────────────────────────────────────────────────────────
Serializers para el modelo Factor (Catálogo Maestro GUIOS).
Separación estricta entre serializers de entrada (Input) y salida (Output/Representation).
"""

from rest_framework import serializers

from apps.guios.models import Dimension, Factor, Subfactor


# ── Serializers de Salida (Output) ────────────────────────────────────────────

class SubfactorItemSerializer(serializers.ModelSerializer):
    """Representación de subfactores contenidos dentro de un factor."""
    class Meta:
        model = Subfactor
        fields = [
            'id',
            'description',
            'base_citations_count',
            'keywords_ia',
            'order',
            'is_base',
            'is_active',
            'created_at',
            'updated_at',
        ]


class DimensionBriefSerializer(serializers.ModelSerializer):
    """Representación compacta de la dimensión padre para evitar consultas extra."""
    class Meta:
        model = Dimension
        fields = ['id', 'name', 'order', 'is_base']


class FactorListSerializer(serializers.ModelSerializer):
    """Representación de salida para listados de factores con conteo de subfactores."""
    dimension = DimensionBriefSerializer(read_only=True)
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)
    subfactors_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Factor
        fields = [
            'id',
            'dimension',
            'name',
            'scope',
            'scope_display',
            'scope_configurable',
            'expert_importance',
            'literature_importance_base',
            'systemic_importance',
            'order',
            'is_base',
            'is_active',
            'subfactors_count',
            'created_at',
            'updated_at',
        ]


class FactorDetailSerializer(FactorListSerializer):
    """Representación detallada de un factor incluyendo todos sus subfactores."""
    subfactors = serializers.SerializerMethodField()

    class Meta(FactorListSerializer.Meta):
        fields = FactorListSerializer.Meta.fields + ['subfactors']

    def get_subfactors(self, obj):
        # Utilizar atributo pre-cargado por Prefetch para evitar queries N+1
        items = getattr(obj, 'prefetched_subfactors', None)
        if items is None:
            items = obj.subfactors.all()
        return SubfactorItemSerializer(items, many=True).data


# ── Serializers de Entrada (Input) ────────────────────────────────────────────

class FactorCreateInputSerializer(serializers.Serializer):
    """Validación estricta de datos de entrada para la creación de un factor."""
    dimension_id = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=200)
    scope = serializers.ChoiceField(
        choices=Factor.SCOPE_CHOICES,
        default=Factor.SCOPE_INTERNAL,
    )
    scope_configurable = serializers.BooleanField(default=False)
    expert_importance = serializers.IntegerField(min_value=1, max_value=4, default=3)
    literature_importance_base = serializers.IntegerField(min_value=1, max_value=4, default=1)
    systemic_importance = serializers.IntegerField(
        min_value=1,
        max_value=4,
        required=False,
        allow_null=True,
    )
    order = serializers.IntegerField(min_value=0, default=0)
    is_active = serializers.BooleanField(default=True)

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El nombre del factor no puede estar vacío.")
        return cleaned


class FactorUpdateInputSerializer(serializers.Serializer):
    """Validación estricta de datos de entrada para la actualización (total o parcial)."""
    dimension_id = serializers.IntegerField(min_value=1, required=False)
    name = serializers.CharField(max_length=200, required=False)
    scope = serializers.ChoiceField(choices=Factor.SCOPE_CHOICES, required=False)
    scope_configurable = serializers.BooleanField(required=False)
    expert_importance = serializers.IntegerField(min_value=1, max_value=4, required=False)
    literature_importance_base = serializers.IntegerField(min_value=1, max_value=4, required=False)
    systemic_importance = serializers.IntegerField(
        min_value=1,
        max_value=4,
        required=False,
        allow_null=True,
    )
    order = serializers.IntegerField(min_value=0, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El nombre del factor no puede estar vacío.")
        return cleaned
