from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ...selectors.catalog import get_active_catalog
from ..serializers.catalog_serializers import CatalogSerializer


class PublicGuiosView(APIView):
    """
    Base de la API pública de GUIOS: sin autenticación (una cookie JWT caducada
    no debe provocar 401) y con su propio throttle por IP (GUIOS_PUBLIC_RATE).
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'guios_public'


class PublicCatalogView(PublicGuiosView):
    @extend_schema(
        tags=['GUIOS público'],
        summary="Catálogo activo para evaluar",
        description=(
            "Dimensiones, factores y subfactores activos en el orden del catálogo. "
            "Excluye los factores sin subfactores activos. La IS se muestra como referencia."
        ),
        responses=CatalogSerializer,
    )
    def get(self, request):
        return Response(CatalogSerializer(CatalogSerializer.payload(get_active_catalog())).data)
