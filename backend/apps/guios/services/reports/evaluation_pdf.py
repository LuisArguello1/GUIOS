"""
apps/guios/services/reports/evaluation_pdf.py
─────────────────────────────────────────────────────────────────────────────
Generador de Dossier Técnico de Evaluación en PDF para GUIOS.
Genera el informe exhaustivo con cuartiles, factores, subfactores, FODA y dictamen final.
"""
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from apps.guios.models import Evaluation

# Paleta GUIOS
COLOR_PRIMARY = colors.HexColor('#059669')       # Verde Menta
COLOR_PRIMARY_DARK = colors.HexColor('#065f46')
COLOR_BG_LIGHT = colors.HexColor('#F8F8F9')
COLOR_BORDER = colors.HexColor('#E2E2E6')
COLOR_TEXT_PRIMARY = colors.HexColor('#161823')
COLOR_TEXT_MUTED = colors.HexColor('#5B5D68')
COLOR_WHITE = colors.HexColor('#FFFFFF')
COLOR_REC_A = colors.HexColor('#059669')
COLOR_REC_B = colors.HexColor('#D97706')
COLOR_REC_C = colors.HexColor('#DC2626')


class EvaluationPDFReport:
    """Generador institucional de informe técnico de evaluación individual en PDF."""

    @classmethod
    def generate(cls, evaluation: Evaluation) -> io.BytesIO:
        buffer = io.BytesIO()

        PAGE_W, PAGE_H = A4
        MARGIN = 1.5 * cm
        CONTENT_W = PAGE_W - (2 * MARGIN)

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=MARGIN,
            leftMargin=MARGIN,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm,
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=18,
            textColor=COLOR_PRIMARY_DARK,
        )

        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=COLOR_TEXT_MUTED,
        )

        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            textColor=COLOR_PRIMARY_DARK,
            spaceAfter=4,
        )

        body_p = ParagraphStyle(
            'BodyP',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=12,
            textColor=COLOR_TEXT_PRIMARY,
            alignment=TA_JUSTIFY,
        )

        cell_header = ParagraphStyle(
            'CellHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_WHITE,
            alignment=TA_LEFT,
        )

        cell_header_center = ParagraphStyle(
            'CellHeaderCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_WHITE,
            alignment=TA_CENTER,
        )

        cell_body = ParagraphStyle(
            'CellBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_PRIMARY,
        )

        cell_body_center = ParagraphStyle(
            'CellBodyCenter',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9.5,
            textColor=COLOR_TEXT_PRIMARY,
            alignment=TA_CENTER,
        )

        story = []

        # ── Encabezado Institucional ──────────────────────────────────────────
        header_table = Table(
            [
                [
                    Paragraph(f"GUIOS — DOSSIER DE EVALUACIÓN: {evaluation.software_name}", title_style),
                    Paragraph(datetime.now().strftime("%d/%m/%Y"), subtitle_style),
                ],
                [
                    Paragraph(f"Organización: {evaluation.org_name} ({evaluation.org_sector})", subtitle_style),
                    Paragraph(f"Sesión #{evaluation.id}", subtitle_style),
                ],
            ],
            colWidths=[CONTENT_W * 0.75, CONTENT_W * 0.25],
        )
        header_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY, spaceAfter=8))

        # ── 1. Ficha del Software Candidato ───────────────────────────────────
        meta_rows = [
            [
                Paragraph("<b>Software Candidato:</b>", cell_body),
                Paragraph(f"{evaluation.software_name} v{evaluation.software_version or 'N/A'}", cell_body),
                Paragraph("<b>Categoría:</b>", cell_body),
                Paragraph(evaluation.software_category or 'General', cell_body),
            ],
            [
                Paragraph("<b>Organización:</b>", cell_body),
                Paragraph(evaluation.org_name, cell_body),
                Paragraph("<b>Sector:</b>", cell_body),
                Paragraph(evaluation.org_sector or 'No especificado', cell_body),
            ],
            [
                Paragraph("<b>Repositorio / Web:</b>", cell_body),
                Paragraph(evaluation.software_repo_url or 'No registrado', cell_body),
                Paragraph("<b>Estado Metodológico:</b>", cell_body),
                Paragraph(evaluation.get_status_display(), cell_body),
            ],
        ]
        meta_table = Table(meta_rows, colWidths=[CONTENT_W * 0.20, CONTENT_W * 0.35, CONTENT_W * 0.20, CONTENT_W * 0.25])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 10))

        # ── 2. Veredicto Final y Recomendación A/B/C ──────────────────────────
        verdict = getattr(evaluation, 'verdict', None)
        if verdict:
            rec_code = verdict.recommendation
            rec_color = COLOR_REC_A if rec_code == 'A' else (COLOR_REC_B if rec_code == 'B' else COLOR_REC_C)
            rec_title = f"RECOMENDACIÓN FINAL: {rec_code} — {verdict.get_recommendation_display()}"

            verdict_box = Table(
                [
                    [Paragraph(f"<b>{rec_title}</b>", ParagraphStyle('VTitle', parent=cell_header, fontSize=10, textColor=COLOR_WHITE))],
                    [Paragraph(verdict.explanation_text or 'Sin explicación detallada.', ParagraphStyle('VExp', parent=body_p, fontSize=8))],
                ],
                colWidths=[CONTENT_W],
            )
            verdict_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), rec_color),
                ('BACKGROUND', (0, 1), (-1, 1), COLOR_BG_LIGHT),
                ('BOX', (0, 0), (-1, -1), 1, rec_color),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(verdict_box)
            story.append(Spacer(1, 10))

        # ── 3. Tabla de Factores Evaluados y Métricas GUIOS ───────────────────
        story.append(Paragraph("Evaluación Ponderada de Factores (IL, ID, IS, PE, P)", section_heading))

        factor_rows = [
            [
                Paragraph("Dimensión", cell_header),
                Paragraph("Factor Metodológico", cell_header),
                Paragraph("Citas (c_i)", cell_header_center),
                Paragraph("Ratio (r_i)", cell_header_center),
                Paragraph("IL", cell_header_center),
                Paragraph("ID", cell_header_center),
                Paragraph("IS", cell_header_center),
                Paragraph("IR", cell_header_center),
                Paragraph("PM", cell_header_center),
                Paragraph("FODA", cell_header_center),
            ]
        ]

        results_by_factor = {er.factor_id: er for er in evaluation.evaluation_results.all()}
        factors_qs = (
            evaluation.evaluation_factors.select_related('factor__dimension')
            .order_by('factor__dimension__order', 'factor__order', 'factor__id')
        )

        for ef in factors_qs:
            res = results_by_factor.get(ef.factor_id)
            foda_val = res.get_foda_classification_display() if res else ("No relevante" if ef.is_relevant is False else "-")
            ci = str(ef.citations_count) if ef.citations_count is not None else '-'
            ri = f"{ef.citation_ratio:.2f}" if ef.citation_ratio is not None else '-'
            il = str(ef.literature_importance_calculated) if ef.literature_importance_calculated is not None else '-'
            did = str(ef.decisor_importance) if ef.decisor_importance is not None else '-'
            is_val = str(ef.systemic_importance_snapshot) if ef.systemic_importance_snapshot is not None else '-'
            ir_val = str(ef.relative_importance) if ef.relative_importance is not None else '-'
            pe = f"<b>{res.weighted_average:.2f}</b>" if res and res.weighted_average is not None else '-'

            factor_rows.append([
                Paragraph(ef.factor.dimension.name, cell_body),
                Paragraph(ef.factor.name, cell_body),
                Paragraph(ci, cell_body_center),
                Paragraph(ri, cell_body_center),
                Paragraph(il, cell_body_center),
                Paragraph(did, cell_body_center),
                Paragraph(is_val, cell_body_center),
                Paragraph(ir_val, cell_body_center),
                Paragraph(pe, cell_body_center),
                Paragraph(foda_val, cell_body_center),
            ])

        factor_table = Table(
            factor_rows,
            colWidths=[
                CONTENT_W * 0.16,
                CONTENT_W * 0.24,
                CONTENT_W * 0.07,
                CONTENT_W * 0.07,
                CONTENT_W * 0.06,
                CONTENT_W * 0.06,
                CONTENT_W * 0.06,
                CONTENT_W * 0.08,
                CONTENT_W * 0.10,
                CONTENT_W * 0.10,
            ],
        )
        factor_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_DARK),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_LIGHT]),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(factor_table)
        story.append(Spacer(1, 12))

        # ── 4. Resumen Ejecutivo y Plan de Mitigación (IA) ─────────────────────
        if verdict and (verdict.ai_executive_summary or verdict.ai_mitigation_plan):
            story.append(KeepTogether([
                Paragraph("Diagnóstico Ejecutivo y Plan de Mitigación Recomendado", section_heading),
                Paragraph(verdict.ai_executive_summary or 'Sin resumen ejecutivo generado.', body_p),
                Spacer(1, 6),
                Paragraph("<b>Acciones Correctivas y Mitigación:</b>", cell_body),
                Paragraph(verdict.ai_mitigation_plan or 'Sin plan de mitigación registrado.', body_p),
            ]))

        # Pie
        story.append(Spacer(1, 14))
        story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER, spaceAfter=6))
        story.append(Paragraph(
            f"Informe técnico oficial emitido por la plataforma GUIOS. Sesión #{evaluation.id} | Software: {evaluation.software_name}",
            subtitle_style,
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer
