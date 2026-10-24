from django.db.models import Prefetch
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from ..serializers.menu_serializers import MenuGroupSerializer
from ...selectors.menu import get_menu_tree_for_user, get_full_active_menu_tree

class MenuViewSet(viewsets.ViewSet):
    """
    ViewSet para la navegación dinámica del sistema.
    Retorna el árbol de menús (SideBar) personalizado según los roles del usuario.
    """
    # Protegido por los permisos granulares globales
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]

    @extend_schema(tags=['Menú'], summary="Menú del usuario actual", request=None, responses=MenuGroupSerializer(many=True))
    def list(self, request):
        """
        GET /api/v1/core/menu/
        
        Obtiene las categorías y módulos permitidos para el usuario actual.
        """
        menu_tree = get_menu_tree_for_user(request.user)
        serializer = MenuGroupSerializer(menu_tree, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(tags=['Menú'], summary="Árbol completo del menú activo", request=None, responses=MenuGroupSerializer(many=True))
    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request):
        """
        GET /api/v1/core/menu/tree/

        Devuelve todas las categorías y módulos activos (sin filtrar por roles).
        Útil para pantallas de configuración/permisos.
        """
        menu_tree = get_full_active_menu_tree()

        serializer = MenuGroupSerializer(menu_tree, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
