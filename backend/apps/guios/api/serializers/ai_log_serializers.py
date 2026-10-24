"""
apps/guios/api/serializers/ai_log_serializers.py
───────────────────────────────────────────────────────────────────────────────
Serializadores DRF para consulta y auditoría de logs de Inteligencia Artificial (GUIOS).
Separación estricta entre serializers de listado y de detalle (con payloads completos).
"""
from rest_framework import serializers
from apps.guios.models.ai_log import AIAssistanceLog


class AILogListOutputSerializer(serializers.ModelSerializer):
    """
    Representación liviana para tablas de auditoría y grillas de logs de IA.
    """
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    software_name = serializers.CharField(source='evaluation.software_name', read_only=True)
    org_name = serializers.CharField(source='evaluation.org_name', read_only=True)
    factor_name = serializers.CharField(source='factor.name', default=None, read_only=True)

    class Meta:
        model = AIAssistanceLog
        fields = [
            'id',
            'evaluation_id',
            'software_name',
            'org_name',
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


class AILogDetailOutputSerializer(serializers.ModelSerializer):
    """
    Representación detallada para inspección técnica forense del log de IA:
    incluye payload JSON enviado y respuesta devuelta por el LLM/fallback.
    """
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    software_name = serializers.CharField(source='evaluation.software_name', read_only=True)
    org_name = serializers.CharField(source='evaluation.org_name', read_only=True)
    factor_name = serializers.CharField(source='factor.name', default=None, read_only=True)

    class Meta:
        model = AIAssistanceLog
        fields = [
            'id',
            'evaluation_id',
            'software_name',
            'org_name',
            'request_type',
            'request_type_display',
            'factor_id',
            'factor_name',
            'request_payload',
            'response_payload',
            'status',
            'status_display',
            'error_message',
            'response_time_ms',
            'requested_at',
        ]
        read_only_fields = fields
