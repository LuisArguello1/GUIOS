from typing import Any

from django.utils.text import capfirst
from rest_framework import serializers

from ...models.audit import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    """Serializador para los logs de auditoría."""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    field_labels = serializers.SerializerMethodField()
    before_display = serializers.SerializerMethodField()
    after_display = serializers.SerializerMethodField()
    changed_fields_display = serializers.SerializerMethodField()
    deleted_snapshot_display = serializers.SerializerMethodField()

    def _humanize_key(self, key: str) -> str:
        normalized = key.strip().replace('_', ' ')
        if not normalized:
            return key
        return capfirst(normalized)

    def _get_field_labels(self, obj: AuditLog) -> dict[str, str]:
        cache = self.context.setdefault('_audit_field_labels_cache', {})
        cache_key = obj.content_type_id or -1

        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        labels: dict[str, str] = {'id': 'ID'}
        model_class = obj.content_type.model_class() if obj.content_type else None
        if model_class is not None:
            for field in model_class._meta.get_fields():
                if field.auto_created and not field.concrete:
                    continue

                verbose_name = str(getattr(field, 'verbose_name', '') or '').strip()
                if not verbose_name:
                    continue

                label = capfirst(verbose_name)

                field_name = getattr(field, 'name', None)
                if field_name:
                    labels[field_name] = label

                attname = getattr(field, 'attname', None)
                if attname:
                    labels[attname] = label

        cache[cache_key] = labels
        return labels

    def _translate_payload(self, payload: Any, labels: dict[str, str]) -> Any:
        if isinstance(payload, list):
            return [self._translate_payload(item, labels) for item in payload]

        if not isinstance(payload, dict):
            return payload

        translated: dict[str, Any] = {}
        for raw_key, raw_value in payload.items():
            key_text = str(raw_key)
            display_key = labels.get(key_text) or self._humanize_key(key_text)

            if display_key in translated:
                display_key = f"{display_key} ({key_text})"

            translated[display_key] = self._translate_payload(raw_value, labels)

        return translated

    def get_field_labels(self, obj: AuditLog) -> dict[str, str]:
        return self._get_field_labels(obj)

    def get_before_display(self, obj: AuditLog) -> Any:
        if not obj.before:
            return None
        return self._translate_payload(obj.before, self._get_field_labels(obj))

    def get_after_display(self, obj: AuditLog) -> Any:
        if not obj.after:
            return None
        return self._translate_payload(obj.after, self._get_field_labels(obj))

    def get_deleted_snapshot_display(self, obj: AuditLog) -> Any:
        if not obj.deleted_snapshot:
            return None
        return self._translate_payload(obj.deleted_snapshot, self._get_field_labels(obj))

    def get_changed_fields_display(self, obj: AuditLog) -> list[str]:
        labels = self._get_field_labels(obj)
        return [labels.get(field, self._humanize_key(field)) for field in (obj.changed_fields or [])]
    
    class Meta:
        model = AuditLog
        fields = (
            'id',
            'action',
            'action_display',
            'source',
            'source_display',
            'model_name',
            'object_id',
            'user',
            'user_email',
            'field_labels',
            'before',
            'before_display',
            'after',
            'after_display',
            'changed_fields',
            'changed_fields_display',
            'deleted_snapshot',
            'deleted_snapshot_display',
            'ip_address',
            'request_id',
            'timestamp'
        )
        read_only_fields = fields
