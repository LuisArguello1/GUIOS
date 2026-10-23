from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth.api.permissions import HasModulePermission

from ...selectors.catalog import admin_dimensions, admin_factors, admin_subfactors, get_admin_catalog_tree
from ...services import catalog as catalog_service
from ..serializers.admin_catalog_serializers import (
    DimensionAdminSerializer,
    DimensionTreeSerializer,
    FactorAdminSerializer,
    SubfactorAdminSerializer,
)

TAGS = ['GUIOS administración: catálogo']
CATALOG_PERMISSIONS = {
    'list': 'catalog.view',
    'retrieve': 'catalog.view',
    'create': 'catalog.create',
    'partial_update': 'catalog.edit',
    'destroy': 'catalog.delete',
}
RULE_RESPONSES = {
    400: OpenApiResponse(description="Datos inválidos o regla del catálogo incumplida (code: catalog_rule)."),
    409: OpenApiResponse(description="Integridad del catálogo: tiene dependencias o es del catálogo base (code: catalog_conflict)."),
}


class CatalogAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    CRUD del catálogo. La lógica (RN-07, is_base, regla de subfactores activos)
    está en services/catalog.py; la vista solo valida y traduce errores.
    """
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_permission = CATALOG_PERMISSIONS
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    create_service = None
    update_service = None
    delete_service = None

    def run(self, operation, *args, **kwargs):
        try:
            return operation(*args, **kwargs), None
        except catalog_service.CatalogConflict as exc:
            return None, Response({'detail': str(exc), 'code': 'catalog_conflict'}, status=status.HTTP_409_CONFLICT)
        except catalog_service.CatalogRuleError as exc:
            return None, Response(
                {'detail': str(exc), 'code': 'catalog_rule', 'field': exc.field}, status=status.HTTP_400_BAD_REQUEST,
            )

    def respond(self, instance, code=status.HTTP_200_OK):
        fresh = self.get_queryset().get(pk=instance.pk)
        return Response(self.get_serializer(fresh).data, status=code)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance, error = self.run(type(self).create_service, **serializer.validated_data)
        return error or self.respond(instance, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        instance, error = self.run(type(self).update_service, instance, **serializer.validated_data)
        return error or self.respond(instance)

    def destroy(self, request, *args, **kwargs):
        _, error = self.run(type(self).delete_service, self.get_object())
        return error or Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(tags=TAGS, summary="Listar dimensiones"),
    retrieve=extend_schema(tags=TAGS, summary="Ver una dimensión"),
    create=extend_schema(tags=TAGS, summary="Crear una dimensión", responses={201: DimensionAdminSerializer, **RULE_RESPONSES}),
    partial_update=extend_schema(tags=TAGS, summary="Editar una dimensión", responses={200: DimensionAdminSerializer, **RULE_RESPONSES}),
    destroy=extend_schema(tags=TAGS, summary="Eliminar una dimensión (sin factores, no base)", responses={204: None, **RULE_RESPONSES}),
)
class DimensionAdminViewSet(CatalogAdminViewSet):
    serializer_class = DimensionAdminSerializer
    pagination_class = None
    create_service = staticmethod(catalog_service.create_dimension)
    update_service = staticmethod(catalog_service.update_dimension)
    delete_service = staticmethod(catalog_service.delete_dimension)

    def get_queryset(self):
        return admin_dimensions()


@extend_schema_view(
    list=extend_schema(tags=TAGS, summary="Listar factores", parameters=[
        OpenApiParameter('dimension', int, description="Filtra por dimensión."),
    ]),
    retrieve=extend_schema(tags=TAGS, summary="Ver un factor"),
    create=extend_schema(tags=TAGS, summary="Crear un factor (nace inactivo)", responses={201: FactorAdminSerializer, **RULE_RESPONSES}),
    partial_update=extend_schema(tags=TAGS, summary="Editar o activar un factor", responses={200: FactorAdminSerializer, **RULE_RESPONSES}),
    destroy=extend_schema(tags=TAGS, summary="Eliminar un factor (sin subfactores ni evaluaciones, no base)", responses={204: None, **RULE_RESPONSES}),
)
class FactorAdminViewSet(CatalogAdminViewSet):
    serializer_class = FactorAdminSerializer
    pagination_class = None
    create_service = staticmethod(catalog_service.create_factor)
    update_service = staticmethod(catalog_service.update_factor)
    delete_service = staticmethod(catalog_service.delete_factor)

    def get_queryset(self):
        queryset = admin_factors()
        dimension = self.request.query_params.get('dimension')
        if dimension and dimension.isdigit():
            queryset = queryset.filter(dimension_id=int(dimension))
        return queryset


@extend_schema_view(
    list=extend_schema(tags=TAGS, summary="Listar subfactores", parameters=[
        OpenApiParameter('factor', int, description="Filtra por factor."),
    ]),
    retrieve=extend_schema(tags=TAGS, summary="Ver un subfactor"),
    create=extend_schema(tags=TAGS, summary="Crear un subfactor", responses={201: SubfactorAdminSerializer, **RULE_RESPONSES}),
    partial_update=extend_schema(tags=TAGS, summary="Editar, mover o desactivar un subfactor", responses={200: SubfactorAdminSerializer, **RULE_RESPONSES}),
    destroy=extend_schema(tags=TAGS, summary="Eliminar un subfactor (sin calificaciones, no base)", responses={204: None, **RULE_RESPONSES}),
)
class SubfactorAdminViewSet(CatalogAdminViewSet):
    serializer_class = SubfactorAdminSerializer
    pagination_class = None
    create_service = staticmethod(catalog_service.create_subfactor)
    update_service = staticmethod(catalog_service.update_subfactor)
    delete_service = staticmethod(catalog_service.delete_subfactor)

    def get_queryset(self):
        queryset = admin_subfactors()
        factor = self.request.query_params.get('factor')
        if factor and factor.isdigit():
            queryset = queryset.filter(factor_id=int(factor))
        return queryset


class CatalogTreeView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_permission = 'catalog.view'

    @extend_schema(
        tags=TAGS, summary="Árbol completo del catálogo",
        description="Dimensión → Factor → Subfactor, incluidos los inactivos, con conteos y can_delete.",
        responses=DimensionTreeSerializer(many=True),
    )
    def get(self, request):
        return Response(DimensionTreeSerializer(get_admin_catalog_tree(), many=True).data)
