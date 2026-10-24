"""
apps/guios/api/views/dashboard_views.py
─────────────────────────────────────────────────────────────────────────────
Controladores DRF para el Dashboard Ejecutivo y Exportación de Reportería.
Responsabilidad única: recibir petición, delegar en Selectors y Generadores,
y retornar respuestas JSON o flujos binarios (PDF/Excel) con permisos RBAC.
"""
from datetime import datetime
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.auth.api.permissions import HasModulePermission
from drf_spectacular.utils import extend_schema
from apps.guios.selectors.dashboard import get_dashboard_statistics
from apps.guios.services.reports import DashboardPDFReport, DashboardExcelReport


@extend_schema(exclude=True)
class DashboardViewSet(viewsets.ViewSet):
    """
    ViewSet para Métricas Ejecutivas del Dashboard y Descarga de Informes.
    Ruta base: /api/v1/guios/dashboard/
    """
    permission_classes = [permissions.IsAuthenticated, HasModulePermission]
    required_permission = {
        'statistics': 'dashboard.view',
        'export_pdf': 'dashboard.export_report',
        'export_excel': 'dashboard.export_report',
    }

    @action(detail=False, methods=['get'], url_path='statistics')
    def statistics(self, request):
        """
        Retorna la matriz consolidada de KPIs, series de datos y tablas analíticas.
        GET /api/v1/guios/dashboard/statistics/
        """
        stats = get_dashboard_statistics()
        return Response(stats, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request):
        """
        Genera y descarga el Reporte Ejecutivo del Dashboard en formato PDF.
        GET /api/v1/guios/dashboard/export-pdf/
        """
        stats = get_dashboard_statistics()
        pdf_buffer = DashboardPDFReport.generate(stats)
        filename = f"Reporte_Dashboard_GUIOS_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"

        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        """
        Genera y descarga el Libro Analítico del Dashboard en formato Excel (.xlsx).
        GET /api/v1/guios/dashboard/export-excel/
        """
        stats = get_dashboard_statistics()
        excel_buffer = DashboardExcelReport.generate(stats)
        filename = f"Reporte_Dashboard_GUIOS_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

        response = HttpResponse(
            excel_buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response
