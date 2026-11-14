"""
apps/guios/services/reports/evaluation_excel.py
─────────────────────────────────────────────────────────────────────────────
Generador del Informe Técnico de Evaluación FLOSS en Excel (.xlsx) para GUIOS.
Estética Grafito & Titanio con hojas dedicadas para Ficha Técnica, Dictamen
y Mitigación, Métricas de Factores, Subfactores y Evidencia Científica (DOI).
"""

import io

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from apps.guios.models import Evaluation, EvaluationResult
from apps.guios.services.ai.verdict_narrative import (
    _fold_label,
    default_responsible_for_factor,
    parse_mitigation_plan_sections,
)


class EvaluationExcelReport:
    """Generador editorial del informe técnico de evaluación individual en Excel."""

    COLOR_INK = "18181B"
    COLOR_INK_SEC = "3F3F46"
    COLOR_INK_MUTED = "71717A"
    COLOR_BORDER = "E4E4E7"
    COLOR_ZEBRA = "FAFAF9"
    COLOR_WHITE = "FFFFFF"

    FODA_STYLES = {
        EvaluationResult.FODA_STRENGTH: ("047857", "ECFDF5"),
        EvaluationResult.FODA_OPPORTUNITY: ("1D4ED8", "EFF6FF"),
        EvaluationResult.FODA_WEAKNESS: ("B45309", "FFFBEB"),
        EvaluationResult.FODA_THREAT: ("B91C1C", "FEF2F2"),
    }

    VERDICT_STYLES = {
        "A": ("047857", "ECFDF5"),
        "B": ("B45309", "FFFBEB"),
        "C": ("B91C1C", "FEF2F2"),
    }

    @classmethod
    def generate(cls, evaluation: Evaluation) -> io.BytesIO:
        wb = openpyxl.Workbook()
        wb.remove(wb.active)

        cls._build_info_sheet(wb.create_sheet(title="Ficha Técnica"), evaluation)
        cls._build_verdict_sheet(wb.create_sheet(title="Dictamen y Mitigación"), evaluation)
        cls._build_factors_sheet(wb.create_sheet(title="Factores y Métricas"), evaluation)
        cls._build_subfactors_sheet(wb.create_sheet(title="Subfactores y Criterios"), evaluation)
        cls._build_sources_sheet(wb.create_sheet(title="Evidencia Científica (DOIs)"), evaluation)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer

    @classmethod
    def _apply_header_style(cls, cell, text: str, secondary: bool = False):
        bg = cls.COLOR_INK_SEC if secondary else cls.COLOR_INK
        cell.value = text
        cell.font = Font(name="Calibri", size=10, bold=True, color=cls.COLOR_WHITE)
        cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    @classmethod
    def _apply_border(cls, cell):
        thin = Side(border_style="thin", color=cls.COLOR_BORDER)
        cell.border = Border(top=thin, left=thin, right=thin, bottom=thin)

    @classmethod
    def _style_sheet_title(cls, ws, title: str, subtitle: str):
        ws.views.sheetView[0].showGridLines = True
        ws["A1"] = title
        ws["A1"].font = Font(name="Calibri", size=13, bold=True, color=cls.COLOR_INK)
        ws["A2"] = subtitle
        ws["A2"].font = Font(name="Calibri", size=9, italic=True, color=cls.COLOR_INK_MUTED)
        ws.freeze_panes = "A4"

    @classmethod
    def _autofit_columns(cls, ws, max_width: int = 56):
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.row <= 2:
                    continue
                lines = str(cell.value or "").splitlines() or [""]
                longest = max(len(line) for line in lines)
                if longest > max_len:
                    max_len = longest
            ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), max_width)

    @classmethod
    def _build_info_sheet(cls, ws, ev: Evaluation):
        cls._style_sheet_title(
            ws,
            f"INFORME GUIOS — {ev.software_name}",
            f"Ref: {str(ev.uuid)[:8].upper()} · Organización: {ev.org_name}",
        )

        verdict = getattr(ev, "verdict", None)
        rec_code = verdict.recommendation if verdict else "N/A"
        rec_val = f"Recomendación {rec_code}" if verdict else "En progreso"

        rows = [
            ("UUID de Expediente", str(ev.uuid)),
            ("ID de Evaluación", ev.id),
            ("Software Candidato", ev.software_name),
            ("Versión Evaluada", ev.software_version or "N/A"),
            ("Categoría de Software", ev.software_category or "General"),
            ("Repositorio / Enlace", ev.software_repo_url or "No registrado"),
            ("Organización Evaluadora", ev.org_name),
            ("Sector Organizacional", ev.org_sector or "No especificado"),
            ("Estado Metodológico", ev.get_status_display()),
            ("Dictamen / Veredicto", rec_val),
            ("Umbral Cuartil Q1", float(ev.q1_threshold) if ev.q1_threshold is not None else "N/A"),
            ("Umbral Cuartil Q2 (Mediana)", float(ev.q2_threshold) if ev.q2_threshold is not None else "N/A"),
            ("Umbral Cuartil Q3", float(ev.q3_threshold) if ev.q3_threshold is not None else "N/A"),
            ("Umbral Cuartil Q4", float(ev.q4_threshold) if ev.q4_threshold is not None else "N/A"),
            ("Fecha de Inicio", ev.started_at.strftime("%d/%m/%Y %H:%M") if ev.started_at else ""),
            ("Fecha de Conclusión", ev.completed_at.strftime("%d/%m/%Y %H:%M") if ev.completed_at else "Pendiente"),
        ]
        repo_health = getattr(ev, "repo_health_metrics", None)
        if isinstance(repo_health, dict) and repo_health.get("status") == "ok":
            rel_tag = (repo_health.get("latest_release") or {}).get("tag_name") or "Sin release formal"
            rows.extend([
                ("Pulso Repositorio (Vitalidad)", f"{repo_health.get('health_score', 0)}/100 ({repo_health.get('health_grade', '')})"),
                ("Licencia OSI Detectada", repo_health.get("license_spdx") or "No declarada"),
                ("Última Actividad (días sin push)", repo_health.get("days_since_last_push") if repo_health.get("days_since_last_push") is not None else "N/D"),
                ("Último Release / Estrellas", f"{rel_tag} · {repo_health.get('stars', 0)} stars · {repo_health.get('forks', 0)} forks"),
            ])

        cls._apply_header_style(ws.cell(row=3, column=1), "Atributo")
        cls._apply_header_style(ws.cell(row=3, column=2), "Valor Registrado")
        ws.row_dimensions[3].height = 24

        zebra_fill = PatternFill(start_color=cls.COLOR_ZEBRA, end_color=cls.COLOR_ZEBRA, fill_type="solid")
        for r_idx, (k, v) in enumerate(rows, start=4):
            c1 = ws.cell(row=r_idx, column=1, value=k)
            c2 = ws.cell(row=r_idx, column=2, value=v)
            c1.font = Font(name="Calibri", size=9.5, bold=True, color=cls.COLOR_INK)
            c2.font = Font(name="Calibri", size=9.5, color=cls.COLOR_INK_SEC)
            c1.alignment = Alignment(vertical="center")
            c2.alignment = Alignment(vertical="center", wrap_text=True)
            if r_idx % 2 == 1:
                c1.fill = zebra_fill
                c2.fill = zebra_fill
            if k == "Dictamen / Veredicto" and rec_code in cls.VERDICT_STYLES:
                fg, bg = cls.VERDICT_STYLES[rec_code]
                c2.font = Font(name="Calibri", size=9.5, bold=True, color=fg)
                c2.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
            cls._apply_border(c1)
            cls._apply_border(c2)

        cls._autofit_columns(ws)

    @classmethod
    def _build_verdict_sheet(cls, ws, ev: Evaluation):
        verdict = getattr(ev, "verdict", None)
        rec_code = verdict.recommendation if verdict else "N/A"
        cls._style_sheet_title(
            ws,
            f"DICTAMEN Y PLAN DE MITIGACIÓN — {ev.software_name}",
            f"Recomendación {rec_code} · Umbral metodológico de adopción: PM >= 3.00",
        )

        # Bloque resumen de dictamen en filas 3-5
        cls._apply_header_style(ws.cell(row=3, column=1), "Campo de Dictamen")
        cls._apply_header_style(ws.cell(row=3, column=2), "Detalle Metodológico y Síntesis")
        ws.row_dimensions[3].height = 22

        summary_rows = [
            ("Recomendación", f"Recomendación {rec_code}" if verdict else "Pendiente"),
            ("Justificación del Motor", verdict.explanation_text if verdict else "Evaluación en curso."),
            ("Síntesis Ejecutiva", (verdict.ai_executive_summary or "").strip() if verdict else ""),
        ]
        curr_row = 4
        for label, text_val in summary_rows:
            c1 = ws.cell(row=curr_row, column=1, value=label)
            c2 = ws.cell(row=curr_row, column=2, value=text_val or "No disponible")
            c1.font = Font(name="Calibri", size=9.5, bold=True, color=cls.COLOR_INK)
            c2.font = Font(name="Calibri", size=9.5, color=cls.COLOR_INK_SEC)
            c1.alignment = Alignment(vertical="top")
            c2.alignment = Alignment(vertical="top", wrap_text=True)
            cls._apply_border(c1)
            cls._apply_border(c2)
            curr_row += 1

        curr_row += 1
        headers = [
            "Factor / Brecha",
            "Riesgo Metodológico",
            "Acción Correctiva",
            "Responsable",
            "Meta de Aprobación",
        ]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=curr_row, column=col_idx), h, secondary=True)
        ws.row_dimensions[curr_row].height = 24
        curr_row += 1

        mitigation_text = (verdict.ai_mitigation_plan or "").strip() if verdict else ""
        rows_by_factor = parse_mitigation_plan_sections(mitigation_text)

        results_map = {er.factor_id: er for er in ev.evaluation_results.all()}
        factors = ev.evaluation_factors.select_related("factor__dimension").order_by(
            "factor__dimension__order", "factor__order"
        )
        neg_factors = [
            (ef, results_map[ef.factor_id])
            for ef in factors
            if ef.is_relevant and ef.factor_id in results_map and not results_map[ef.factor_id].meets_threshold
        ]

        written = 0
        for ef, res in neg_factors:
            matched = rows_by_factor.get(_fold_label(ef.factor.name), {})
            pm = float(res.weighted_average)
            vals = [
                f"{ef.factor.name} (PM {pm:.2f})",
                matched.get("riesgo_metodologico") or f"Desviación técnica en {ef.factor.name} bajo umbral 3.00.",
                matched.get("accion_correctiva") or f"Ejecutar piloto correctivo en {ef.factor.name}.",
                matched.get("responsable")
                or default_responsible_for_factor(ef.factor.name, ef.factor.dimension.name, ef.factor.scope),
                matched.get("meta_aprobacion") or f"Alcanzar PM >= 3.00 en {ef.factor.name}.",
            ]
            for c_idx, val in enumerate(vals, start=1):
                cell = ws.cell(row=curr_row, column=c_idx, value=val)
                cell.font = Font(name="Calibri", size=9, color=cls.COLOR_INK_SEC, bold=(c_idx in (1, 4)))
                cell.alignment = Alignment(vertical="top", wrap_text=True)
                cls._apply_border(cell)
            curr_row += 1
            written += 1

        if written == 0 and rows_by_factor:
            for srow in rows_by_factor.values():
                vals = [
                    srow.get("factor", ""),
                    srow.get("riesgo_metodologico", ""),
                    srow.get("accion_correctiva", ""),
                    srow.get("responsable") or "Arquitectura TI",
                    srow.get("meta_aprobacion") or "Mantener PM >= 3.00.",
                ]
                for c_idx, val in enumerate(vals, start=1):
                    cell = ws.cell(row=curr_row, column=c_idx, value=val)
                    cell.font = Font(name="Calibri", size=9, color=cls.COLOR_INK_SEC, bold=(c_idx in (1, 4)))
                    cell.alignment = Alignment(vertical="top", wrap_text=True)
                    cls._apply_border(cell)
                curr_row += 1
                written += 1

        if written == 0:
            note = ws.cell(row=curr_row, column=1, value="Sin factores bajo el umbral 3.00; no se requieren acciones correctivas.")
            note.font = Font(name="Calibri", size=9, italic=True, color=cls.COLOR_INK_MUTED)

        cls._autofit_columns(ws, max_width=48)

    @classmethod
    def _build_factors_sheet(cls, ws, ev: Evaluation):
        cls._style_sheet_title(
            ws,
            f"MÉTRICAS DE FACTORES — {ev.software_name}",
            "Citas (TC), razón r_i, importancias IL/ID/IS/IR, Ponderación Media (PM) y diagnóstico FODA",
        )

        headers = [
            "Dimensión", "Factor", "Citas (TC)", "Razón (r_i)",
            "IL (1-4)", "ID (1-4)", "IS (1-4)", "IR (1-4)",
            "Pond. Media (PM)", "Clasificación FODA",
        ]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h)
        ws.row_dimensions[3].height = 24

        results_by_factor = {er.factor_id: er for er in ev.evaluation_results.all()}
        factors = ev.evaluation_factors.select_related("factor__dimension").order_by(
            "factor__dimension__order", "factor__order"
        )
        for r_idx, ef in enumerate(factors, start=4):
            res = results_by_factor.get(ef.factor_id)
            foda_val = res.get_foda_classification_display() if res else ("No relevante" if ef.is_relevant is False else "-")
            pm_val = round(float(res.weighted_average), 2) if res and res.weighted_average is not None else None
            ratio_val = round(float(ef.citation_ratio), 4) if ef.citation_ratio is not None else 0.0

            row_vals = [
                ef.factor.dimension.name,
                ef.factor.name,
                ef.citations_count,
                ratio_val,
                ef.literature_importance_calculated,
                ef.decisor_importance,
                ef.systemic_importance_snapshot,
                ef.relative_importance,
                pm_val,
                foda_val,
            ]
            for c, val in enumerate(row_vals, start=1):
                cell = ws.cell(row=r_idx, column=c, value=val)
                cls._apply_border(cell)
                cell.font = Font(name="Calibri", size=9.5, color=cls.COLOR_INK_SEC)
                if c in (3, 5, 6, 7, 8):
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif c == 4:
                    cell.number_format = "0.0000"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                elif c == 9 and val is not None:
                    cell.number_format = "0.00"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                elif c == 10 and res and res.foda_classification in cls.FODA_STYLES:
                    fg, bg = cls.FODA_STYLES[res.foda_classification]
                    cell.font = Font(name="Calibri", size=9.5, bold=True, color=fg)
                    cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
                    cell.alignment = Alignment(horizontal="center", vertical="center")

        cls._autofit_columns(ws)

    @classmethod
    def _build_subfactors_sheet(cls, ws, ev: Evaluation):
        cls._style_sheet_title(
            ws,
            f"SUBFACTORES Y CALIFICACIONES — {ev.software_name}",
            "Escala GUIOS: 1 No cumple · 2 Desconozco · 3 Cumple parcialmente · 4 Cumple",
        )

        headers = ["Dimensión", "Factor", "Criterio / Subfactor", "Citas IA (c_i)", "Rating (1-4)"]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h, secondary=True)
        ws.row_dimensions[3].height = 24

        subfactors = ev.evaluation_subfactors.select_related("subfactor__factor__dimension").order_by(
            "subfactor__factor__dimension__order", "subfactor__factor__order", "subfactor__order"
        )
        for r_idx, esf in enumerate(subfactors, start=4):
            vals = [
                esf.subfactor.factor.dimension.name,
                esf.subfactor.factor.name,
                esf.description_snapshot or esf.subfactor.description,
                esf.ai_citations_count,
                esf.rating,
            ]
            for c, val in enumerate(vals, start=1):
                cell = ws.cell(row=r_idx, column=c, value=val)
                cls._apply_border(cell)
                cell.font = Font(name="Calibri", size=9.5, color=cls.COLOR_INK_SEC)
                if c in (4, 5):
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    cell.alignment = Alignment(vertical="center", wrap_text=True)

        cls._autofit_columns(ws)

    @classmethod
    def _build_sources_sheet(cls, ws, ev: Evaluation):
        cls._style_sheet_title(
            ws,
            f"EVIDENCIA CIENTÍFICA (OPENALEX / DOI) — {ev.software_name}",
            "Artículos académicos indexados y extractos asignados por factor",
        )

        headers = ["Dimensión", "Factor", "DOI", "Título de la Publicación", "URL Enlace", "Evidencia / Extracto"]
        for col_idx, h in enumerate(headers, start=1):
            cls._apply_header_style(ws.cell(row=3, column=col_idx), h)
        ws.row_dimensions[3].height = 24

        factors = ev.evaluation_factors.select_related("factor__dimension").order_by(
            "factor__dimension__order", "factor__order"
        )
        r_idx = 4
        for ef in factors:
            for s in (ef.ai_literature_sources or []):
                vals = [
                    ef.factor.dimension.name,
                    ef.factor.name,
                    s.get("doi") or "N/A",
                    s.get("title") or "",
                    s.get("url") or "",
                    s.get("snippet") or "",
                ]
                for c, val in enumerate(vals, start=1):
                    cell = ws.cell(row=r_idx, column=c, value=val)
                    cls._apply_border(cell)
                    cell.font = Font(name="Calibri", size=9, color=cls.COLOR_INK_SEC)
                    cell.alignment = Alignment(vertical="top", wrap_text=True)
                r_idx += 1

        cls._autofit_columns(ws)
