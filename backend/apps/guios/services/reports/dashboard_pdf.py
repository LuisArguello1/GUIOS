"""
apps/guios/services/reports/dashboard_pdf.py
─────────────────────────────────────────────────────────────────────────────
Generador de Reportes Ejecutivos en PDF para el Dashboard de GUIOS.
Construido con ReportLab aplicando la identidad corporativa institucional (Verde Menta).
"""
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

# Paleta GUIOS (Verde Menta institucional)
COLOR_PRIMARY = colors.HexColor('#059669')       # Verde Menta
COLOR_PRIMARY_DARK = colors.HexColor('#065f46')  # Verde Profundo
COLOR_SECONDARY = colors.HexColor('#10b981')
COLOR_BG_LIGHT = colors.HexColor('#F8F8F9')
COLOR_BG_SOFT = colors.HexColor('#ECFDF5')       # Fondo suave verde
COLOR_BORDER = colors.HexColor('#E2E2E6')
COLOR_TEXT_PRIMARY = colors.HexColor('#161823')
COLOR_TEXT_MUTED = colors.HexColor('#5B5D68')
COLOR_WHITE = colors.HexColor('#FFFFFF')
COLOR_SUCCESS = colors.HexColor('#059669')
COLOR_WARNING = colors.HexColor('#D97706')
COLOR_DANGER = colors.HexColor('#DC2626')


class DashboardPDFReport:
    """Generador institucional de informe ejecutivo consolidado en PDF."""

    @classmethod
    def generate(cls, stats: dict) -> io.BytesIO:
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

        # Estilos tipográficos
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=20,
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

        cell_header = ParagraphStyle(
            'CellHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=COLOR_WHITE,
            alignment=TA_LEFT,
        )

        cell_header_center = ParagraphStyle(
            'CellHeaderCenter',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=COLOR_WHITE,
            alignment=TA_CENTER,
        )

        cell_body = ParagraphStyle(
            'CellBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=COLOR_TEXT_PRIMARY,
        )

        cell_body_center = ParagraphStyle(
            'CellBodyCenter',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=COLOR_TEXT_PRIMARY,
            alignment=TA_CENTER,
        )

        kpi_value_style = ParagraphStyle(
            'KPIValue',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=16,
            textColor=COLOR_PRIMARY,
            alignment=TA_CENTER,
        )

        kpi_label_style = ParagraphStyle(
            'KPILabel',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=COLOR_TEXT_MUTED,
            alignment=TA_CENTER,
        )

        story = []

        # ── Encabezado Institucional ──────────────────────────────────────────
        header_table = Table(
            [
                [
                    Paragraph("GUIOS — METODOLOGÍA DE ADOPCIÓN FLOSS", title_style),
                    Paragraph(datetime.now().strftime("%d/%m/%Y %H:%M"), subtitle_style),
                ],
                [
                    Paragraph("Reporte Ejecutivo de Evaluación y Cartera de Software Libre", subtitle_style),
                    Paragraph("Informe Consolidado", subtitle_style),
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
        story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY, spaceAfter=10))

        # ── 1. Cuadrícula de KPIs Ejecutivos ──────────────────────────────────
        kpis = stats.get('kpis', {})
        kpi_boxes = [
            [
                Paragraph(str(kpis.get('total_evaluations', 0)), kpi_value_style),
                Paragraph(f"{kpis.get('adoption_viability_rate', 0)}%", kpi_value_style),
                Paragraph(f"{kpis.get('foda_ratio', 0.0)}", kpi_value_style),
                Paragraph(f"{kpis.get('ai_avg_latency_ms', 0)} ms", kpi_value_style),
            ],
            [
                Paragraph("TOTAL EVALUACIONES", kpi_label_style),
                Paragraph("TASA DE VIABILIDAD (A+B)", kpi_label_style),
                Paragraph("RATIO SALUD FODA (F/D)", kpi_label_style),
                Paragraph("LATENCIA MEDIA IA", kpi_label_style),
            ],
        ]
        kpi_table = Table(kpi_boxes, colWidths=[CONTENT_W / 4] * 4)
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 1, COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 1), (-1, 1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 12))

        # ── 2. Distribución de Recomendaciones y Balance FODA ─────────────────
        story.append(Paragraph("1. Dictamen de Adopción y Distribución Metodológica", section_heading))

        verdict_rows = [
            [
                Paragraph("Dictamen", cell_header),
                Paragraph("Criterio Metodológico", cell_header),
                Paragraph("Evaluaciones", cell_header_center),
            ]
        ]
        for v in stats.get('verdict_distribution', []):
            rec = v.get('recommendation', '')
            count = v.get('count', 0)
            label = v.get('label', '')
            verdict_rows.append([
                Paragraph(f"<b>Recomendación {rec}</b>", cell_body),
                Paragraph(label, cell_body),
                Paragraph(str(count), cell_body_center),
            ])

        verdict_table = Table(verdict_rows, colWidths=[CONTENT_W * 0.25, CONTENT_W * 0.55, CONTENT_W * 0.20])
        verdict_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_LIGHT]),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(verdict_table)
        story.append(Spacer(1, 12))

        # ── 3. Rendimiento por Dimensión ──────────────────────────────────────
        story.append(Paragraph("2. Rendimiento Promedio por Dimensión GUIOS (Escala 1 a 4)", section_heading))

        dim_rows = [
            [
                Paragraph("Dimensión Evaluada", cell_header),
                Paragraph("Factores Muestreados", cell_header_center),
                Paragraph("Puntaje Promedio (PE)", cell_header_center),
                Paragraph("Diagnóstico General", cell_header),
            ]
        ]
        for d in stats.get('dimension_averages', []):
            score = d.get('avg_score', 0.0)
            diag = "Cumplimiento Óptimo" if score >= 3.0 else ("Cumplimiento Parcial" if score >= 2.0 else "Riesgo de Adopción")
            dim_rows.append([
                Paragraph(d.get('name', ''), cell_body),
                Paragraph(str(d.get('sample_count', 0)), cell_body_center),
                Paragraph(f"<b>{score:.2f} / 4.00</b>", cell_body_center),
                Paragraph(diag, cell_body),
            ])

        dim_table = Table(dim_rows, colWidths=[CONTENT_W * 0.35, CONTENT_W * 0.20, CONTENT_W * 0.20, CONTENT_W * 0.25])
        dim_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_DARK),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_LIGHT]),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(dim_table)
        story.append(Spacer(1, 12))

        # ── 4. Evaluaciones Recientes / Top Software ──────────────────────────
        recent = stats.get('recent_evaluations', [])
        if recent:
            story.append(KeepTogether([
                Paragraph("3. Registro Reciente de Evaluaciones en la Plataforma", section_heading),
                cls._build_recent_table(recent, CONTENT_W, cell_header, cell_header_center, cell_body, cell_body_center),
            ]))

        # ── Pie de Página y Firma ─────────────────────────────────────────────
        story.append(Spacer(1, 14))
        story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER, spaceAfter=6))
        footer_p = Paragraph(
            "Documento generado automáticamente por el Sistema GUIOS. "
            "Basado en la metodología de tesis doctoral (Rea Sánchez, 2022). "
            "Válido para auditorías de adopción tecnológica y comités de TI.",
            subtitle_style,
        )
        story.append(footer_p)

        doc.build(story)
        buffer.seek(0)
        return buffer

    @classmethod
    def _build_recent_table(cls, recent, content_w, cell_header, cell_header_center, cell_body, cell_body_center):
        rows = [
            [
                Paragraph("Software Candidato", cell_header),
                Paragraph("Categoría", cell_header),
                Paragraph("Organización", cell_header),
                Paragraph("Estado", cell_header_center),
                Paragraph("Veredicto", cell_header_center),
            ]
        ]
        for item in recent:
            rec = item.get('recommendation')
            rec_text = f"Rec. {rec}" if rec else "En Progreso"
            rows.append([
                Paragraph(f"<b>{item.get('software_name', '')}</b> v{item.get('software_version') or ''}", cell_body),
                Paragraph(item.get('software_category') or 'General', cell_body),
                Paragraph(item.get('org_name') or 'N/A', cell_body),
                Paragraph(item.get('status_display') or '', cell_body_center),
                Paragraph(rec_text, cell_body_center),
            ])

        table = Table(rows, colWidths=[content_w * 0.28, content_w * 0.20, content_w * 0.24, content_w * 0.16, content_w * 0.12])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_LIGHT]),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        return table
