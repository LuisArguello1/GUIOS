from django.db.models import Prefetch
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

    def list(self, request):
        """
        GET /api/v1/core/menu/
        
        Obtiene las categorías y módulos permitidos para el usuario actual.
        Soporta filtrado por role_id vía query param o header X-Role-Id.
        """
        role_id = request.query_params.get('role_id') or request.headers.get('X-Role-Id')
        menu_tree = get_menu_tree_for_user(request.user, role_id=role_id)
        serializer = MenuGroupSerializer(menu_tree, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

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
