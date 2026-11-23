"""
apps/guios/test/test_dashboard_and_reports.py
─────────────────────────────────────────────────────────────────────────────
Suite de pruebas de integración para el Dashboard Ejecutivo y Exportaciones (PDF/Excel).
Verifica:
1. Endpoint de estadísticas consolidadas del Dashboard (KPIs, distribuciones, series).
2. Generación y descarga binaria de PDF del Dashboard (Content-Type, cabeceras, formato).
3. Generación y descarga binaria de Excel del Dashboard (OpenXML, hojas de cálculo).
4. Exportación en PDF del Dossier Técnico de Evaluación individual.
5. Exportación en Excel de la Evaluación individual.
6. Manejo de error 404 al exportar evaluaciones inexistentes.
7. Control de permisos RBAC granulares (401 anon, 403 sin permiso, 200 con permiso).
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models.menuGroup import MenuGroup
from apps.core.models.menuModule import MenuModule
from apps.core.models.modulePermission import ModulePermission
from apps.guios.models import (
    Dimension,
    Factor,
    Subfactor,
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
)

User = get_user_model()


class DashboardAndReportsAPITests(APITestCase):
    """
    Pruebas para los endpoints de Dashboard y Reportería PDF/Excel.
    """

    def setUp(self):
        # 1. Superuser para pruebas de funcionalidad completa
        self.admin_user = User.objects.create_superuser(
            email="dashboard_admin@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Admin",
            last_name="GUIOS",
        )
        self.client.force_authenticate(user=self.admin_user)

        # 2. Endpoints
        self.stats_url = "/api/v1/guios/dashboard/statistics/"
        self.dash_pdf_url = "/api/v1/guios/dashboard/export-pdf/"
        self.dash_excel_url = "/api/v1/guios/dashboard/export-excel/"
        self.eval_base_url = "/api/v1/guios/evaluations/"

        # 3. Datos de prueba: Dimensión, Factor, Subfactor
        self.dimension = Dimension.objects.create(
            name="Dimensión Tecnológica",
            description="Evaluación de aspectos tecnológicos del software.",
            order=1,
        )
        self.factor = Factor.objects.create(
            dimension=self.dimension,
            name="Arquitectura",
            systemic_importance=3,
            order=1,
        )
        self.subfactor = Subfactor.objects.create(
            factor=self.factor,
            description="Capacidad de crecimiento horizontal y vertical",
            order=1,
        )

        # 4. Crear Evaluación completada con veredicto institucional
        self.evaluation = Evaluation.objects.create(
            software_name="PostgreSQL Database",
            software_category="Bases de Datos",
            software_version="16.2",
            software_description="Sistema de gestión de bases de datos relacional y extensible.",
            org_name="Universidad Estatal de Milagro",
            org_sector="Educación Superior",
            org_description="Evaluación técnica para infraestructura crítica.",
            status=Evaluation.STATUS_COMPLETED,
            created_by=self.admin_user,
        )

        self.ef = EvaluationFactor.objects.create(
            evaluation=self.evaluation,
            factor=self.factor,
            systemic_importance_snapshot=3,
            subfactors_count_snapshot=1,
            decisor_importance=3,
            relative_importance=3,
            is_relevant=True,
            citation_ratio=Decimal("1.5000"),
            citations_count=3,
        )

        self.es = EvaluationSubfactor.objects.create(
            evaluation=self.evaluation,
            subfactor=self.subfactor,
            description_snapshot=self.subfactor.description,
            rating=4,
        )

        self.er = EvaluationResult.objects.create(
            evaluation=self.evaluation,
            factor=self.factor,
            weighted_average=Decimal("4.00"),
            meets_threshold=True,
            foda_classification=EvaluationResult.FODA_STRENGTH,
        )

        self.ev = EvaluationVerdict.objects.create(
            evaluation=self.evaluation,
            recommendation=EvaluationVerdict.RECOMMENDATION_A,
            explanation_text="El software cumple con los criterios de adopción metodológica GUIOS sin observaciones.",
            ai_executive_summary="Alta escalabilidad, robustez y madurez comunitaria.",
            ai_mitigation_plan="Implementar monitor de métricas y réplicas en standby.",
        )

    # ── 1. Pruebas de Estadísticas del Dashboard ──────────────────────────────

    def test_dashboard_statistics_returns_200_and_expected_structure(self):
        """El endpoint /statistics/ retorna la matriz analítica consolidada."""
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn("kpis", data)
        self.assertIn("verdict_distribution", data)
        self.assertIn("dimension_averages", data)
        self.assertIn("foda_distribution", data)
        self.assertIn("top_software", data)
        self.assertIn("recent_evaluations", data)

        kpis = data["kpis"]
        self.assertEqual(kpis["total_evaluations"], 1)
        self.assertEqual(kpis["completed_evaluations"], 1)
        self.assertEqual(kpis["in_progress_evaluations"], 0)
        self.assertEqual(kpis["adoption_viability_rate"], 100.0)

        # Verificar lista de top software
        self.assertEqual(len(data["top_software"]), 1)
        top = data["top_software"][0]
        self.assertEqual(top["software_name"], "PostgreSQL Database")
        self.assertEqual(top["recommendation"], EvaluationVerdict.RECOMMENDATION_A)

    # ── 2. Pruebas de Exportación de Dashboard en PDF ─────────────────────────

    def test_dashboard_export_pdf_success(self):
        """El endpoint /export-pdf/ retorna un binario PDF válido con cabeceras correctas."""
        response = self.client.get(self.dash_pdf_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        self.assertTrue(response["Content-Disposition"].endswith('.pdf"'))

        content = response.content
        self.assertTrue(content.startswith(b"%PDF-"), "El contenido debe comenzar con el magic byte de PDF (%PDF-)")
        self.assertGreater(len(content), 1000, "El documento PDF debe contener datos")

    # ── 3. Pruebas de Exportación de Dashboard en Excel ───────────────────────

    def test_dashboard_export_excel_success(self):
        """El endpoint /export-excel/ retorna un libro Excel .xlsx válido."""
        response = self.client.get(self.dash_excel_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        self.assertTrue(response["Content-Disposition"].endswith('.xlsx"'))

        content = response.content
        # Los archivos OpenXML / XLSX son ZIPs y empiezan con PK (0x50 0x4B)
        self.assertTrue(content.startswith(b"PK"), "El contenido debe ser un archivo ZIP/XLSX válido")
        self.assertGreater(len(content), 2000, "El libro Excel debe contener bytes válidos")

    # ── 4. Pruebas de Exportación de Evaluación Individual en PDF ─────────────

    def test_evaluation_export_pdf_success(self):
        """El endpoint /evaluations/{id}/export-pdf/ genera el dossier técnico oficial."""
        url = f"{self.eval_base_url}{self.evaluation.id}/export-pdf/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("Evaluacion_GUIOS_PostgreSQLDatabase", response["Content-Disposition"])

        content = response.content
        self.assertTrue(content.startswith(b"%PDF-"))
        self.assertGreater(len(content), 2000)

    def test_evaluation_export_pdf_not_found_returns_404(self):
        """Exportar una evaluación inexistente en PDF retorna 404."""
        url = f"{self.eval_base_url}999999/export-pdf/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── 5. Pruebas de Exportación de Evaluación Individual en Excel ───────────

    def test_evaluation_export_excel_success(self):
        """El endpoint /evaluations/{id}/export-excel/ genera el libro de evaluación."""
        url = f"{self.eval_base_url}{self.evaluation.id}/export-excel/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn("Evaluacion_GUIOS_PostgreSQLDatabase", response["Content-Disposition"])

        content = response.content
        self.assertTrue(content.startswith(b"PK"))
        self.assertGreater(len(content), 2000)

    def test_evaluation_export_excel_not_found_returns_404(self):
        """Exportar una evaluación inexistente en Excel retorna 404."""
        url = f"{self.eval_base_url}999999/export-excel/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_editorial_pdf_and_excel_handle_gaps_mitigation_and_xml_chars(self):
        """PDF y Excel generan sin errores con brechas <3.00, 4 cuadrantes FODA y caracteres & < >."""
        from apps.guios.services.reports import EvaluationExcelReport, EvaluationPDFReport

        dim2 = Dimension.objects.create(
            name="Dimensión Organizacional",
            description="Capacidad institucional y operativa.",
            order=2,
        )
        factor_weak = Factor.objects.create(
            dimension=dim2,
            name="Soporte & Gobernanza <TI>",
            systemic_importance=4,
            scope=Factor.SCOPE_INTERNAL,
            order=1,
        )
        factor_threat = Factor.objects.create(
            dimension=dim2,
            name="Comunidad Externa",
            systemic_importance=3,
            scope=Factor.SCOPE_EXTERNAL,
            order=2,
        )
        sf_weak = Subfactor.objects.create(
            factor=factor_weak,
            description="Disponibilidad de SLA < 24h & documentación.",
            order=1,
        )
        ev_c = Evaluation.objects.create(
            software_name="Odoo R&D <Suite>",
            software_category="ERP & Gestión",
            software_version="17.0",
            software_description="Plataforma modular con flujo <automatizado> & extensible.",
            org_name="Empresa & Servicios TI",
            org_sector="Tecnología",
            org_description="Reemplazo de ERP legado & consolidación financiera.",
            status=Evaluation.STATUS_COMPLETED,
            q1_threshold=Decimal("0.2500"),
            q2_threshold=Decimal("0.5000"),
            q3_threshold=Decimal("1.0000"),
            q4_threshold=Decimal("2.0000"),
            created_by=self.admin_user,
        )
        EvaluationFactor.objects.create(
            evaluation=ev_c,
            factor=self.factor,
            systemic_importance_snapshot=3,
            subfactors_count_snapshot=1,
            decisor_importance=4,
            relative_importance=4,
            is_relevant=True,
            citations_count=2,
            citation_ratio=Decimal("2.0000"),
            literature_importance_calculated=4,
            ai_literature_sources=[
                {
                    "doi": "10.1145/1234567.89",
                    "title": "Architecture & Resilience in Open ERP Systems",
                    "url": "https://doi.org/10.1145/1234567.89",
                    "snippet": "Análisis de escalabilidad <10ms> y alta disponibilidad.",
                }
            ],
        )
        EvaluationFactor.objects.create(
            evaluation=ev_c,
            factor=factor_weak,
            systemic_importance_snapshot=4,
            subfactors_count_snapshot=1,
            decisor_importance=4,
            relative_importance=4,
            is_relevant=True,
        )
        EvaluationFactor.objects.create(
            evaluation=ev_c,
            factor=factor_threat,
            systemic_importance_snapshot=3,
            subfactors_count_snapshot=1,
            decisor_importance=2,
            relative_importance=2,
            is_relevant=True,
        )
        EvaluationSubfactor.objects.create(
            evaluation=ev_c,
            subfactor=sf_weak,
            description_snapshot=sf_weak.description,
            rating=2,
            ai_citations_count=1,
        )
        EvaluationResult.objects.create(
            evaluation=ev_c,
            factor=self.factor,
            weighted_average=Decimal("3.60"),
            meets_threshold=True,
            foda_classification=EvaluationResult.FODA_STRENGTH,
        )
        EvaluationResult.objects.create(
            evaluation=ev_c,
            factor=factor_weak,
            weighted_average=Decimal("2.00"),
            meets_threshold=False,
            foda_classification=EvaluationResult.FODA_WEAKNESS,
        )
        EvaluationResult.objects.create(
            evaluation=ev_c,
            factor=factor_threat,
            weighted_average=Decimal("2.40"),
            meets_threshold=False,
            foda_classification=EvaluationResult.FODA_THREAT,
        )
        EvaluationVerdict.objects.create(
            evaluation=ev_c,
            recommendation=EvaluationVerdict.RECOMMENDATION_C,
            explanation_text="Existen factores críticos bajo umbral 3.00.",
            ai_executive_summary=(
                "## Conclusión\n\n"
                "Se recomienda posponer la adopción de **Odoo R&D** hasta cerrar brechas de soporte.\n\n"
                "- **Sostiene:** Arquitectura supera el umbral (PM 3.60).\n"
                "- **Condiciona:** Soporte & Gobernanza queda en PM 2.00."
            ),
            ai_mitigation_plan=(
                "### Soporte & Gobernanza <TI>\n"
                "- **Riesgo Metodológico:** Ausencia de SLA formal <24h.\n"
                "- **Acción Correctiva:** Contratar soporte L2 & definir runbooks.\n"
                "- **Responsable:** Gobernanza Tecnológica\n"
                "- **Meta de Aprobación:** Alcanzar PM >= 3.00 en auditoría piloto."
            ),
        )

        pdf_buf = EvaluationPDFReport.generate(ev_c)
        pdf_bytes = pdf_buf.getvalue()
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        self.assertGreater(len(pdf_bytes), 4000)

        excel_buf = EvaluationExcelReport.generate(ev_c)
        excel_bytes = excel_buf.getvalue()
        self.assertTrue(excel_bytes.startswith(b"PK"))
        self.assertGreater(len(excel_bytes), 3000)

    # ── 6. Pruebas de Permisos RBAC Granulares ────────────────────────────────

    def test_anonymous_user_is_unauthorized(self):
        """Peticiones sin autenticar retornan 401."""
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.stats_url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(self.dash_pdf_url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(self.dash_excel_url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unprivileged_user_cannot_export_dashboard(self):
        """Usuario sin permiso 'dashboard.export_report' recibe 403 Forbidden."""
        normal_user = User.objects.create_user(
            email="normal_reporter@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Visualizador",
            last_name="SinExport",
        )
        self.client.force_authenticate(user=normal_user)

        pdf_res = self.client.get(self.dash_pdf_url)
        self.assertEqual(pdf_res.status_code, status.HTTP_403_FORBIDDEN)

        excel_res = self.client.get(self.dash_excel_url)
        self.assertEqual(excel_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_with_export_permission_can_export_dashboard(self):
        """Usuario con permiso granular asignado mediante un rol puede exportar con éxito."""
        reporter_user = User.objects.create_user(
            email="authorized_reporter@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Operador",
            last_name="Reportes",
        )

        # Crear grupo de menú, módulo y asociar el ModulePermission 'dashboard.export_report'
        menu_group, _ = MenuGroup.objects.get_or_create(
            name="Panel Principal",
            defaults={"order": 1},
        )
        module, _ = MenuModule.objects.get_or_create(
            path="/dashboard",
            defaults={"group": menu_group, "label": "Dashboard", "icon": "Gauge", "order": 1},
        )
        perm, _ = ModulePermission.objects.get_or_create(
            codename="dashboard.export_report",
            defaults={"module": module, "label": "Exportar reportes", "order": 2},
        )
        group = Group.objects.create(name="Reportes Ejecutivos")
        group.module_permissions.add(perm)
        reporter_user.groups.add(group)

        self.client.force_authenticate(user=reporter_user)

        # Debe tener 200 OK en exportación
        pdf_res = self.client.get(self.dash_pdf_url)
        self.assertEqual(pdf_res.status_code, status.HTTP_200_OK)

        excel_res = self.client.get(self.dash_excel_url)
        self.assertEqual(excel_res.status_code, status.HTTP_200_OK)

    def test_unprivileged_user_cannot_export_evaluation(self):
        """Usuario sin permiso 'guios.evaluation_export' recibe 403 Forbidden."""
        eval_viewer = User.objects.create_user(
            email="eval_viewer@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Lector",
            last_name="Evaluaciones",
        )
        self.client.force_authenticate(user=eval_viewer)

        url_pdf = f"{self.eval_base_url}{self.evaluation.id}/export-pdf/"
        url_excel = f"{self.eval_base_url}{self.evaluation.id}/export-excel/"

        self.assertEqual(self.client.get(url_pdf).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(url_excel).status_code, status.HTTP_403_FORBIDDEN)

    def test_user_with_evaluation_export_permission_can_export_evaluation(self):
        """Usuario con permiso granular 'guios.evaluation_export' puede exportar con éxito."""
        eval_reporter = User.objects.create_user(
            email="eval_reporter_user@unemi.edu.ec",
            password="SecurePassword123*",
            first_name="Evaluador",
            last_name="Reportes",
        )
        menu_group, _ = MenuGroup.objects.get_or_create(
            name="Metodología GUIOS",
            defaults={"order": 2},
        )
        module, _ = MenuModule.objects.get_or_create(
            path="/dashboard/guios/evaluaciones",
            defaults={"group": menu_group, "label": "Evaluaciones", "icon": "ClipboardCheck", "order": 3},
        )
        perm, _ = ModulePermission.objects.get_or_create(
            codename="guios.evaluation_export",
            defaults={"module": module, "label": "Exportar informe evaluación", "order": 6},
        )
        group = Group.objects.create(name="Exportadores Evaluación")
        group.module_permissions.add(perm)
        eval_reporter.groups.add(group)

        self.client.force_authenticate(user=eval_reporter)
        url_pdf = f"{self.eval_base_url}{self.evaluation.id}/export-pdf/"
        url_excel = f"{self.eval_base_url}{self.evaluation.id}/export-excel/"

        self.assertEqual(self.client.get(url_pdf).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(url_excel).status_code, status.HTTP_200_OK)

    def test_d23_excel_reports_neutralize_formula_injection(self):
        """D-23: Cadenas que inician con =, +, -, @, \\t o \\r se escapan con apóstrofo en Excel."""
        import io
        import openpyxl
        from apps.guios.services.reports import EvaluationExcelReport, DashboardExcelReport

        self.evaluation.software_name = "=CMD|' /C calc'!A0"
        self.evaluation.org_name = "+SUM(A1:A2)"
        self.evaluation.software_version = "-2+3"
        self.evaluation.save()

        self.es.description_snapshot = '@HYPERLINK("http://evil.example")'
        self.es.ai_rating_justification = "\t=1+1"
        self.es.save()

        self.er.weighted_average = Decimal("4.0")
        self.er.meets_threshold = True
        self.er.foda_classification = EvaluationResult.FODA_STRENGTH
        self.er.save()

        eval_buf = EvaluationExcelReport.generate(self.evaluation)
        wb_eval = openpyxl.load_workbook(io.BytesIO(eval_buf.getvalue()), data_only=False)
        info_ws = wb_eval["Ficha Técnica"]
        sub_ws = wb_eval["Subfactores y Criterios"]
        factors_ws = wb_eval["Factores y Métricas"]

        info_values = [info_ws.cell(row=r, column=2).value for r in range(4, info_ws.max_row + 1)]
        self.assertIn("'=CMD|' /C calc'!A0", info_values)
        self.assertIn("'+SUM(A1:A2)", info_values)
        self.assertIn("'-2+3", info_values)
        self.assertEqual(sub_ws.cell(row=4, column=3).value, '\'@HYPERLINK("http://evil.example")')
        self.assertEqual(factors_ws.cell(row=4, column=9).value, 4.0)

        dash_stats = {
            "kpis": {
                "total_evaluations": 1,
                "completed_evaluations": 1,
                "adoption_viability_rate": 100.0,
                "total_with_verdict": 1,
                "foda_ratio": 1.0,
                "foda_strengths": 1,
                "foda_weaknesses": 0,
                "ai_total_calls": 0,
                "ai_avg_latency_ms": 0,
                "ai_success_rate": 100,
            },
            "verdict_distribution": [],
            "dimension_averages": [
                {"dimension_id": 1, "name": "=1+1", "avg_score": 3.5, "sample_count": 1}
            ],
            "recent_evaluations": [
                {
                    "id": 1,
                    "software_name": "=CMD|' /C calc'!A0",
                    "software_version": "\r=1+1",
                    "software_category": "General",
                    "org_name": "+EVIL()",
                    "status_display": "Completada",
                    "recommendation": "A",
                    "started_at": "2026-11-22",
                }
            ],
        }
        dash_buf = DashboardExcelReport.generate(dash_stats)
        wb_dash = openpyxl.load_workbook(io.BytesIO(dash_buf.getvalue()), data_only=False)
        recent_ws = wb_dash["Historial de Evaluaciones"]
        dims_ws = wb_dash["Rendimiento por Dimensión"]

        self.assertEqual(dims_ws.cell(row=4, column=2).value, "'=1+1")
        self.assertEqual(dims_ws.cell(row=4, column=3).value, 3.5)
        self.assertEqual(recent_ws.cell(row=4, column=2).value, "'=CMD|' /C calc'!A0")
        self.assertEqual(recent_ws.cell(row=4, column=3).value, "'\r=1+1")
        self.assertEqual(recent_ws.cell(row=4, column=5).value, "'+EVIL()")
