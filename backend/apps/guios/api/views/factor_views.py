"""
apps/guios/api/views/factor_views.py
─────────────────────────────────────────────────────────────────────────────
ViewSet para la gestión del CRUD de Factores (Catálogo Maestro GUIOS).
Sigue el patrón arquitectónico Selector -> Service -> ViewSet:
- No ejecuta queries ORM directamente (delega a selectors).
- No contiene lógica de negocio (delega a services).
- Métodos concisos con responsabilidad única (SRP) y control de permisos granulares.
"""

from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from apps.guios.selectors.factor import (
    get_factors_queryset,
    get_factor_or_error,
)
from apps.guios.services.factor import (
    create_factor,
    update_factor,
    delete_factor,
)
from apps.guios.exceptions import (
    DimensionNotFoundError,
    FactorNotFoundError,
    FactorAlreadyExistsError,
    FactorCannotBeDeletedError,
)
from ..serializers.factor_serializers import (
    FactorListSerializer,
    FactorDetailSerializer,
    FactorCreateInputSerializer,
    FactorUpdateInputSerializer,
)


class FactorViewSet(viewsets.GenericViewSet):
    """
    CRUD completo para el catálogo de Factores de la metodología GUIOS.
    Permite listar, consultar detalle con subfactores, crear, actualizar y eliminar factores.
    """
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'list': 'guios.factor_view',
        'retrieve': 'guios.factor_view',
        'create': 'guios.factor_create',
        'update': 'guios.factor_edit',
        'partial_update': 'guios.factor_edit',
        'destroy': 'guios.factor_delete',
    }

    def get_queryset(self):
        search = self.request.query_params.get('search')
        scope = self.request.query_params.get('scope')

        # Filtro por dimensión
        dim_param = self.request.query_params.get('dimension') or self.request.query_params.get('dimension_id')
        dimension_id = None
        if dim_param is not None and dim_param.isdigit():
            dimension_id = int(dim_param)

        # Filtro booleano is_base
        is_base = self.request.query_params.get('is_base')
        is_base_bool = None
        if is_base is not None:
            is_base_bool = is_base.lower() in ('true', '1', 'yes')

        # Filtro booleano is_active
        is_active = self.request.query_params.get('is_active')
        is_active_bool = None
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')

        return get_factors_queryset(
            dimension_id=dimension_id,
            scope=scope,
            is_base=is_base_bool,
            is_active=is_active_bool,
            search=search,
        )

    def list(self, request):
        """GET /api/v1/guios/factors/ - Listado optimizado con dimensión y subfactors_count."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = FactorListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = FactorListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        """GET /api/v1/guios/factors/{id}/ - Detalle de factor con subfactores pre-cargados."""
        try:
            factor = get_factor_or_error(pk)
        except FactorNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = FactorDetailSerializer(factor)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request):
        """POST /api/v1/guios/factors/ - Creación de nuevo factor con autocalculo de IS."""
        serializer = FactorCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            factor = create_factor(**serializer.validated_data)
        except (FactorAlreadyExistsError, DimensionNotFoundError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed_factor = get_factor_or_error(factor.id)
        return Response(FactorDetailSerializer(detailed_factor).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        """PUT /api/v1/guios/factors/{id}/ - Actualización total."""
        return self._perform_update(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        """PATCH /api/v1/guios/factors/{id}/ - Actualización parcial."""
        return self._perform_update(request, pk, partial=True)

    def _perform_update(self, request, pk, partial: bool):
        serializer = FactorUpdateInputSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        try:
            factor = update_factor(factor_id=pk, **serializer.validated_data)
        except FactorNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (FactorAlreadyExistsError, DimensionNotFoundError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed_factor = get_factor_or_error(factor.id)
        return Response(FactorDetailSerializer(detailed_factor).data, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """DELETE /api/v1/guios/factors/{id}/ - Eliminación con validación de reglas de negocio."""
        try:
            delete_factor(factor_id=pk)
        except FactorNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except FactorCannotBeDeletedError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)
