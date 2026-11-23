"""
apps/guios/services/reports/dashboard_excel.py
─────────────────────────────────────────────────────────────────────────────
Generador de Reportes Analíticos en Excel (.xlsx) para el Dashboard GUIOS.
Construido con openpyxl aplicando estilos corporativos y formateo de celdas.
"""
import io
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from .excel_security import sanitize_excel_value


class DashboardExcelReport:
    """Generador institucional de informe analítico consolidado en Excel."""

    COLOR_PRIMARY = "059669"       # Verde Menta
    COLOR_PRIMARY_DARK = "065F46"  # Verde Profundo
    COLOR_BG_LIGHT = "F8F8F9"
    COLOR_BORDER = "E2E2E6"
    COLOR_WHITE = "FFFFFF"

    @classmethod
    def generate(cls, stats: dict) -> io.BytesIO:
        wb = openpyxl.Workbook()
        
        # Eliminar hoja por defecto
        default_sheet = wb.active
        wb.remove(default_sheet)

        # ── Hoja 1: Resumen y KPIs ────────────────────────────────────────────
        ws_kpis = wb.create_sheet(title="Resumen Ejecutivo")
        cls._build_kpis_sheet(ws_kpis, stats)

        # ── Hoja 2: Veredictos de Adopción ─────────────────────────────────────
        ws_verdicts = wb.create_sheet(title="Veredictos de Adopción")
        cls._build_verdicts_sheet(ws_verdicts, stats)

        # ── Hoja 3: Dimensiones GUIOS ─────────────────────────────────────────
        ws_dims = wb.create_sheet(title="Rendimiento por Dimensión")
        cls._build_dimensions_sheet(ws_dims, stats)

        # ── Hoja 4: Registro de Evaluaciones ──────────────────────────────────
        ws_evals = wb.create_sheet(title="Historial de Evaluaciones")
        cls._build_recent_sheet(ws_evals, stats)

        # Guardar en buffer en memoria
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer

    @staticmethod
    def _set_cell(ws, row: int, column: int, value):
        return ws.cell(row=row, column=column, value=sanitize_excel_value(value))

    @classmethod
    def _apply_header_style(cls, cell, text: str, dark: bool = False):
        bg = cls.COLOR_PRIMARY_DARK if dark else cls.COLOR_PRIMARY
        cell.value = sanitize_excel_value(text)
        cell.font = Font(name="Calibri", size=10, bold=True, color=cls.COLOR_WHITE)
        cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    @classmethod
    def _apply_border(cls, cell):
        thin = Side(border_style="thin", color=cls.COLOR_BORDER)
        cell.border = Border(top=thin, left=thin, right=thin, bottom=thin)

    @classmethod
    def _autofit_columns(cls, ws):
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or '')
                if len(val) > max_len:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    @classmethod
    def _build_kpis_sheet(cls, ws, stats: dict):
        ws.views.sheetView[0].showGridLines = True

        # Título
        ws.merge_cells("A1:D1")
        title_cell = ws["A1"]
        title_cell.value = sanitize_excel_value("GUIOS — DASHBOARD ANALÍTICO DE ADOPCIÓN FLOSS")
        title_cell.font = Font(name="Calibri", size=14, bold=True, color=cls.COLOR_PRIMARY_DARK)
        title_cell.alignment = Alignment(horizontal="left", vertical="center")

        ws["A2"] = sanitize_excel_value(f"Generado el: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
        ws["A2"].font = Font(name="Calibri", size=9, italic=True, color="5B5D68")

        # Tabla de KPIs
        kpis = stats.get('kpis', {})
        headers = ["Indicador Estratégico (KPI)", "Valor Obtenido", "Unidad", "Descripción"]
        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=4, column=col_idx)
            cls._apply_header_style(cell, h)

        kpi_rows = [
            ("Total Evaluaciones Registradas", kpis.get('total_evaluations', 0), "Sesiones", "Volumen total de evaluaciones iniciadas"),
            ("Evaluaciones Concluidas", kpis.get('completed_evaluations', 0), "Completadas", "Evaluaciones con veredicto final emitido"),
            ("Tasa de Viabilidad de Adopción (A+B)", f"{kpis.get('adoption_viability_rate', 0)}%", "Porcentaje", "Porcentaje de software apto para adopción"),
            ("Evaluaciones Dictaminadas", kpis.get('total_with_verdict', 0), "Casos", "Software con dictamen final emitido"),
            ("Ratio de Salud FODA (F/D)", kpis.get('foda_ratio', 0.0), "Ratio", "Proporción de fortalezas frente a debilidades"),
            ("Total Fortalezas Detectadas", kpis.get('foda_strengths', 0), "Factores", "Criterios con cumplimiento óptimo"),
            ("Total Debilidades / Riesgos", kpis.get('foda_weaknesses', 0), "Factores", "Criterios que requieren mitigación"),
            ("Interacciones Asistidas por IA", kpis.get('ai_total_calls', 0), "Peticiones", "Llamadas a modelos Groq/Cohere/Heurístico"),
            ("Latencia Media de IA", f"{kpis.get('ai_avg_latency_ms', 0)} ms", "Milisegundos", "Tiempo medio de respuesta de inferencia"),
            ("Tasa de Efectividad IA", f"{kpis.get('ai_success_rate', 100)}%", "Porcentaje", "Porcentaje de llamadas resueltas con éxito"),
        ]

        for row_idx, data in enumerate(kpi_rows, start=5):
            for col_idx, val in enumerate(data, start=1):
                cell = cls._set_cell(ws, row=row_idx, column=col_idx, value=val)
                cls._apply_border(cell)
                if col_idx == 2:
                    cell.font = Font(name="Calibri", size=10, bold=True, color=cls.COLOR_PRIMARY_DARK)
                    cell.alignment = Alignment(horizontal="center")
                else:
                    cell.font = Font(name="Calibri", size=9)

        cls._autofit_columns(ws)

    @classmethod
    def _build_verdicts_sheet(cls, ws, stats: dict):
        ws.views.sheetView[0].showGridLines = True
        ws["A1"] = "DISTRIBUCIÓN DE DICTÁMENES Y VEREDICTOS DE ADOPCIÓN"
        ws["A1"].font = Font(name="Calibri", size=13, bold=True, color=cls.COLOR_PRIMARY_DARK)

        headers = ["Dictamen", "Significado Metodológico", "Total Casos", "Participación %"]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h)

        total_v = stats.get('kpis', {}).get('total_with_verdict', 0) or 1
        for row_idx, item in enumerate(stats.get('verdict_distribution', []), start=4):
            count = item.get('count', 0)
            pct = round((count / total_v) * 100, 1)
            cls._set_cell(ws, row=row_idx, column=1, value=f"Recomendación {item.get('recommendation')}")
            cls._set_cell(ws, row=row_idx, column=2, value=item.get('label'))
            cls._set_cell(ws, row=row_idx, column=3, value=count)
            cls._set_cell(ws, row=row_idx, column=4, value=f"{pct}%")

            for c in range(1, 5):
                cls._apply_border(ws.cell(row=row_idx, column=c))

        cls._autofit_columns(ws)

    @classmethod
    def _build_dimensions_sheet(cls, ws, stats: dict):
        ws.views.sheetView[0].showGridLines = True
        ws["A1"] = "RENDIMIENTO PROMEDIO POR DIMENSIÓN GUIOS"
        ws["A1"].font = Font(name="Calibri", size=13, bold=True, color=cls.COLOR_PRIMARY_DARK)

        headers = ["ID Dimensión", "Nombre de la Dimensión", "Puntaje Medio (1 a 4)", "Factores Evaluados", "Estado"]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h, dark=True)

        for row_idx, d in enumerate(stats.get('dimension_averages', []), start=4):
            score = d.get('avg_score', 0.0)
            state = "Óptimo" if score >= 3.0 else ("Parcial" if score >= 2.0 else "Riesgo")
            cls._set_cell(ws, row=row_idx, column=1, value=d.get('dimension_id'))
            cls._set_cell(ws, row=row_idx, column=2, value=d.get('name'))
            cls._set_cell(ws, row=row_idx, column=3, value=score)
            cls._set_cell(ws, row=row_idx, column=4, value=d.get('sample_count'))
            cls._set_cell(ws, row=row_idx, column=5, value=state)

            for c in range(1, 6):
                cls._apply_border(ws.cell(row=row_idx, column=c))

        cls._autofit_columns(ws)

    @classmethod
    def _build_recent_sheet(cls, ws, stats: dict):
        ws.views.sheetView[0].showGridLines = True
        ws["A1"] = "HISTORIAL Y REGISTRO DE EVALUACIONES"
        ws["A1"].font = Font(name="Calibri", size=13, bold=True, color=cls.COLOR_PRIMARY_DARK)

        headers = ["ID", "Software Candidato", "Versión", "Categoría", "Organización", "Estado", "Veredicto", "Fecha Inicio"]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h)

        for row_idx, item in enumerate(stats.get('recent_evaluations', []), start=4):
            rec = item.get('recommendation')
            rec_val = f"Rec. {rec}" if rec else "En Curso"
            cls._set_cell(ws, row=row_idx, column=1, value=item.get('id'))
            cls._set_cell(ws, row=row_idx, column=2, value=item.get('software_name'))
            cls._set_cell(ws, row=row_idx, column=3, value=item.get('software_version') or 'N/A')
            cls._set_cell(ws, row=row_idx, column=4, value=item.get('software_category') or 'General')
            cls._set_cell(ws, row=row_idx, column=5, value=item.get('org_name') or 'N/A')
            cls._set_cell(ws, row=row_idx, column=6, value=item.get('status_display'))
            cls._set_cell(ws, row=row_idx, column=7, value=rec_val)
            cls._set_cell(ws, row=row_idx, column=8, value=item.get('started_at') or '')

            for c in range(1, 9):
                cls._apply_border(ws.cell(row=row_idx, column=c))

        cls._autofit_columns(ws)
