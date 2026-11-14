"""
apps/guios/services/reports/evaluation_pdf.py
─────────────────────────────────────────────────────────────────────────────
Generador del Informe Técnico de Evaluación FLOSS (PDF) bajo estética
Editorial Suiza / Grafito & Titanio con gráficos vectoriales ReportLab.

Estructura del documento:
- Folio 1: Portada asimétrica (Identificación + Dictamen Lateral + Control Cuartílico)
- Folio 2: Briefing Ejecutivo (Tira KPI + Gráfico Cleveland Dot-Bar + Síntesis + Topografía FODA)
- Folios 3+: Auditoría Cuantitativa por Dimensión y Desglose de Subfactores
- Sección 04: Plan de Mitigación y Gobernanza (5 columnas estructuradas)
- Sección 05: Evidencia Científica Indexada (OpenAlex DOI) y Colofón de Integridad
"""

from datetime import datetime
import hashlib
import io
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from apps.guios.models import Evaluation, EvaluationResult
from apps.guios.services.ai.verdict_narrative import (
    _fold_label,
    default_responsible_for_factor,
    parse_mitigation_plan_sections,
)

from .pdf_charts import (
    build_factor_benchmark_chart,
    build_foda_quadrant_visual,
    build_verdict_gauge,
)
from .pdf_theme import (
    INK_DARK,
    INK_MUTED,
    INK_PRIMARY,
    INK_SECONDARY,
    PAPER_WHITE,
    RECOMMENDATION_META,
    RULE_HEAVY,
    RULE_LIGHT,
    RULE_MED,
    SEMANTIC_FAIL,
    SEMANTIC_FAIL_BG,
    SEMANTIC_OPP,
    SEMANTIC_PASS,
    SEMANTIC_WARN,
    SURFACE_ALT,
    SURFACE_BAND,
    build_editorial_styles,
    build_section_header,
    parse_markdown_to_editorial_flowables,
    sanitize_pdf_text,
)


class EditorialNumberedCanvas(canvas.Canvas):
    """Canvas de doble pasada con cabecera técnica minimalista y paginación 01 / NN."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self._report_title = getattr(args[0], "_report_title", "INFORME GUIOS") if args else "INFORME GUIOS"
        self._report_ref = getattr(args[0], "_report_ref", "REF") if args else "REF"

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_chrome(total_pages)
            super().showPage()
        super().save()

    def _draw_chrome(self, total_pages: int):
        page_num = self._pageNumber
        width, height = A4
        margin_x = 1.8 * cm

        self.saveState()
        # Cabecera discreta únicamente a partir de la página 2 (portada limpia)
        if page_num > 1:
            y_hdr = height - 1.25 * cm
            self.setFont("Courier-Bold", 7.0)
            self.setFillColor(INK_PRIMARY)
            self.drawString(margin_x, y_hdr + 3, self._report_title[:68])

            self.setFont("Courier", 7.0)
            self.setFillColor(INK_MUTED)
            self.drawRightString(width - margin_x, y_hdr + 3, self._report_ref)

            self.setStrokeColor(RULE_MED)
            self.setLineWidth(0.5)
            self.line(margin_x, y_hdr, width - margin_x, y_hdr)

        # Pie de página editorial en todas las páginas
        y_ftr = 1.2 * cm
        self.setStrokeColor(RULE_LIGHT)
        self.setLineWidth(0.5)
        self.line(margin_x, y_ftr + 9, width - margin_x, y_ftr + 9)

        self.setFont("Helvetica", 6.8)
        self.setFillColor(INK_MUTED)
        self.drawString(margin_x, y_ftr, "Metodología GUIOS // Auditoría de Adopción FLOSS")

        self.setFont("Courier-Bold", 7.0)
        self.setFillColor(INK_SECONDARY)
        self.drawRightString(width - margin_x, y_ftr, f"PAG {page_num:02d} / {total_pages:02d}")
        self.restoreState()


class EvaluationPDFReport:
    """Generador editorial de informes técnicos de evaluación FLOSS en formato PDF."""

    PAGE_W, PAGE_H = A4
    MARGIN_X = 1.8 * cm
    CONTENT_W = PAGE_W - (2 * MARGIN_X)

    RATING_LABELS = {
        1: ("1", "No cumple", "#B91C1C"),
        2: ("2", "Desconozco", "#B45309"),
        3: ("3", "Parcial", "#3F3F46"),
        4: ("4", "Cumple", "#047857"),
    }

    @classmethod
    def generate(cls, evaluation: Evaluation) -> io.BytesIO:
        buffer = io.BytesIO()
        ctx = cls._collect_context(evaluation)
        styles = build_editorial_styles()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=cls.MARGIN_X,
            leftMargin=cls.MARGIN_X,
            topMargin=1.85 * cm,
            bottomMargin=1.75 * cm,
            title=sanitize_pdf_text(f"Informe GUIOS - {evaluation.software_name}"),
            author="GUIOS Audit Engine",
        )

        # Metadatos consumidos por EditorialNumberedCanvas
        soft_upper = sanitize_pdf_text(evaluation.software_name or "SOFTWARE").upper()
        ref_short = str(evaluation.uuid)[:8].upper()

        class _BoundCanvas(EditorialNumberedCanvas):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._report_title = f"GUIOS // {soft_upper}"
                self._report_ref = f"REF {ref_short}"

        story = []
        story.extend(cls._build_cover_page(ctx, styles))
        story.append(PageBreak())
        story.extend(cls._build_executive_briefing(ctx, styles))
        story.append(PageBreak())
        story.extend(cls._build_quantitative_sections(ctx, styles))

        mitigation_flow = cls._build_mitigation_section(ctx, styles)
        if mitigation_flow:
            story.append(PageBreak())
            story.extend(mitigation_flow)

        story.append(PageBreak())
        story.extend(cls._build_literature_appendix(ctx, styles))

        doc.build(story, canvasmaker=_BoundCanvas)
        buffer.seek(0)
        return buffer

    @classmethod
    def _collect_context(cls, evaluation: Evaluation) -> dict:
        verdict = getattr(evaluation, "verdict", None)
        rec_code = verdict.recommendation if verdict else "N/A"
        rec_meta = RECOMMENDATION_META.get(rec_code, RECOMMENDATION_META["N/A"])

        factors_qs = list(
            evaluation.evaluation_factors.select_related("factor__dimension").order_by(
                "factor__dimension__order", "factor__order"
            )
        )
        results_map = {er.factor_id: er for er in evaluation.evaluation_results.all()}
        subfactors_qs = list(
            evaluation.evaluation_subfactors.select_related("subfactor__factor").order_by(
                "subfactor__order", "id"
            )
        )

        subfactors_by_factor = {}
        for esf in subfactors_qs:
            subfactors_by_factor.setdefault(esf.subfactor.factor_id, []).append(esf)

        relevant_pms = []
        passed_count = 0
        total_citations = 0
        chart_entries = []
        foda_buckets = {
            EvaluationResult.FODA_STRENGTH: [],
            EvaluationResult.FODA_OPPORTUNITY: [],
            EvaluationResult.FODA_WEAKNESS: [],
            EvaluationResult.FODA_THREAT: [],
        }
        dimensions_ordered = []
        dim_map = {}
        all_sources = []

        for ef in factors_qs:
            total_citations += int(ef.citations_count or 0)
            res = results_map.get(ef.factor_id)
            dim = ef.factor.dimension
            if dim.id not in dim_map:
                dim_entry = {"dimension": dim, "factors": [], "pms": []}
                dim_map[dim.id] = dim_entry
                dimensions_ordered.append(dim_entry)
            dim_map[dim.id]["factors"].append((ef, res))

            if ef.is_relevant and res and res.weighted_average is not None:
                pm_val = float(res.weighted_average)
                relevant_pms.append(pm_val)
                dim_map[dim.id]["pms"].append(pm_val)
                if res.meets_threshold:
                    passed_count += 1
                foda_key = res.foda_classification
                if foda_key in foda_buckets:
                    foda_buckets[foda_key].append((ef, pm_val))
                chart_entries.append({
                    "name": ef.factor.name,
                    "pm": pm_val,
                    "ir": ef.relative_importance,
                    "foda_key": foda_key,
                    "meets": bool(res.meets_threshold),
                })

            for src in (ef.ai_literature_sources or []):
                if src.get("doi") or src.get("title"):
                    all_sources.append({
                        "dimension": dim.name,
                        "factor": ef.factor.name,
                        "doi": src.get("doi") or "",
                        "title": src.get("title") or "Sin título registrado",
                        "url": src.get("url") or "",
                        "snippet": src.get("snippet") or "",
                    })

        relevant_count = len(relevant_pms)
        avg_pm = round(sum(relevant_pms) / relevant_count, 2) if relevant_count else 0.0
        pass_rate_pct = round((passed_count / relevant_count) * 100.0, 1) if relevant_count else 0.0

        evaluator_name = "Evaluación Pública / Anónima"
        if evaluation.created_by:
            full_name = evaluation.created_by.get_full_name().strip()
            evaluator_name = full_name or getattr(evaluation.created_by, "email", evaluator_name)

        emission_dt = evaluation.completed_at or evaluation.started_at or datetime.now()
        emission_str = emission_dt.strftime("%d/%m/%Y · %H:%M")

        hash_seed = f"{evaluation.uuid}|{evaluation.software_name}|{evaluation.org_name}|{rec_code}"
        expediente_hash = hashlib.sha256(hash_seed.encode("utf-8")).hexdigest()[:16].upper()

        return {
            "evaluation": evaluation,
            "verdict": verdict,
            "rec_code": rec_code,
            "rec_meta": rec_meta,
            "factors_qs": factors_qs,
            "results_map": results_map,
            "subfactors_by_factor": subfactors_by_factor,
            "dimensions_ordered": dimensions_ordered,
            "relevant_count": relevant_count,
            "total_factors": len(factors_qs),
            "passed_count": passed_count,
            "avg_pm": avg_pm,
            "pass_rate_pct": pass_rate_pct,
            "total_citations": total_citations,
            "chart_entries": chart_entries,
            "foda_buckets": foda_buckets,
            "all_sources": all_sources,
            "evaluator_name": evaluator_name,
            "emission_str": emission_str,
            "expediente_hash": expediente_hash,
        }

    @classmethod
    def _resolve_logo_flowable(cls):
        base_dir = Path(getattr(settings, "BASE_DIR", "."))
        for candidate in (
            base_dir / "static" / "img" / "Logotipo.png",
            base_dir / "static" / "img" / "Isotipo.png",
        ):
            if candidate.exists():
                try:
                    return Image(str(candidate), width=2.9 * cm, height=0.85 * cm, kind="proportional")
                except Exception:
                    return None
        return None

    # ── FOLIO 1: PORTADA EDITORIAL ASIMÉTRICA ────────────────────────────────

    @classmethod
    def _build_cover_page(cls, ctx: dict, styles: dict) -> list:
        ev = ctx["evaluation"]
        rec_code = ctx["rec_code"]
        rec_meta = ctx["rec_meta"]
        verdict = ctx["verdict"]
        W = cls.CONTENT_W
        flow = []

        # 1. Masthead superior limpio con logotipo opcional y código de referencia
        logo = cls._resolve_logo_flowable()
        left_mast = logo if logo else Paragraph(
            "<font face='Helvetica-Bold' size='11' color='#18181B'>GUIOS</font> "
            "<font face='Courier' size='7.5' color='#71717A'>// AUDIT</font>",
            styles["raw_left"],
        )
        right_mast = Paragraph(
            f"<font face='Courier' size='7.2' color='#71717A'>"
            f"FOLIO TÉCNICO // REF {str(ev.uuid)[:8].upper()} · {xml_escape(ctx['emission_str'])}"
            f"</font>",
            styles["raw_right"],
        )
        mast = Table([[left_mast, right_mast]], colWidths=[W * 0.42, W * 0.58])
        mast.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, 0), 1.5, RULE_HEAVY),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        flow.append(mast)
        flow.append(Spacer(1, 22))

        # 2. Hero asimétrico (61% Identificación Técnica | 39% Dictamen Lateral)
        soft_name = xml_escape(sanitize_pdf_text(ev.software_name))
        soft_ver = xml_escape(sanitize_pdf_text(ev.software_version or "1.0"))
        soft_cat = xml_escape(sanitize_pdf_text(ev.software_category or "Software Libre / FLOSS"))
        org_name = xml_escape(sanitize_pdf_text(ev.org_name))
        org_sector = xml_escape(sanitize_pdf_text(ev.org_sector or "Sector no especificado"))

        left_col = [
            Paragraph("AUDITORÍA METODOLÓGICA DE ADOPCIÓN FLOSS", styles["eyebrow"]),
            Spacer(1, 6),
            Paragraph(soft_name, styles["cover_title"]),
            Spacer(1, 4),
            Paragraph(
                f"<font face='Courier-Bold' size='8.5' color='#18181B'>v{soft_ver}</font>"
                f"<font color='#71717A' size='8.5'>  //  {soft_cat}</font>",
                styles["raw_left"],
            ),
            Spacer(1, 14),
            Paragraph(
                f"<font face='Courier' size='7' color='#71717A'>ORGANIZACIÓN EVALUADORA</font><br/>"
                f"<font face='Helvetica-Bold' size='11' color='#18181B'>{org_name}</font><br/>"
                f"<font size='8.5' color='#52525B'>{org_sector}</font>",
                styles["raw_left"],
            ),
        ]

        if ev.software_description:
            desc_clean = xml_escape(sanitize_pdf_text(ev.software_description[:280]))
            left_col.extend([
                Spacer(1, 12),
                Paragraph(
                    "<font face='Courier' size='6.8' color='#71717A'>PERFIL FUNCIONAL ANALIZADO</font><br/>"
                    f"<font size='8.2' color='#3F3F46'>{desc_clean}</font>",
                    styles["editorial_body"],
                ),
            ])
        if ev.org_description:
            org_desc_clean = xml_escape(sanitize_pdf_text(ev.org_description[:240]))
            left_col.extend([
                Spacer(1, 8),
                Paragraph(
                    "<font face='Courier' size='6.8' color='#71717A'>CONTEXTO Y NECESIDAD TI</font><br/>"
                    f"<font size='8.2' color='#3F3F46'>{org_desc_clean}</font>",
                    styles["editorial_body"],
                ),
            ])

        rec_hex = rec_meta["hex"]
        gauge = build_verdict_gauge(ctx["avg_pm"], rec_meta["color"], width=W * 0.35)
        explanation = xml_escape(sanitize_pdf_text(verdict.explanation_text if verdict else rec_meta["rule_text"]))

        verdict_glyph_style = ParagraphStyle(
            "VerdictGlyph",
            parent=styles["raw_left"],
            fontName="Helvetica-Bold",
            fontSize=42,
            leading=46,
            textColor=rec_meta["color"],
        )

        right_col = [
            Paragraph("DICTAMEN DEL MOTOR GUIOS", styles["eyebrow"]),
            Spacer(1, 6),
            Paragraph(xml_escape(rec_code), verdict_glyph_style),
            Spacer(1, 6),
            Paragraph(
                f"<font face='Helvetica-Bold' size='9.5' color='{rec_hex}'>{xml_escape(rec_meta['title'])}</font>",
                styles["raw_left"],
            ),
            Spacer(1, 6),
            Paragraph(
                f"<font size='7.8' color='#3F3F46'>{explanation}</font>",
                styles["raw_left"],
            ),
            Spacer(1, 12),
            gauge,
            Spacer(1, 6),
            Paragraph(
                f"<font face='Courier' size='7.2' color='#52525B'>"
                f"CUMPLIMIENTO: {ctx['passed_count']}/{ctx['relevant_count']} ({ctx['pass_rate_pct']:.1f}%)"
                f"</font>",
                styles["raw_left"],
            ),
        ]

        hero_tbl = Table([[left_col, right_col]], colWidths=[W * 0.61, W * 0.39])
        hero_tbl.setStyle(TableStyle([
            ("LINEBEFORE", (1, 0), (1, 0), 0.75, RULE_MED),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 16),
            ("LEFTPADDING", (1, 0), (1, 0), 16),
            ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        flow.append(hero_tbl)
        flow.append(Spacer(1, 28))

        # 3. Ficha de Control y Calibración Cuartílica (sin cajas verdes)
        flow.append(build_section_header("00", "FICHA DE CONTROL Y CALIBRACIÓN CUARTÍLICA", f"SHA256:{ctx['expediente_hash']}", W, styles))
        flow.append(Spacer(1, 8))

        q1 = str(ev.q1_threshold) if ev.q1_threshold is not None else "--"
        q2 = str(ev.q2_threshold) if ev.q2_threshold is not None else "--"
        q3 = str(ev.q3_threshold) if ev.q3_threshold is not None else "--"
        q4 = str(ev.q4_threshold) if ev.q4_threshold is not None else "--"

        meta_rows = [
            [
                Paragraph("EVALUADOR RESPONSABLE", styles["th_left"]),
                Paragraph(xml_escape(sanitize_pdf_text(ctx["evaluator_name"])), styles["td_left"]),
                Paragraph("DIMENSIONES / FACTORES", styles["th_left"]),
                Paragraph(
                    f"{len(ctx['dimensions_ordered'])} dimensiones · {ctx['relevant_count']} relevantes de {ctx['total_factors']}",
                    styles["td_left"],
                ),
            ],
            [
                Paragraph("ESTADO METODOLÓGICO", styles["th_left"]),
                Paragraph(xml_escape(sanitize_pdf_text(ev.get_status_display())), styles["td_left"]),
                Paragraph("TAMAÑO / HORIZONTE", styles["th_left"]),
                Paragraph(
                    f"{xml_escape(sanitize_pdf_text(ev.org_size or 'No especificado'))} · "
                    f"{xml_escape(sanitize_pdf_text(ev.target_timeline or 'Sin plazo definido'))}",
                    styles["td_left"],
                ),
            ],
            [
                Paragraph("CORTE CUARTIL (r_i)", styles["th_left"]),
                Paragraph(
                    f"<font face='Courier' size='7.5'>Q1={q1}  |  Q2={q2}  |  Q3={q3}  |  Q4={q4}</font>",
                    styles["td_left"],
                ),
                Paragraph("EVIDENCIA OPENALEX", styles["th_left"]),
                Paragraph(
                    f"{ctx['total_citations']} citas asignadas · {len(ctx['all_sources'])} referencias DOI",
                    styles["td_left"],
                ),
            ],
            [
                Paragraph("UUID DE EXPEDIENTE", styles["th_left"]),
                Paragraph(f"<font face='Courier' size='7.2'>{ev.uuid}</font>", styles["td_left"]),
                Paragraph("REPOSITORIO / ENLACE", styles["th_left"]),
                Paragraph(
                    xml_escape(sanitize_pdf_text(ev.software_repo_url or "No registrado"))[:52],
                    styles["td_muted"],
                ),
            ],
        ]
        repo_health = getattr(ev, "repo_health_metrics", None)
        if isinstance(repo_health, dict) and repo_health.get("status") == "ok":
            lic_lbl = xml_escape(sanitize_pdf_text(repo_health.get("license_spdx") or "Sin SPDX"))
            days_lbl = (
                f"{repo_health['days_since_last_push']}d"
                if repo_health.get("days_since_last_push") is not None
                else "N/D"
            )
            rel_tag = (repo_health.get("latest_release") or {}).get("tag_name") or "Sin release"
            contrib_lbl = repo_health.get("contributors_count") or "N/D"
            meta_rows.append([
                Paragraph("PULSO REPOSITORIO", styles["th_left"]),
                Paragraph(
                    f"<font face='Courier-Bold' size='7.3'>{repo_health.get('health_score', 0)}/100 "
                    f"({xml_escape(sanitize_pdf_text(repo_health.get('health_grade', '')))})</font> · "
                    f"Licencia {lic_lbl} · Últ. push {days_lbl}",
                    styles["td_left"],
                ),
                Paragraph("COMUNIDAD / RELEASE", styles["th_left"]),
                Paragraph(
                    f"Release {xml_escape(sanitize_pdf_text(str(rel_tag)))} · "
                    f"{repo_health.get('stars', 0)} stars · {contrib_lbl} contrib.",
                    styles["td_left"],
                ),
            ])
        meta_tbl = Table(meta_rows, colWidths=[W * 0.21, W * 0.29, W * 0.21, W * 0.29])
        meta_tbl.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, -1), 0.45, RULE_LIGHT),
            ("TOPPADDING", (0, 0), (-1, -1), 5.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        flow.append(meta_tbl)
        return flow

    # ── FOLIO 2: BRIEFING EJECUTIVO, GRÁFICO VECTORIAL Y TOPOGRAFÍA FODA ─────

    @classmethod
    def _build_executive_briefing(cls, ctx: dict, styles: dict) -> list:
        W = cls.CONTENT_W
        verdict = ctx["verdict"]
        rec_hex = ctx["rec_meta"]["hex"]
        flow = []

        # 1. Tira Tipográfica KPI (sin tarjetas grises encajonadas)
        kpi_cells = [
            [
                Paragraph("PONDERACIÓN MEDIA GLOBAL", styles["kpi_label"]),
                Paragraph("FACTORES RELEVANTES", styles["kpi_label"]),
                Paragraph("CUMPLIMIENTO (>= 3.00)", styles["kpi_label"]),
                Paragraph("EVIDENCIA BIBLIOGRÁFICA", styles["kpi_label"]),
            ],
            [
                Paragraph(
                    f"<font color='{rec_hex}'>{ctx['avg_pm']:.2f}</font>"
                    f"<font size='9' color='#71717A'> / 4.00</font>",
                    styles["kpi_value"],
                ),
                Paragraph(
                    f"{ctx['relevant_count']}"
                    f"<font size='9' color='#71717A'> / {ctx['total_factors']}</font>",
                    styles["kpi_value"],
                ),
                Paragraph(
                    f"{ctx['pass_rate_pct']:.1f}%",
                    styles["kpi_value"],
                ),
                Paragraph(
                    f"{ctx['total_citations']}"
                    f"<font size='9' color='#71717A'> citas</font>",
                    styles["kpi_value"],
                ),
            ],
            [
                Paragraph(f"Dictamen {ctx['rec_code']} · {ctx['rec_meta']['short']}", styles["kpi_sub"]),
                Paragraph(f"{ctx['total_factors'] - ctx['relevant_count']} descartados (IR=1)", styles["kpi_sub"]),
                Paragraph(f"{ctx['passed_count']} superan · {ctx['relevant_count'] - ctx['passed_count']} bajo umbral", styles["kpi_sub"]),
                Paragraph(f"{len(ctx['all_sources'])} documentos DOI indexados", styles["kpi_sub"]),
            ],
        ]
        kpi_tbl = Table(kpi_cells, colWidths=[W * 0.25] * 4)
        kpi_tbl.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 1.1, RULE_HEAVY),
            ("LINEBELOW", (0, -1), (-1, -1), 0.75, RULE_MED),
            ("LINEAFTER", (0, 0), (2, -1), 0.45, RULE_LIGHT),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
            ("TOPPADDING", (0, 1), (-1, 1), 1),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 2),
            ("TOPPADDING", (0, 2), (-1, 2), 0),
            ("BOTTOMPADDING", (0, 2), (-1, 2), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        flow.append(kpi_tbl)
        flow.append(Spacer(1, 14))

        # 2. Gráfico Vectorial Cleveland Dot-Bar contra Umbral 3.00
        if ctx["chart_entries"]:
            flow.append(
                build_section_header(
                    "01",
                    "PERFIL CUANTITATIVO POR FACTOR VS. UMBRAL (3.00)",
                    f"{len(ctx['chart_entries'])} FACTORES EVALUADOS",
                    W,
                    styles,
                )
            )
            flow.append(Spacer(1, 6))
            chart_entries = ctx["chart_entries"][:24]
            chart = build_factor_benchmark_chart(chart_entries, width=W)
            if chart:
                flow.append(chart)
            if len(ctx["chart_entries"]) > 24:
                flow.append(
                    Paragraph(
                        f"<i>Nota: el gráfico sintetiza los primeros 24 factores; el detalle completo figura en la Sección 03.</i>",
                        styles["td_muted"],
                    )
                )
            flow.append(Spacer(1, 12))

        # 3. Síntesis del Dictamen (prosa editorial abierta, sin caja gris)
        flow.append(
            build_section_header(
                "02",
                "SÍNTESIS EJECUTIVA DEL DICTAMEN",
                f"RECOMENDACIÓN {ctx['rec_code']}",
                W,
                styles,
            )
        )
        flow.append(Spacer(1, 6))
        ai_summary = (verdict.ai_executive_summary or "").strip() if verdict else ""
        narrative_src = ai_summary or (
            verdict.explanation_text if verdict else "Dictamen pendiente de cierre de evaluación."
        )
        flow.extend(parse_markdown_to_editorial_flowables(narrative_src, styles))
        flow.append(Spacer(1, 12))

        # 4. Topografía FODA (Barra de proporción + Matriz 2x2 de filetes limpios)
        flow.append(
            build_section_header(
                "03",
                "MATRIZ TOPOGRÁFICA FODA",
                "INTERNO / EXTERNO · CORTE 3.00",
                W,
                styles,
            )
        )
        flow.append(Spacer(1, 6))
        foda_counts = {k: len(v) for k, v in ctx["foda_buckets"].items()}
        flow.append(build_foda_quadrant_visual(foda_counts, width=W))
        flow.append(Spacer(1, 6))

        def _foda_quadrant_cell(title_lbl: str, subtitle_lbl: str, hex_accent: str, items: list):
            header = Paragraph(
                f"<font face='Courier-Bold' size='7.2' color='{hex_accent}'>{title_lbl}</font> "
                f"<font face='Helvetica' size='7' color='#71717A'>· {subtitle_lbl}</font>",
                styles["raw_left"],
            )
            if items:
                lines = [
                    f"<font color='{hex_accent}'><b>--</b></font> "
                    f"<b>{xml_escape(sanitize_pdf_text(ef.factor.name))}</b> "
                    f"<font face='Courier' size='6.8' color='#52525B'>(PM {pm:.2f} · IR {ef.relative_importance or '-'})</font>"
                    for ef, pm in items
                ]
                body = Paragraph("<br/>".join(lines), styles["foda_list"])
            else:
                body = Paragraph("<font color='#A1A1AA'>Sin factores clasificados en este cuadrante.</font>", styles["td_muted"])
            return [header, Spacer(1, 3), body]

        foda_tbl = Table(
            [
                [
                    _foda_quadrant_cell("FORTALEZAS (F)", "Interno >= 3.00", "#047857", ctx["foda_buckets"][EvaluationResult.FODA_STRENGTH]),
                    _foda_quadrant_cell("OPORTUNIDADES (O)", "Externo >= 3.00", "#1D4ED8", ctx["foda_buckets"][EvaluationResult.FODA_OPPORTUNITY]),
                ],
                [
                    _foda_quadrant_cell("DEBILIDADES (D)", "Interno < 3.00", "#B45309", ctx["foda_buckets"][EvaluationResult.FODA_WEAKNESS]),
                    _foda_quadrant_cell("AMENAZAS (A)", "Externo < 3.00", "#B91C1C", ctx["foda_buckets"][EvaluationResult.FODA_THREAT]),
                ],
            ],
            colWidths=[W * 0.5, W * 0.5],
        )
        foda_tbl.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (0, 0), 1.5, SEMANTIC_PASS),
            ("LINEABOVE", (1, 0), (1, 0), 1.5, SEMANTIC_OPP),
            ("LINEABOVE", (0, 1), (0, 1), 1.5, SEMANTIC_WARN),
            ("LINEABOVE", (1, 1), (1, 1), 1.5, SEMANTIC_FAIL),
            ("LINEBEFORE", (1, 0), (1, 1), 0.5, RULE_LIGHT),
            ("LINEBELOW", (0, 1), (1, 1), 0.5, RULE_LIGHT),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        flow.append(KeepTogether([foda_tbl]))
        return flow

    # ── FOLIOS 3+: AUDITORÍA CUANTITATIVA POR DIMENSIÓN Y SUBFACTORES ────────

    @classmethod
    def _build_quantitative_sections(cls, ctx: dict, styles: dict) -> list:
        W = cls.CONTENT_W
        flow = []

        flow.append(
            build_section_header(
                "03A",
                "AUDITORÍA CUANTITATIVA POR DIMENSIÓN",
                "ESCALA 1.00 - 4.00 · CORTE 3.00",
                W,
                styles,
            )
        )
        flow.append(Spacer(1, 8))

        for idx, dim_entry in enumerate(ctx["dimensions_ordered"], start=1):
            dim = dim_entry["dimension"]
            dim_pms = dim_entry["pms"]
            dim_avg = f"PM MEDIO {sum(dim_pms)/len(dim_pms):.2f}" if dim_pms else "SIN FACTORES RELEVANTES"

            dim_hdr = Table(
                [[
                    Paragraph(
                        f"<font face='Courier-Bold' size='7.5' color='#71717A'>DIM {idx:02d}</font>  "
                        f"<font face='Helvetica-Bold' size='10' color='#18181B'>{xml_escape(sanitize_pdf_text(dim.name))}</font>",
                        styles["raw_left"],
                    ),
                    Paragraph(
                        f"<font face='Courier-Bold' size='7.5' color='#18181B'>{dim_avg}</font>",
                        styles["raw_right"],
                    ),
                ]],
                colWidths=[W * 0.70, W * 0.30],
            )
            dim_hdr.setStyle(TableStyle([
                ("LINEABOVE", (0, 0), (-1, 0), 0.8, RULE_HEAVY),
                ("LINEBELOW", (0, 0), (-1, 0), 0.45, RULE_MED),
                ("BACKGROUND", (0, 0), (-1, 0), SURFACE_BAND),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))

            # Tabla de factores de la dimensión (sin rejilla vertical)
            factor_rows = [[
                Paragraph("FACTOR EVALUADO", styles["th_left"]),
                Paragraph("IR", styles["th_center"]),
                Paragraph("PM", styles["th_center"]),
                Paragraph("DIAGNÓSTICO", styles["th_center"]),
                Paragraph("CITAS", styles["th_right"]),
                Paragraph("r_i", styles["th_right"]),
                Paragraph("IL", styles["th_center"]),
                Paragraph("ID", styles["th_center"]),
                Paragraph("IS", styles["th_center"]),
            ]]
            row_styles = [
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, RULE_HEAVY),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]

            subfactor_rows = []
            for r_idx, (ef, res) in enumerate(dim_entry["factors"], start=1):
                ir_val = ef.relative_importance if ef.relative_importance is not None else "-"
                ratio_val = f"{float(ef.citation_ratio):.2f}" if ef.citation_ratio is not None else "0.00"
                il_val = str(ef.literature_importance_calculated or "-")
                id_val = str(ef.decisor_importance or "-")
                is_val = str(ef.systemic_importance_snapshot or "-")
                citas_val = str(ef.citations_count or 0)

                if not ef.is_relevant:
                    pm_html = "<font color='#A1A1AA'>--</font>"
                    foda_html = "<font color='#A1A1AA' size='7'>No relevante</font>"
                elif res and res.weighted_average is not None:
                    pm_num = float(res.weighted_average)
                    meets = bool(res.meets_threshold)
                    pm_color = "#047857" if meets else "#B91C1C"
                    pm_html = f"<font color='{pm_color}'><b>{pm_num:.2f}</b></font>"
                    foda_txt = xml_escape(sanitize_pdf_text(res.get_foda_classification_display()))
                    foda_color = {
                        EvaluationResult.FODA_STRENGTH: "#047857",
                        EvaluationResult.FODA_OPPORTUNITY: "#1D4ED8",
                        EvaluationResult.FODA_WEAKNESS: "#B45309",
                        EvaluationResult.FODA_THREAT: "#B91C1C",
                    }.get(res.foda_classification, "#3F3F46")
                    foda_html = f"<font color='{foda_color}' size='7.3'><b>{foda_txt}</b></font>"
                    if not meets:
                        row_styles.append(("BACKGROUND", (0, r_idx), (-1, r_idx), SEMANTIC_FAIL_BG))
                else:
                    pm_html = "--"
                    foda_html = "<font color='#71717A'>Pendiente</font>"

                factor_rows.append([
                    Paragraph(f"<b>{xml_escape(sanitize_pdf_text(ef.factor.name))}</b>", styles["td_left"]),
                    Paragraph(str(ir_val), styles["td_mono_center"]),
                    Paragraph(pm_html, styles["td_mono_center"]),
                    Paragraph(foda_html, styles["raw_center"]),
                    Paragraph(citas_val, styles["td_mono_right"]),
                    Paragraph(ratio_val, styles["td_mono_right"]),
                    Paragraph(il_val, styles["td_mono_center"]),
                    Paragraph(id_val, styles["td_mono_center"]),
                    Paragraph(is_val, styles["td_mono_center"]),
                ])
                row_styles.append(("LINEBELOW", (0, r_idx), (-1, r_idx), 0.4, RULE_LIGHT))

                # Subfactores del factor
                for esf in ctx["subfactors_by_factor"].get(ef.factor_id, []):
                    code, lbl, r_hex = cls.RATING_LABELS.get(esf.rating, ("--", "Sin calificar", "#71717A"))
                    sub_desc = xml_escape(sanitize_pdf_text(esf.description_snapshot or ""))
                    cites_tag = (
                        f" <font face='Courier' size='6.3' color='#71717A'>[Citas IA: {esf.ai_citations_count}]</font>"
                        if esf.ai_citations_count
                        else ""
                    )
                    subfactor_rows.append([
                        Paragraph(xml_escape(sanitize_pdf_text(ef.factor.name)), styles["td_muted"]),
                        Paragraph(f"{sub_desc}{cites_tag}", styles["td_left"]),
                        Paragraph(
                            f"<font face='Courier-Bold' size='7' color='{r_hex}'>[{code}]</font> "
                            f"<font size='7' color='{r_hex}'>{lbl}</font>",
                            styles["raw_left"],
                        ),
                    ])

            col_w = [
                W * 0.28, W * 0.06, W * 0.08, W * 0.16,
                W * 0.08, W * 0.09, W * 0.08, W * 0.08, W * 0.09,
            ]
            f_tbl = Table(factor_rows, colWidths=col_w, repeatRows=1)
            f_tbl.setStyle(TableStyle(row_styles))

            flow.append(KeepTogether([dim_hdr, f_tbl]))
            flow.append(Spacer(1, 6))

            if subfactor_rows:
                sf_header = [
                    Paragraph("FACTOR", styles["th_left"]),
                    Paragraph("CRITERIO / SUBFACTOR EVALUADO", styles["th_left"]),
                    Paragraph("CALIFICACIÓN", styles["th_left"]),
                ]
                sf_tbl = Table(
                    [sf_header] + subfactor_rows,
                    colWidths=[W * 0.22, W * 0.62, W * 0.16],
                    repeatRows=1,
                )
                sf_tbl.setStyle(TableStyle([
                    ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE_MED),
                    ("LINEBELOW", (0, 1), (-1, -1), 0.35, RULE_LIGHT),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [PAPER_WHITE, SURFACE_ALT]),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]))
                flow.append(sf_tbl)
                flow.append(Spacer(1, 14))

        return flow

    # ── SECCIÓN 04: PLAN DE MITIGACIÓN Y GOBERNANZA ──────────────────────────

    @classmethod
    def _build_mitigation_section(cls, ctx: dict, styles: dict) -> list:
        verdict = ctx["verdict"]
        W = cls.CONTENT_W

        mitigation_text = (verdict.ai_mitigation_plan or "").strip() if verdict else ""
        rows_by_factor = parse_mitigation_plan_sections(mitigation_text)

        neg_factors = []
        for ef in ctx["factors_qs"]:
            res = ctx["results_map"].get(ef.factor_id)
            if ef.is_relevant and res and not res.meets_threshold:
                neg_factors.append((ef, res))

        if not neg_factors and not rows_by_factor and not mitigation_text:
            return []

        flow = [
            build_section_header(
                "04",
                "PLAN DE MITIGACIÓN Y GOBERNANZA",
                f"{len(neg_factors)} BRECHAS BAJO UMBRAL" if neg_factors else "VIGILANCIA PREVENTIVA",
                W,
                styles,
            ),
            Spacer(1, 8),
        ]

        # Normalizar conjunto de filas a mostrar (brechas reales + filas estructuradas extra)
        render_items = []
        seen_names = set()
        for ef, res in neg_factors:
            fname_key = _fold_label(ef.factor.name)
            seen_names.add(fname_key)
            matched = rows_by_factor.get(fname_key, {})
            pm = float(res.weighted_average)
            is_threat = res.foda_classification == EvaluationResult.FODA_THREAT
            foda_label = "AMENAZA" if is_threat else "DEBILIDAD"
            badge_hex = "#B91C1C" if is_threat else "#B45309"

            render_items.append({
                "factor": ef.factor.name,
                "meta_line": f"{foda_label} · PM {pm:.2f} · IR {ef.relative_importance or '-'}",
                "badge_hex": badge_hex,
                "riesgo": matched.get("riesgo_metodologico")
                or f"Desviación técnica en {ef.factor.name} (PM {pm:.2f} < 3.00).",
                "accion": matched.get("accion_correctiva")
                or f"Ejecutar piloto técnico o adecuación operativa sobre {ef.factor.name}.",
                "responsable": matched.get("responsable")
                or default_responsible_for_factor(
                    ef.factor.name,
                    dimension=ef.factor.dimension.name,
                    scope=ef.factor.scope,
                ),
                "meta": matched.get("meta_aprobacion")
                or f"Reevaluar {ef.factor.name} hasta alcanzar PM >= 3.00.",
            })

        # Si todos superaron el umbral pero hay vigilancia preventiva estructurada
        if not neg_factors and rows_by_factor:
            for f_key, srow in rows_by_factor.items():
                fname = str(srow.get("factor", "")).strip()
                if not fname or f_key in seen_names:
                    continue
                render_items.append({
                    "factor": fname,
                    "meta_line": "VIGILANCIA PREVENTIVA · PM >= 3.00",
                    "badge_hex": "#047857",
                    "riesgo": srow.get("riesgo_metodologico", ""),
                    "accion": srow.get("accion_correctiva", ""),
                    "responsable": srow.get("responsable") or "Arquitectura TI",
                    "meta": srow.get("meta_aprobacion") or "Mantener PM >= 3.00 en producción.",
                })

        if render_items:
            table_rows = [[
                Paragraph("FACTOR / BRECHA", styles["th_left"]),
                Paragraph("RIESGO METODOLÓGICO", styles["th_left"]),
                Paragraph("ACCIÓN CORRECTIVA", styles["th_left"]),
                Paragraph("RESPONSABLE", styles["th_left"]),
                Paragraph("META DE APROBACIÓN", styles["th_left"]),
            ]]
            for item in render_items:
                table_rows.append([
                    Paragraph(
                        f"<b>{xml_escape(sanitize_pdf_text(item['factor']))}</b><br/>"
                        f"<font face='Courier-Bold' size='6.3' color='{item['badge_hex']}'>"
                        f"{xml_escape(sanitize_pdf_text(item['meta_line']))}</font>",
                        styles["td_left"],
                    ),
                    Paragraph(xml_escape(sanitize_pdf_text(item["riesgo"])), styles["td_left"]),
                    Paragraph(xml_escape(sanitize_pdf_text(item["accion"])), styles["td_left"]),
                    Paragraph(f"<b>{xml_escape(sanitize_pdf_text(item['responsable']))}</b>", styles["td_left"]),
                    Paragraph(
                        f"<font color='#047857'>{xml_escape(sanitize_pdf_text(item['meta']))}</font>",
                        styles["td_left"],
                    ),
                ])

            mit_tbl = Table(
                table_rows,
                colWidths=[W * 0.20, W * 0.23, W * 0.25, W * 0.14, W * 0.18],
                repeatRows=1,
            )
            mit_tbl.setStyle(TableStyle([
                ("LINEABOVE", (0, 0), (-1, 0), 1.0, RULE_HEAVY),
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, RULE_HEAVY),
                ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE_LIGHT),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [PAPER_WHITE, SURFACE_ALT]),
                ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            flow.append(mit_tbl)
            flow.append(Spacer(1, 10))
        elif mitigation_text:
            flow.extend(parse_markdown_to_editorial_flowables(mitigation_text, styles))

        return flow

    # ── SECCIÓN 05: BIBLIOGRAFÍA OPENALEX Y COLOFÓN DE INTEGRIDAD ────────────

    @classmethod
    def _build_literature_appendix(cls, ctx: dict, styles: dict) -> list:
        ev = ctx["evaluation"]
        W = cls.CONTENT_W
        flow = [
            build_section_header(
                "05",
                "EVIDENCIA CIENTÍFICA INDEXADA (OPENALEX)",
                f"{len(ctx['all_sources'])} REFERENCIAS DOI",
                W,
                styles,
            ),
            Spacer(1, 6),
        ]

        q1 = ev.q1_threshold or "--"
        q2 = ev.q2_threshold or "--"
        q3 = ev.q3_threshold or "--"
        q4 = ev.q4_threshold or "--"
        flow.append(
            Paragraph(
                f"<font face='Courier' size='7.2' color='#52525B'>"
                f"UMBRALES CUARTÍLICOS r_i = TC/NS:  Q1={q1}  ·  Q2={q2}  ·  Q3={q3}  ·  Q4={q4}"
                f"</font>",
                styles["raw_left"],
            )
        )
        flow.append(Spacer(1, 8))

        if ctx["all_sources"]:
            src_rows = [[
                Paragraph("REF", styles["th_center"]),
                Paragraph("FACTOR", styles["th_left"]),
                Paragraph("PUBLICACIÓN ACADÉMICA Y EXTRACTO", styles["th_left"]),
                Paragraph("DOI", styles["th_right"]),
            ]]
            for idx, src in enumerate(ctx["all_sources"], start=1):
                safe_title = xml_escape(sanitize_pdf_text(src["title"]))
                title_html = f"<b>{safe_title}</b>"
                if src["snippet"]:
                    safe_snippet = xml_escape(sanitize_pdf_text(src["snippet"][:180]))
                    title_html += f"<br/><font color='#71717A' size='6.8'>{safe_snippet}...</font>"

                doi_clean = xml_escape(sanitize_pdf_text(src["doi"]))
                doi_html = (
                    f"<a href='https://doi.org/{doi_clean}' color='#1D4ED8'><u>{doi_clean}</u></a>"
                    if doi_clean
                    else "<font color='#A1A1AA'>--</font>"
                )

                src_rows.append([
                    Paragraph(f"[{idx:02d}]", styles["td_mono_center"]),
                    Paragraph(xml_escape(sanitize_pdf_text(src["factor"])), styles["td_left"]),
                    Paragraph(title_html, styles["td_left"]),
                    Paragraph(doi_html, styles["raw_right"]),
                ])

            src_tbl = Table(
                src_rows,
                colWidths=[W * 0.07, W * 0.21, W * 0.50, W * 0.22],
                repeatRows=1,
            )
            src_tbl.setStyle(TableStyle([
                ("LINEABOVE", (0, 0), (-1, 0), 1.0, RULE_HEAVY),
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, RULE_HEAVY),
                ("LINEBELOW", (0, 1), (-1, -1), 0.35, RULE_LIGHT),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [PAPER_WHITE, SURFACE_ALT]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            flow.append(src_tbl)
        else:
            flow.append(
                Paragraph(
                    "<i>No se registraron referencias bibliográficas indexadas con DOI en esta sesión.</i>",
                    styles["td_muted"],
                )
            )

        flow.append(Spacer(1, 18))

        # Colofón minimalista de integridad criptográfica (sin caja gris anidada)
        colophon = Table(
            [
                [
                    Paragraph(
                        "<font face='Courier-Bold' size='7' color='#18181B'>REGISTRO DE INTEGRIDAD DE EXPEDIENTE</font>",
                        styles["raw_left"],
                    ),
                    Paragraph(
                        f"<font face='Courier' size='6.8' color='#71717A'>EMISIÓN: {xml_escape(ctx['emission_str'])}</font>",
                        styles["raw_right"],
                    ),
                ],
                [
                    Paragraph(
                        f"<font face='Courier' size='6.5' color='#52525B'>UUID: {ev.uuid}</font>",
                        styles["raw_left"],
                    ),
                    Paragraph(
                        f"<font face='Courier' size='6.5' color='#52525B'>SHA256: {ctx['expediente_hash']}</font>",
                        styles["raw_right"],
                    ),
                ],
            ],
            colWidths=[W * 0.58, W * 0.42],
        )
        colophon.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 1.1, RULE_HEAVY),
            ("LINEBELOW", (0, -1), (-1, -1), 0.5, RULE_MED),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        flow.append(KeepTogether([colophon]))
        return flow
