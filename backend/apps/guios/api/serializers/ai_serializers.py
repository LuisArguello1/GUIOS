from rest_framework import serializers


class AIStatusSerializer(serializers.Serializer):
    available = serializers.BooleanField(help_text="Falso si el servidor no tiene clave de IA.")


class ImportanceSuggestionSerializer(serializers.Serializer):
    factor_id = serializers.IntegerField()
    suggested_value = serializers.IntegerField(help_text="ID sugerida (1-4). No se guarda como ID.")
    justification = serializers.CharField()


class RatingSuggestionSerializer(serializers.Serializer):
    subfactor_id = serializers.IntegerField()
    suggested_value = serializers.IntegerField(help_text="Calificación sugerida (1-4). No se guarda como calificación.")
    justification = serializers.CharField()


class ImportanceSuggestionsSerializer(serializers.Serializer):
    suggestions = ImportanceSuggestionSerializer(many=True)

    @staticmethod
    def payload(suggestions):
        return {'suggestions': [
            {'factor_id': key, 'suggested_value': value, 'justification': text}
            for key, (value, text) in suggestions.items()
        ]}


class RatingSuggestionsSerializer(serializers.Serializer):
    factor_id = serializers.IntegerField()
    suggestions = RatingSuggestionSerializer(many=True)

    @staticmethod
    def payload(factor_id, suggestions):
        return {'factor_id': factor_id, 'suggestions': [
            {'subfactor_id': key, 'suggested_value': value, 'justification': text}
            for key, (value, text) in suggestions.items()
        ]}


class AIReportSerializer(serializers.Serializer):
    executive_summary = serializers.CharField(source='ai_executive_summary')
    mitigation_plan = serializers.CharField(source='ai_mitigation_plan', help_text="Vacío si el dictamen es A.")
