"""
apps/guios/api/views/dimension_views.py
─────────────────────────────────────────────────────────────────────────────
ViewSet para la gestión del CRUD de Dimensiones (Catálogo Maestro GUIOS).
Sigue el patrón arquitectónico Selector -> Service -> ViewSet:
- No ejecuta queries ORM directamente (delega a selectors).
- No contiene lógica de negocio (delega a services).
- Métodos concisos con responsabilidad única (SRP).
"""

from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from apps.guios.selectors.dimension import (
    get_dimensions_queryset,
    get_dimension_or_error,
)
from apps.guios.services.dimension import (
    create_dimension,
    update_dimension,
    delete_dimension,
)
from apps.guios.exceptions import (
    DimensionNotFoundError,
    DimensionAlreadyExistsError,
    DimensionCannotBeDeletedError,
)
from ..serializers.dimension_serializers import (
    DimensionListSerializer,
    DimensionDetailSerializer,
    DimensionCreateInputSerializer,
    DimensionUpdateInputSerializer,
)


class DimensionViewSet(viewsets.GenericViewSet):
    """
    CRUD completo para el catálogo de Dimensiones de la metodología GUIOS.
    Permite listar, consultar detalle, crear, actualizar y eliminar dimensiones.
    """
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': 'guios.dimension_view',
        'retrieve': 'guios.dimension_view',
        'create': 'guios.dimension_create',
        'update': 'guios.dimension_edit',
        'partial_update': 'guios.dimension_edit',
        'destroy': 'guios.dimension_delete',
    }

    def get_queryset(self):
        search = self.request.query_params.get('search')
        is_base = self.request.query_params.get('is_base')
        is_base_bool = None
        if is_base is not None:
            is_base_bool = is_base.lower() in ('true', '1', 'yes')

        return get_dimensions_queryset(search=search, is_base=is_base_bool)

    def list(self, request):
        """GET /api/v1/guios/dimensions/ - Listado optimizado con conteo de factores."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = DimensionListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = DimensionListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        """GET /api/v1/guios/dimensions/{id}/ - Detalle de dimensión con factores activos."""
        try:
            dimension = get_dimension_or_error(pk)
        except DimensionNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = DimensionDetailSerializer(dimension)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request):
        """POST /api/v1/guios/dimensions/ - Creación de nueva dimensión."""
        serializer = DimensionCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            dimension = create_dimension(**serializer.validated_data)
        except DimensionAlreadyExistsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Cargar con anotaciones para la respuesta
        detailed_dim = get_dimension_or_error(dimension.id)
        return Response(DimensionDetailSerializer(detailed_dim).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        """PUT /api/v1/guios/dimensions/{id}/ - Actualización total."""
        return self._perform_update(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        """PATCH /api/v1/guios/dimensions/{id}/ - Actualización parcial."""
        return self._perform_update(request, pk, partial=True)

    def _perform_update(self, request, pk, partial: bool):
        serializer = DimensionUpdateInputSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        try:
            dimension = update_dimension(dimension_id=pk, **serializer.validated_data)
        except DimensionNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except DimensionAlreadyExistsError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed_dim = get_dimension_or_error(dimension.id)
        return Response(DimensionDetailSerializer(detailed_dim).data, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """DELETE /api/v1/guios/dimensions/{id}/ - Eliminación con validación de reglas de negocio."""
        try:
            delete_dimension(dimension_id=pk)
        except DimensionNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except DimensionCannotBeDeletedError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)
