from rest_framework import serializers

from ...models import Dimension, Factor, Subfactor
from ..fields import PlainTextField


class DimensionAdminSerializer(serializers.ModelSerializer):
    name = PlainTextField(max_length=150)
    description = PlainTextField(required=False, allow_blank=True)
    factors_count = serializers.IntegerField(read_only=True, default=0)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Dimension
        fields = ['id', 'code', 'name', 'description', 'order', 'is_base', 'factors_count', 'can_delete',
                  'created_at', 'updated_at']
        read_only_fields = ['code', 'is_base', 'created_at', 'updated_at']

    def get_can_delete(self, obj) -> bool:
        return not obj.is_base and not getattr(obj, 'factors_count', 0)


class FactorAdminSerializer(serializers.ModelSerializer):
    name = PlainTextField(max_length=200)
    description = PlainTextField(required=False, allow_blank=True)
    scope = serializers.ChoiceField(
        choices=Factor.SCOPE_CHOICES,
        help_text="internal, external o both. 'both' = ámbito configurable por el evaluador.",
    )
    subfactors_count = serializers.IntegerField(read_only=True, default=0)
    active_subfactors_count = serializers.IntegerField(read_only=True, default=0)
    evaluations_count = serializers.IntegerField(read_only=True, default=0)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Factor
        fields = ['id', 'code', 'dimension', 'name', 'description', 'suggested_importance', 'scope',
                  'scope_configurable', 'order', 'is_base', 'is_active', 'subfactors_count',
                  'active_subfactors_count', 'evaluations_count', 'can_delete', 'created_at', 'updated_at']
        read_only_fields = ['code', 'scope_configurable', 'is_base', 'created_at', 'updated_at']
        extra_kwargs = {
            'is_active': {'help_text': "Al crear se ignora: el factor nace inactivo hasta tener un subfactor activo."},
        }

    def get_can_delete(self, obj) -> bool:
        return (not obj.is_base and not getattr(obj, 'subfactors_count', 0)
                and not getattr(obj, 'evaluations_count', 0))


class SubfactorAdminSerializer(serializers.ModelSerializer):
    description = PlainTextField()
    evaluations_count = serializers.IntegerField(read_only=True, default=0)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Subfactor
        fields = ['id', 'code', 'factor', 'description', 'order', 'is_base', 'is_active',
                  'evaluations_count', 'can_delete', 'created_at', 'updated_at']
        read_only_fields = ['code', 'is_base', 'created_at', 'updated_at']

    def get_can_delete(self, obj) -> bool:
        return not obj.is_base and not getattr(obj, 'evaluations_count', 0)


class SubfactorTreeSerializer(SubfactorAdminSerializer):
    class Meta(SubfactorAdminSerializer.Meta):
        fields = [f for f in SubfactorAdminSerializer.Meta.fields if f != 'factor']


class FactorTreeSerializer(FactorAdminSerializer):
    subfactors = SubfactorTreeSerializer(many=True, source='admin_subfactors', read_only=True)

    class Meta(FactorAdminSerializer.Meta):
        fields = [f for f in FactorAdminSerializer.Meta.fields if f != 'dimension'] + ['subfactors']


class DimensionTreeSerializer(DimensionAdminSerializer):
    factors = FactorTreeSerializer(many=True, source='admin_factors', read_only=True)

    class Meta(DimensionAdminSerializer.Meta):
        fields = DimensionAdminSerializer.Meta.fields + ['factors']
