"""
apps/guios/api/serializers/dimension_serializers.py
─────────────────────────────────────────────────────────────────────────────
Serializadores DRF para Dimension.
Aplica el principio de separación estricta entre serializers de entrada y salida:
- Input serializers: validación de payloads POST/PUT/PATCH.
- Output serializers: representación optimizada sin N+1 queries.
"""

from rest_framework import serializers
from apps.guios.models import Dimension, Factor


# ── Serializadores de Salida (Output) ────────────────────────────────────────

class FactorSummarySerializer(serializers.ModelSerializer):
    """Resumen liviano de factores para la vista de detalle de Dimensión."""

    class Meta:
        model = Factor
        fields = [
            'id',
            'name',
            'scope',
            'scope_configurable',
            'systemic_importance',
            'expert_importance',
            'literature_importance_base',
            'order',
            'is_active',
        ]
        read_only_fields = fields


class DimensionListSerializer(serializers.ModelSerializer):
    """
    Serializador liviano para listados de dimensiones.
    Utiliza el campo anotado 'factors_count' del selector para evitar N+1.
    """
    factors_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Dimension
        fields = [
            'id',
            'name',
            'description',
            'order',
            'is_base',
            'factors_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class DimensionDetailSerializer(serializers.ModelSerializer):
    """
    Serializador detallado para una dimensión individual.
    Incluye la lista de factores activos asociados pre-cargados con Prefetch.
    """
    factors_count = serializers.IntegerField(read_only=True, default=0)
    factors = FactorSummarySerializer(
        source='active_factors',
        many=True,
        read_only=True,
    )

    class Meta:
        model = Dimension
        fields = [
            'id',
            'name',
            'description',
            'order',
            'is_base',
            'factors_count',
            'factors',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


# ── Serializadores de Entrada (Input) ────────────────────────────────────────

class DimensionCreateInputSerializer(serializers.Serializer):
    """Valida los datos recibidos en la creación (POST)."""
    name = serializers.CharField(
        max_length=150,
        required=True,
        trim_whitespace=True,
        error_messages={
            'required': 'El nombre de la dimensión es obligatorio.',
            'blank': 'El nombre de la dimensión no puede estar vacío.',
            'max_length': 'El nombre no puede exceder los 150 caracteres.',
        }
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        trim_whitespace=True,
    )
    order = serializers.IntegerField(
        required=False,
        min_value=0,
        default=0,
    )


class DimensionUpdateInputSerializer(serializers.Serializer):
    """Valida los datos recibidos en la actualización (PUT/PATCH)."""
    name = serializers.CharField(
        max_length=150,
        required=False,
        trim_whitespace=True,
        error_messages={
            'blank': 'El nombre de la dimensión no puede estar vacío.',
            'max_length': 'El nombre no puede exceder los 150 caracteres.',
        }
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    order = serializers.IntegerField(
        required=False,
        min_value=0,
    )
