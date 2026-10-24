"""
apps/guios/api/views/subfactor_views.py
─────────────────────────────────────────────────────────────────────────────
ViewSet para la gestión del CRUD de Subfactores (Criterios de 3er nivel GUIOS).
Sigue el patrón arquitectónico Selector -> Service -> ViewSet:
- No ejecuta queries ORM directamente (delega a selectors).
- No contiene lógica de negocio (delega a services).
- Métodos concisos con responsabilidad única (SRP) y control de permisos granulares.
"""

from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from apps.guios.selectors.subfactor import (
    get_subfactors_queryset,
    get_subfactor_or_error,
)
from apps.guios.services.subfactor import (
    create_subfactor,
    update_subfactor,
    delete_subfactor,
)
from apps.guios.exceptions import (
    FactorNotFoundError,
    SubfactorNotFoundError,
    SubfactorAlreadyExistsError,
    SubfactorCannotBeDeletedError,
)
from ..serializers.subfactor_serializers import (
    SubfactorListSerializer,
    SubfactorDetailSerializer,
    SubfactorCreateInputSerializer,
    SubfactorUpdateInputSerializer,
)


class SubfactorViewSet(viewsets.GenericViewSet):
    """
    CRUD completo para los Subfactores de evaluación de la metodología GUIOS.
    Permite listar, consultar detalle, crear, actualizar y eliminar subfactores.
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

        # Filtro por factor
        factor_param = self.request.query_params.get('factor') or self.request.query_params.get('factor_id')
        factor_id = int(factor_param) if factor_param and factor_param.isdigit() else None

        # Filtro por dimensión
        dim_param = self.request.query_params.get('dimension') or self.request.query_params.get('dimension_id')
        dimension_id = int(dim_param) if dim_param and dim_param.isdigit() else None

        # Filtro booleano is_base
        is_base = self.request.query_params.get('is_base')
        is_base_bool = is_base.lower() in ('true', '1', 'yes') if is_base is not None else None

        # Filtro booleano is_active
        is_active = self.request.query_params.get('is_active')
        is_active_bool = is_active.lower() in ('true', '1', 'yes') if is_active is not None else None

        return get_subfactors_queryset(
            factor_id=factor_id,
            dimension_id=dimension_id,
            is_base=is_base_bool,
            is_active=is_active_bool,
            search=search,
        )

    def list(self, request):
        """GET /api/v1/guios/subfactors/ - Listado optimizado con factor y dimensión."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = SubfactorListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = SubfactorListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        """GET /api/v1/guios/subfactors/{id}/ - Detalle de subfactor."""
        try:
            subfactor = get_subfactor_or_error(pk)
        except SubfactorNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubfactorDetailSerializer(subfactor)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request):
        """POST /api/v1/guios/subfactors/ - Creación de nuevo subfactor."""
        serializer = SubfactorCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            subfactor = create_subfactor(**serializer.validated_data)
        except (SubfactorAlreadyExistsError, FactorNotFoundError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed_subfactor = get_subfactor_or_error(subfactor.id)
        return Response(SubfactorDetailSerializer(detailed_subfactor).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        """PUT /api/v1/guios/subfactors/{id}/ - Actualización total."""
        return self._perform_update(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        """PATCH /api/v1/guios/subfactors/{id}/ - Actualización parcial."""
        return self._perform_update(request, pk, partial=True)

    def _perform_update(self, request, pk, partial: bool):
        serializer = SubfactorUpdateInputSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        try:
            subfactor = update_subfactor(subfactor_id=pk, **serializer.validated_data)
        except SubfactorNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except (SubfactorAlreadyExistsError, FactorNotFoundError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detailed_subfactor = get_subfactor_or_error(subfactor.id)
        return Response(SubfactorDetailSerializer(detailed_subfactor).data, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """DELETE /api/v1/guios/subfactors/{id}/ - Eliminación con validación de reglas de negocio."""
        try:
            delete_subfactor(subfactor_id=pk)
        except SubfactorNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except SubfactorCannotBeDeletedError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)
