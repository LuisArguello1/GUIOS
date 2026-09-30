from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.text import capfirst
from ..serializers.audit_serializers import AuditLogSerializer
from ...selectors.audit import get_audit_logs, get_audit_log_detail

from apps.auth.api.permissions import HasModulePermission

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para la consulta de logs de auditoría (Solo lectura).
    """
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': 'audit.view',
        'retrieve': 'audit.view',
        'models': 'audit.view',
    }
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        search = self.request.query_params.get('search', None)
        model_name = self.request.query_params.get('model_name', None)
        user_id = self.request.query_params.get('user_id', None)
        
        return get_audit_logs(
            search=search, 
            model_name=model_name, 
            user_id=user_id
        )

    @action(detail=False, methods=['get'])
    def models(self, request):
        """Devuelve modelos auditables con etiquetas legibles para UI."""
        from django.apps import apps
        from ...signals import IGNORED_MODELS

        options_by_value: dict[str, str] = {}
        for model in apps.get_models():
            if model.__name__ in IGNORED_MODELS:
                continue

            # model_name se mantiene como value para compatibilidad con filtros.
            value = model._meta.model_name
            if value in options_by_value:
                continue

            verbose_plural = str(model._meta.verbose_name_plural or '').strip()
            verbose_single = str(model._meta.verbose_name or '').strip()
            label_source = verbose_plural or verbose_single or value.replace('_', ' ')
            options_by_value[value] = capfirst(label_source)

        options = [
            {'value': value, 'label': label}
            for value, label in options_by_value.items()
        ]
        options.sort(key=lambda option: option['label'].lower())

        return Response(options)

    def get_object(self):
        pk = self.kwargs.get('pk')
        return get_audit_log_detail(pk=pk)
