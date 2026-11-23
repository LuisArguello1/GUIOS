from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ..permissions import HasModulePermission
from ..serializers.user_serializers import (
    UserListSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserSelfUpdateSerializer,
    UserUpdateSerializer,
)
from ...selectors.user import get_users_list
from ...services.user import (
    user_create,
    user_update,
    user_update_profile,
    user_delete_logic,
    toggle_user_active,
)


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de usuarios.
    Protegido por permisos granulares (read/modify/delete) con bypass para Staff.
    """
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': 'users.view',
        'retrieve': 'users.view',
        'create': 'users.create',
        'update': 'users.edit',
        'partial_update': 'users.edit',
        'destroy': 'users.deactivate',
        'toggle_active': 'users.deactivate',
        'me': None,
        'change_password': None,
        'selectors': None,
    }
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['email', 'username', 'first_name', 'last_name', 'phone']
    ordering_fields = ['email', 'created_at', 'is_active']
    ordering = ['-created_at']

    def get_queryset(self):
        search = self.request.query_params.get('search')
        
        # Permitir interactuar con usuarios inactivos en acciones de detalle (getById, toggle, update)
        if self.action != 'list':
            qs = get_users_list(search=search, show_inactive=True)
            return qs.prefetch_related(
                'groups',
                'groups__module_permissions',
                'groups__module_permissions__module',
                'groups__menu_modules',
                'groups__menu_modules__group'
            )
        else:
            show_inactive = self.request.query_params.get('show_inactive', 'false').lower() == 'true'
            qs = get_users_list(search=search, show_inactive=show_inactive)
            return qs.prefetch_related('groups')

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserDetailSerializer

    def perform_create(self, serializer):
        """
        Crea un nuevo usuario validando permisos de asignación de roles.
        """
        data = serializer.validated_data.copy()
        from apps.core.selectors.permissions import user_has_permission
        from rest_framework.exceptions import PermissionDenied

        # Si intenta asignar grupos, validar permiso específico
        if data.get('groups') and not user_has_permission(self.request.user, 'users.assign_roles'):
            raise PermissionDenied("No tienes permiso para asignar roles a nuevos usuarios.")

        password = data.pop('password')
        email = data.pop('email')
        user = user_create(email=email, password=password, **data)
        serializer.instance = user

    def perform_update(self, serializer):
        """
        Actualiza un usuario validando permisos de asignación de roles.
        """
        data = serializer.validated_data.copy()
        from apps.core.selectors.permissions import user_has_permission
        from rest_framework.exceptions import PermissionDenied

        # Si el campo 'groups' viene en la petición, validar permiso
        if 'groups' in data and not user_has_permission(self.request.user, 'users.assign_roles'):
            # Comparar si realmente están cambiando los grupos
            user_obj = self.get_object()
            current_groups = set(user_obj.groups.values_list('id', flat=True))
            new_groups = set(g.id for g in data.get('groups'))
            
            if current_groups != new_groups:
                raise PermissionDenied("No tienes permiso para modificar los roles de este usuario.")

        password = data.pop('password', None)
        user = self.get_object()
        
        requesting_user = self.request.user
        user = user_update(
            user=user,
            allow_superuser_toggle=requesting_user.is_superuser,
            **data
        )
        serializer.instance = user
        
        if password:
            from ...services.user import user_change_password
            user_change_password(user=user, new_password=password)

    def destroy(self, request, *args, **kwargs):
        """Soft/Hard delete según relaciones del usuario."""
        user = self.get_object()

        # Proteger al usuario autenticado de eliminarse a sí mismo
        if user.pk == request.user.pk:
            return Response(
                {'detail': 'No puedes eliminar tu propia cuenta.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        result = user_delete_logic(user=user)
        if result['action'] == 'HARD_DELETE':
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        """
        Activa o desactiva un usuario.

        CORRECCIÓN: se pasa requesting_user al service para que pueda
        validar que un admin no se desactive a sí mismo.
        """
        user = self.get_object()
        try:
            user = toggle_user_active(user=user, requesting_user=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_403_FORBIDDEN)

        return Response({
            'is_active': user.is_active,
            'detail': f'Usuario {"activado" if user.is_active else "desactivado"} correctamente.',
        })

    @action(detail=False, methods=['get', 'patch', 'put'], url_path='me')
    def me(self, request):
        """
        GET/PATCH /api/v1/auth/users/me/
        
        Permite al usuario autenticado ver y editar su propio perfil.
        """
        user = request.user
        if request.method == 'GET':
            serializer = UserDetailSerializer(user, context={'request': request})
            return Response(serializer.data)
        
        # Para PATCH/PUT del perfil propio se usa un serializer restringido.
        serializer = UserSelfUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data.copy()
        password = data.pop('password', None)
        
        user = user_update_profile(user=user, **data)
        
        if password:
            from ...services.user import user_change_password
            user_change_password(user=user, new_password=password)
        
        return Response(UserDetailSerializer(user, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='selectors', permission_classes=[IsAuthenticated])
    def selectors(self, request):
        """
        GET /api/v1/users/selectors/
        Retorna una lista ligera de usuarios activos para selects/dropdowns.
        No requiere permisos de administración, solo estar autenticado.
        """
        users = get_users_list(show_inactive=False).values(
            'id', 'username', 'email', 'first_name', 'last_name'
        )
        return Response(users)

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        """
        POST /api/v1/auth/users/change-password/
        
        Permite al usuario autenticado cambiar su contraseña.
        Requiere old_password, new_password y otp_code (si tiene 2FA).
        Revoca todas las sesiones tras el éxito.
        """
        from ..serializers.user_serializers import ChangePasswordSerializer
        from ...services.user import user_update_password_logic

        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_update_password_logic(
            user=request.user,
            old_password=serializer.validated_data['old_password'],
            new_password=serializer.validated_data['new_password'],
            otp_code=serializer.validated_data.get('otp_code'),
        )

        return Response(
            {"detail": "Contraseña cambiada exitosamente. Todas las sesiones han sido cerradas."},
            status=status.HTTP_200_OK
        )
