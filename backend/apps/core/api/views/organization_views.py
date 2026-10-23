from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from ..serializers.organization_serializers import OrganizationSerializer
from ...selectors.organization import get_organization_with_preferences
from ...services.organization import update_organization_data


class OrganizationViewSet(viewsets.ViewSet):
    """
    ViewSet para la gestión de la organización y configuración global.
    Sigue el patrón Singleton: Solo existe una instancia.
    """
    
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': ['settings.manage', 'settings.org_view'],
        'update_data': ['settings.manage', 'settings.org_manage'],
    }

    def get_permissions(self):
        """
        Permite que la acción de list (usada en el login) sea pública.
        Las demás acciones siguen requiriendo autenticación y permisos granulares.
        """
        if self.action == 'list':
            return [permissions.AllowAny()]
        return [permission() for permission in self.permission_classes]

    @extend_schema(tags=['Organización'], summary="Datos de la organización (público)", request=None, responses=OrganizationSerializer)
    def list(self, request):
        """
        GET /api/v1/core/organization/
        
        Obtiene la configuración única de la empresa.
        """
        organization = get_organization_with_preferences()
        serializer = OrganizationSerializer(organization, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(tags=['Organización'], summary="Actualizar la organización", request=OrganizationSerializer, responses=OrganizationSerializer)
    @action(detail=False, methods=['patch'], url_path='update')
    def update_data(self, request):
        organization = get_organization_with_preferences()
        user = request.user

        from apps.core.selectors.permissions import user_has_permission
        has_admin_perms = (
            user.is_superuser or
            user_has_permission(user, 'settings.manage') or
            user_has_permission(user, 'settings.org_manage')
        )

        if not has_admin_perms:
            serializer = OrganizationSerializer(organization, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = OrganizationSerializer(
            organization,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data.copy()
        clear_logo = bool(validated_data.pop('clear_logo', False))
        if clear_logo and 'logo' not in validated_data:
            validated_data['logo'] = None

        updated_org = update_organization_data(
            organization,
            **validated_data,
        )
        
        serializer = OrganizationSerializer(updated_org, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
