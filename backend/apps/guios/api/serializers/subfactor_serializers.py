"""
apps/guios/api/serializers/subfactor_serializers.py
─────────────────────────────────────────────────────────────────────────────
Serializers para el modelo Subfactor (Criterios de 3er nivel de la Metodología GUIOS).
Separación estricta entre serializers de entrada (Input) y salida (Output/Representation).
"""

from rest_framework import serializers
from apps.guios.models import Factor, Subfactor


# ── Serializers de Salida (Output) ────────────────────────────────────────────

class FactorBriefSerializer(serializers.ModelSerializer):
    """Representación resumida del factor y su dimensión para respuestas de subfactores."""
    dimension_name = serializers.CharField(source='dimension.name', read_only=True)
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)

    class Meta:
        model = Factor
        fields = [
            'id',
            'name',
            'dimension_id',
            'dimension_name',
            'scope',
            'scope_display',
            'is_base',
        ]


class SubfactorListSerializer(serializers.ModelSerializer):
    """Representación de salida para listados de subfactores con factor pre-cargado."""
    factor = FactorBriefSerializer(read_only=True)

    class Meta:
        model = Subfactor
        fields = [
            'id',
            'factor',
            'description',
            'base_citations_count',
            'keywords_ia',
            'order',
            'is_base',
            'is_active',
            'created_at',
            'updated_at',
        ]


class SubfactorDetailSerializer(SubfactorListSerializer):
    """Representación detallada de un subfactor individual."""
    pass


# ── Serializers de Entrada (Input) ────────────────────────────────────────────

class SubfactorCreateInputSerializer(serializers.Serializer):
    """Validación estricta de datos de entrada para la creación de un subfactor."""
    factor_id = serializers.IntegerField(min_value=1)
    description = serializers.CharField()
    base_citations_count = serializers.IntegerField(min_value=0, default=1)
    keywords_ia = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    order = serializers.IntegerField(min_value=0, default=0)
    is_active = serializers.BooleanField(default=True)

    def validate_description(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("La descripción del subfactor no puede estar vacía.")
        return cleaned


class SubfactorUpdateInputSerializer(serializers.Serializer):
    """Validación estricta de datos de entrada para la actualización (total o parcial)."""
    factor_id = serializers.IntegerField(min_value=1, required=False)
    description = serializers.CharField(required=False)
    base_citations_count = serializers.IntegerField(min_value=0, required=False)
    keywords_ia = serializers.CharField(max_length=255, required=False, allow_blank=True)
    order = serializers.IntegerField(min_value=0, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_description(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("La descripción del subfactor no puede estar vacía.")
        return cleaned
