from rest_framework import serializers
from ...models.organization import Organization
from ...utils.document_validation import valida_ruc


class OrganizationSerializer(serializers.ModelSerializer):
    """
    Serializador principal de Organización.
    Integra de forma anidada las preferencias de Sidebar.
    """
    sidebar_preferences = serializers.SerializerMethodField()
    
    # Avoid running model-level RUC validator for blank input during partial updates.
    ruc = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=13)
    logo = serializers.ImageField(required=False, allow_null=True)
    clear_logo = serializers.BooleanField(required=False, write_only=True, default=False)

    def get_sidebar_preferences(self, obj) -> dict:
        return {
            'is_collapsed': False,
            'theme': 'dark',
        }

    def validate_ruc(self, value):
        if value in (None, ''):
            return None
        valida_ruc(value)
        return value

    def validate_logo(self, value):
        from django.core.files.uploadedfile import UploadedFile
        if value and isinstance(value, UploadedFile):
            from apps.core.utils.image_processing import process_image_to_webp
            processed = process_image_to_webp(value)
            return processed or value
        return value

    def validate(self, attrs):
        for field in ('address', 'phone', 'email', 'slogan'):
            value = attrs.get(field)
            if isinstance(value, str):
                normalized = value.strip()
                attrs[field] = normalized or None

        clear_logo = attrs.get('clear_logo', False)
        if clear_logo and 'logo' not in attrs:
            attrs['logo'] = None
        return attrs

    class Meta:
        model = Organization
        fields = (
            'id',
            'name',
            'ruc',
            'address',
            'phone',
            'email',
            'logo',
            'clear_logo',
            'slogan',
            'sidebar_preferences',
            'updated_at',
        )
