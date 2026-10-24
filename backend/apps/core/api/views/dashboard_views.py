from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class DashboardView(APIView):
    """
    Vista principal para el dashboard del sistema.
    Retorna estado general y métricas base limpias.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.localtime()
        active_users_count = User.objects.filter(is_active=True).count()

        data = {
            "status": "ok",
            "message": "Dashboard operativo",
            "server_time": now.isoformat(),
            "active_users_count": active_users_count,
        }

        return Response(data, status=status.HTTP_200_OK)


class DashboardExportView(APIView):
    """
    Vista de exportación del dashboard (stub limpio).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({"status": "ok", "detail": "Exportación no requerida."}, status=status.HTTP_200_OK)


class DashboardExportStatusView(APIView):
    """
    Vista de estado de exportación del dashboard (stub limpio).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"status": "SUCCESS"}, status=status.HTTP_200_OK)
