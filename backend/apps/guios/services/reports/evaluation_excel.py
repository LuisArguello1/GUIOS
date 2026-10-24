"""
apps/guios/services/reports/evaluation_excel.py
─────────────────────────────────────────────────────────────────────────────
Generador de Dossier Técnico de Evaluación en Excel (.xlsx) para GUIOS.
Construido con openpyxl con hojas separadas para Metadatos, Factores, Subfactores y Veredicto.
"""
import io
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from apps.guios.models import Evaluation


class EvaluationExcelReport:
    """Generador institucional de informe técnico de evaluación individual en Excel."""

    COLOR_PRIMARY = "059669"       # Verde Menta
    COLOR_PRIMARY_DARK = "065F46"  # Verde Profundo
    COLOR_BORDER = "E2E2E6"
    COLOR_WHITE = "FFFFFF"

    @classmethod
    def generate(cls, evaluation: Evaluation) -> io.BytesIO:
        wb = openpyxl.Workbook()
        default_sheet = wb.active
        wb.remove(default_sheet)

        # ── Hoja 1: Ficha Técnica ─────────────────────────────────────────────
        ws_info = wb.create_sheet(title="Ficha Técnica")
        cls._build_info_sheet(ws_info, evaluation)

        # ── Hoja 2: Factores y Puntuaciones ───────────────────────────────────
        ws_factors = wb.create_sheet(title="Factores y Métricas")
        cls._build_factors_sheet(ws_factors, evaluation)

        # ── Hoja 3: Subfactores y Criterios ───────────────────────────────────
        ws_subfactors = wb.create_sheet(title="Subfactores y Calificaciones")
        cls._build_subfactors_sheet(ws_subfactors, evaluation)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer

    @classmethod
    def _apply_header_style(cls, cell, text: str, dark: bool = False):
        bg = cls.COLOR_PRIMARY_DARK if dark else cls.COLOR_PRIMARY
        cell.value = text
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
    def _build_info_sheet(cls, ws, ev: Evaluation):
        ws.views.sheetView[0].showGridLines = True

        ws["A1"] = f"DOSSIER TÉCNICO GUIOS — {ev.software_name}"
        ws["A1"].font = Font(name="Calibri", size=14, bold=True, color=cls.COLOR_PRIMARY_DARK)

        verdict = getattr(ev, 'verdict', None)
        rec_val = f"Recomendación {verdict.recommendation}" if verdict else "En Progreso"

        rows = [
            ("ID de Evaluación", ev.id),
            ("Software Candidato", ev.software_name),
            ("Versión Evaluada", ev.software_version or "N/A"),
            ("Categoría de Software", ev.software_category or "General"),
            ("Organización Evaluadora", ev.org_name),
            ("Sector Organizacional", ev.org_sector or "No especificado"),
            ("Estado Metodológico", ev.get_status_display()),
            ("Dictamen / Veredicto", rec_val),
            ("Umbral Cuartil Q1", ev.q1_threshold or "N/A"),
            ("Umbral Cuartil Q2 (Mediana)", ev.q2_threshold or "N/A"),
            ("Umbral Cuartil Q3", ev.q3_threshold or "N/A"),
            ("Umbral Cuartil Q4", ev.q4_threshold or "N/A"),
            ("Fecha de Inicio", ev.started_at.strftime("%d/%m/%Y %H:%M") if ev.started_at else ""),
            ("Fecha de Conclusión", ev.completed_at.strftime("%d/%m/%Y %H:%M") if ev.completed_at else "Pendiente"),
        ]

        ws.cell(row=3, column=1, value="Campo").font = Font(name="Calibri", size=10, bold=True)
        ws.cell(row=3, column=2, value="Valor").font = Font(name="Calibri", size=10, bold=True)
        cls._apply_header_style(ws.cell(row=3, column=1), "Atributo de Evaluación")
        cls._apply_header_style(ws.cell(row=3, column=2), "Detalle")

        for r_idx, (k, v) in enumerate(rows, start=4):
            c1 = ws.cell(row=r_idx, column=1, value=k)
            c2 = ws.cell(row=r_idx, column=2, value=str(v))
            c1.font = Font(name="Calibri", size=9, bold=True)
            c2.font = Font(name="Calibri", size=9)
            cls._apply_border(c1)
            cls._apply_border(c2)

        cls._autofit_columns(ws)

    @classmethod
    def _build_factors_sheet(cls, ws, ev: Evaluation):
        ws.views.sheetView[0].showGridLines = True
        ws["A1"] = f"MÉTRICAS Y PUNTUACIÓN DE FACTORES — {ev.software_name}"
        ws["A1"].font = Font(name="Calibri", size=13, bold=True, color=cls.COLOR_PRIMARY_DARK)

        headers = ["Dimensión", "Factor", "Citas (c_i)", "Ratio (r_i)", "IL (1-4)", "ID (1-4)", "IS (1-4)", "IR (1-4)", "Pond. Media (PM)", "Clasificación FODA"]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h)

        results_by_factor = {er.factor_id: er for er in ev.evaluation_results.all()}
        factors = ev.evaluation_factors.select_related('factor__dimension').order_by('factor__dimension__order', 'factor__order')
        for r_idx, ef in enumerate(factors, start=4):
            res = results_by_factor.get(ef.factor_id)
            foda_val = res.get_foda_classification_display() if res else ("No relevante" if ef.is_relevant is False else "-")
            ws.cell(row=r_idx, column=1, value=ef.factor.dimension.name)
            ws.cell(row=r_idx, column=2, value=ef.factor.name)
            ws.cell(row=r_idx, column=3, value=ef.citations_count)
            ws.cell(row=r_idx, column=4, value=round(float(ef.citation_ratio), 2) if ef.citation_ratio is not None else "")
            ws.cell(row=r_idx, column=5, value=ef.literature_importance_calculated)
            ws.cell(row=r_idx, column=6, value=ef.decisor_importance)
            ws.cell(row=r_idx, column=7, value=ef.systemic_importance_snapshot)
            ws.cell(row=r_idx, column=8, value=ef.relative_importance)
            ws.cell(row=r_idx, column=9, value=round(float(res.weighted_average), 2) if res and res.weighted_average is not None else "")
            ws.cell(row=r_idx, column=10, value=foda_val)

            for c in range(1, 11):
                cell = ws.cell(row=r_idx, column=c)
                cls._apply_border(cell)
                cell.font = Font(name="Calibri", size=9)

        cls._autofit_columns(ws)

    @classmethod
    def _build_subfactors_sheet(cls, ws, ev: Evaluation):
        ws.views.sheetView[0].showGridLines = True
        ws["A1"] = f"CRITERIOS Y CALIFICACIÓN DE SUBFACTORES — {ev.software_name}"
        ws["A1"].font = Font(name="Calibri", size=13, bold=True, color=cls.COLOR_PRIMARY_DARK)

        headers = ["Dimensión", "Factor", "Criterio / Subfactor", "Citas IA (c_i)", "Rating Asignado (1 a 4)"]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h, dark=True)

        subfactors = ev.evaluation_subfactors.select_related('subfactor__factor__dimension').order_by('subfactor__factor__dimension__order', 'subfactor__factor__order', 'subfactor__order')
        for r_idx, esf in enumerate(subfactors, start=4):
            ws.cell(row=r_idx, column=1, value=esf.subfactor.factor.dimension.name)
            ws.cell(row=r_idx, column=2, value=esf.subfactor.factor.name)
            ws.cell(row=r_idx, column=3, value=esf.description_snapshot or esf.subfactor.description)
            ws.cell(row=r_idx, column=4, value=esf.ai_citations_count)
            ws.cell(row=r_idx, column=5, value=esf.rating)

            for c in range(1, 6):
                cell = ws.cell(row=r_idx, column=c)
                cls._apply_border(cell)
                cell.font = Font(name="Calibri", size=9)

        cls._autofit_columns(ws)
