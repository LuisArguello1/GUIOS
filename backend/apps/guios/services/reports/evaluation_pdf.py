"""
apps/guios/services/reports/evaluation_pdf.py
─────────────────────────────────────────────────────────────────────────────
Generador de Dossier Técnico y Dictamen Oficial de Evaluación en PDF para GUIOS.
Diseñado con arquitectura editorial de grado ejecutivo:
- Portada institucional con Sello Oficial de Dictamen (A/B/C) y logotipo corporativo.
- Paginación dinámica Two-Pass NumberedCanvas ('Página X de Y') y running headers/footers.
- Resumen Ejecutivo con KPIs cuantitativos sin solapamientos tipográficos.
- Parser de texto Markdown para diagnósticos y mitigaciones de IA (sin '##' ni texto pegado).
- Sanitización estricta de caracteres Unicode incompatibles (elimina cajas negras como 'on■premise').
- Matriz FODA 2x2 gráfica consolidada y perfectamente integrada en la página ejecutiva.
- Scorecard detallado agrupado por Dimensión y auditoría de afirmaciones técnicas (subfactores) con repeatRows=1.
- Plan de Mitigación estructurado para brechas metodológicas y factores desfavorables.
- Índice de evidencias bibliográficas científicas indexadas con enlaces DOI (OpenAlex).
- Bloque formal de firmas institucionales con filetes vectoriales y sello de integridad criptográfica.
"""
import io
import os
import hashlib
import re
from datetime import datetime
from xml.sax.saxutils import escape as xml_escape

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
    PageBreak,
    Image,
)
from reportlab.pdfgen import canvas
from django.conf import settings
from apps.guios.models import Evaluation

# ── PALETA CROMÁTICA CORPORATIVA GUIOS PRO ────────────────────────────────────
COLOR_PRIMARY_DARK = colors.HexColor('#064E3B')    # Verde Esmeralda Profundo (Títulos & Headers)
COLOR_PRIMARY = colors.HexColor('#059669')         # Verde Menta GUIOS
COLOR_PRIMARY_LIGHT = colors.HexColor('#ECFDF5')   # Verde Suave (Fondos destacados)
COLOR_SECONDARY = colors.HexColor('#0D9488')       # Verde Azulado / Teal
COLOR_BORDER = colors.HexColor('#CBD5E1')          # Borde gris neutro (Slate 300)
COLOR_BORDER_LIGHT = colors.HexColor('#E2E8F0')    # Borde sutil (Slate 200)
COLOR_BG_PAGE = colors.HexColor('#F8FAFC')         # Fondo de filas alternas (Slate 50)
COLOR_TEXT_PRIMARY = colors.HexColor('#0F172A')    # Texto principal (Slate 900)
COLOR_TEXT_MUTED = colors.HexColor('#475569')      # Texto secundario (Slate 600)
COLOR_TEXT_LIGHT = colors.HexColor('#94A3B8')      # Texto terciario (Slate 400)
COLOR_WHITE = colors.HexColor('#FFFFFF')

# Colores de Dictamen y Cuadrantes FODA
COLOR_REC_A = colors.HexColor('#059669')          # Esmeralda (Recomendación A / Fortalezas)
COLOR_REC_A_BG = colors.HexColor('#ECFDF5')
COLOR_REC_B = colors.HexColor('#D97706')          # Ámbar (Recomendación B / Debilidades)
COLOR_REC_B_BG = colors.HexColor('#FFFBEB')
COLOR_REC_C = colors.HexColor('#DC2626')          # Rojo Carmín (Recomendación C / Amenazas)
COLOR_REC_C_BG = colors.HexColor('#FEF2F2')
COLOR_FODA_O = colors.HexColor('#0284C7')         # Azul Cielo (Oportunidades)
COLOR_FODA_O_BG = colors.HexColor('#F0F9FF')


def sanitize_pdf_text(text: str) -> str:
    """
    Reemplaza caracteres Unicode especiales no soportados por las fuentes Type 1
    estándar de ReportLab (como el guion no divisible \u2011 que genera cajas negras '■').
    """
    if not text:
        return ""
    replacements = {
        '\u2011': '-',    # non-breaking hyphen (causante del black box on■premise)
        '\u2010': '-',    # hyphen
        '\u2012': '-',    # figure dash
        '\u2013': '-',    # en dash
        '\u2014': ' - ',  # em dash
        '\u2018': "'",    # left single quote
        '\u2019': "'",    # right single quote
        '\u201c': '"',    # left double quote
        '\u201d': '"',    # right double quote
        '\u2026': '...',  # ellipsis
        '\u2265': '>=',   # greater or equal
        '\u2264': '<=',   # less or equal
        '\xa0': ' ',      # non-breaking space
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def parse_markdown_to_elements(raw_text: str, styles: dict, accent_color=COLOR_PRIMARY_DARK) -> list:
    """
    Convierte bloques de texto Markdown (de IA o heurística) en una lista de Flowables
    de ReportLab perfectamente tipografiados y espaciados (sin etiquetas crudas '##' ni bloques pegados).
    """
    cleaned = sanitize_pdf_text(raw_text)
    lines = cleaned.split('\n')
    elements = []

    style_subhead = styles['BoxSubhead']
    style_context = styles['BoxContext']
    style_bullet = styles['BoxBullet']
    style_p = styles['BoxBody']

    known_subheads = [
        'qué sostiene la adopción', 'que sostiene la adopcion',
        'qué condiciona la decisión', 'que condiciona la decision',
        'brecha detectada', 'brechas detectadas',
        'acciones recomendadas', 'accion recomendada',
        'cómo comprobar mejora', 'como comprobar mejora',
        'consecuencia práctica', 'consecuencia practica',
        'resultado del piloto', 'pruebas de exportación',
    ]

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # 1. Encabezados Markdown ## o ###
        if stripped.startswith('###'):
            title = stripped.lstrip('#').strip()
            elements.append(Paragraph(f"<b>{title}</b>", style_subhead))
            elements.append(Spacer(1, 1))
            continue
        elif stripped.startswith('##'):
            title = stripped.lstrip('#').strip()
            elements.append(Paragraph(f"<font color='#059669'><b>CONTEXTO:</b></font> {title}", style_context))
            elements.append(Spacer(1, 2))
            continue

        # 2. Subtítulos textuales estructurados
        is_sub = False
        lower_line = stripped.lower()
        for sh in known_subheads:
            if lower_line.startswith(sh):
                is_sub = True
                elements.append(Spacer(1, 2))
                elements.append(Paragraph(f"<b>{stripped}</b>", style_subhead))
                elements.append(Spacer(1, 1))
                break
        if is_sub:
            continue

        # 3. Viñetas con guion (- o *)
        if stripped.startswith(('-', '*')) and len(stripped) > 2 and stripped[1] == ' ':
            content = stripped[2:].strip()
            content = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', content)
            elements.append(Paragraph(f"&bull; {content}", style_bullet))
            continue

        # 4. Listas numeradas (1) o 1.)
        num_match = re.match(r'^(\d+[\.\)])\s*(.+)$', stripped)
        if num_match:
            num_prefix = num_match.group(1)
            content = num_match.group(2)
            content = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', content)
            elements.append(Paragraph(f"<b>{num_prefix}</b> {content}", style_bullet))
            continue

        # 5. Párrafo normal justificado / limpio
        content = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', stripped)
        elements.append(Paragraph(content, style_p))
        elements.append(Spacer(1, 1))

    return elements


def build_callout_box(title: str, raw_text: str, width: float, styles: dict, accent_color=COLOR_PRIMARY, bg_color=COLOR_BG_PAGE) -> Table:
    """Construye un contenedor ejecutivo con borde lateral y contenido Markdown renderizado."""
    inner_flowables = [
        Paragraph(f"<b>{title}</b>", ParagraphStyle('BoxTitleHead', parent=styles['BoxTitle'], textColor=accent_color)),
        Spacer(1, 2),
    ]
    parsed = parse_markdown_to_elements(raw_text, styles, accent_color=accent_color)
    inner_flowables.extend(parsed)

    box = Table([[inner_flowables]], colWidths=[width])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ('LINELEFT', (0, 0), (0, -1), 3.5, accent_color),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    return box


class NumberedCanvas(canvas.Canvas):
    """
    Canvas de doble pasada para calcular el total dinámico de páginas ('Página X de Y'),
    dibujar cabeceras y pies de página institucionales y suprimir elementos en la portada.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        # En la portada (página 1) no se dibujan running header ni footer estándar
        if self._pageNumber == 1:
            return

        self.saveState()
        PAGE_W, PAGE_H = self._pagesize
        margin = 1.4 * cm

        # Running Header (Páginas >= 2)
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(COLOR_PRIMARY_DARK)
        self.drawString(margin, PAGE_H - 26, "GUIOS PRO")

        self.setFont("Helvetica", 7.5)
        self.setFillColor(COLOR_TEXT_MUTED)
        self.drawString(margin + 52, PAGE_H - 26, "|   DOSSIER TÉCNICO Y DICTAMEN OFICIAL DE ADOPCIÓN")

        # Línea divisoria superior
        self.setStrokeColor(COLOR_BORDER_LIGHT)
        self.setLineWidth(0.5)
        self.line(margin, PAGE_H - 31, PAGE_W - margin, PAGE_H - 31)

        # Running Footer (Páginas >= 2)
        self.setStrokeColor(COLOR_BORDER_LIGHT)
        self.setLineWidth(0.5)
        self.line(margin, 34, PAGE_W - margin, 34)

        self.setFont("Helvetica", 7)
        self.setFillColor(COLOR_TEXT_MUTED)
        self.drawString(margin, 23, "Expediente Oficial de Auditoría TI | Plataforma GUIOS")

        page_str = f"Página {self._pageNumber} de {page_count}"
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(COLOR_TEXT_PRIMARY)
        self.drawRightString(PAGE_W - margin, 23, page_str)

        self.restoreState()


def get_logo_path():
    """Localiza el logotipo oficial de GUIOS de forma segura en el proyecto."""
    candidates = [
        os.path.join(getattr(settings, 'BASE_DIR', ''), 'static', 'img', 'Logotipo.png'),
        os.path.join(getattr(settings, 'BASE_DIR', ''), 'staticfiles', 'img', 'Logotipo.png'),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'static', 'img', 'Logotipo.png')),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'static', 'img', 'Isotipo.png')),
    ]
    for p in candidates:
        if p and os.path.exists(p):
            return p
    return None


class EvaluationPDFReport:
    """Generador institucional de informe técnico de evaluación individual en PDF."""

    @classmethod
    def generate(cls, evaluation: Evaluation) -> io.BytesIO:
        buffer = io.BytesIO()

        PAGE_W, PAGE_H = A4
        MARGIN = 1.4 * cm
        CONTENT_W = PAGE_W - (2 * MARGIN)

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=MARGIN,
            leftMargin=MARGIN,
            topMargin=1.6 * cm,
            bottomMargin=1.6 * cm,
        )

        styles = getSampleStyleSheet()

        # ── ESTILOS TIPOGRÁFICOS JERÁRQUICOS ─────────────────────────────────
        style_h1 = ParagraphStyle(
            'H1_Section',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11.5,
            leading=14.5,
            textColor=COLOR_PRIMARY_DARK,
            spaceAfter=4,
            keepWithNext=True,
        )

        style_h2 = ParagraphStyle(
            'H2_Subsection',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11.5,
            textColor=COLOR_PRIMARY_DARK,
            spaceAfter=3,
            keepWithNext=True,
        )

        style_body = ParagraphStyle(
            'BodyTextCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=10.5,
            textColor=COLOR_TEXT_PRIMARY,
            alignment=TA_LEFT,
        )

        style_cell_header = ParagraphStyle(
            'CellHeaderCustom',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.2,
            leading=9.2,
            textColor=COLOR_WHITE,
            alignment=TA_LEFT,
        )

        style_cell_header_center = ParagraphStyle(
            'CellHeaderCenterCustom',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.2,
            leading=9.2,
            textColor=COLOR_WHITE,
            alignment=TA_CENTER,
        )

        style_cell_body = ParagraphStyle(
            'CellBodyCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=COLOR_TEXT_PRIMARY,
        )

        style_cell_body_center = ParagraphStyle(
            'CellBodyCenterCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=COLOR_TEXT_PRIMARY,
            alignment=TA_CENTER,
        )

        style_cell_body_muted = ParagraphStyle(
            'CellBodyMutedCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=6.5,
            leading=8.2,
            textColor=COLOR_TEXT_MUTED,
        )

        # Estilos dedicados para tarjetas KPI (evitan solapamiento vertical)
        style_kpi_label = ParagraphStyle(
            'KPILbl',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=6,
            leading=7.5,
            textColor=colors.HexColor('#64748B'),
            alignment=TA_CENTER,
        )
        style_kpi_val = ParagraphStyle(
            'KPIVal',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12.5,
            leading=14.5,
            textColor=COLOR_TEXT_PRIMARY,
            alignment=TA_CENTER,
        )
        style_kpi_sub = ParagraphStyle(
            'KPISub',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=6,
            leading=7.5,
            textColor=COLOR_TEXT_MUTED,
            alignment=TA_CENTER,
        )

        # Diccionario de estilos para bloques de llamada (Callout Boxes)
        box_styles = {
            'BoxTitle': ParagraphStyle('BoxTitle', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=COLOR_PRIMARY_DARK),
            'BoxBody': ParagraphStyle('BoxBody', fontName='Helvetica', fontSize=6.8, leading=8.8, textColor=COLOR_TEXT_PRIMARY),
            'BoxContext': ParagraphStyle('BoxContext', fontName='Helvetica', fontSize=6.2, leading=7.8, textColor=colors.HexColor('#64748B')),
            'BoxSubhead': ParagraphStyle('BoxSubhead', fontName='Helvetica-Bold', fontSize=7, leading=8.8, textColor=COLOR_PRIMARY_DARK),
            'BoxBullet': ParagraphStyle('BoxBullet', fontName='Helvetica', fontSize=6.5, leading=8.2, textColor=COLOR_TEXT_PRIMARY, leftIndent=8, firstLineIndent=-6),
        }

        story = []

        # ── PRECARGA Y CÁLCULOS METODOLÓGICOS ─────────────────────────────────
        verdict = getattr(evaluation, 'verdict', None)
        rec_code = verdict.recommendation if verdict else '—'

        if rec_code == 'A':
            rec_color = COLOR_REC_A
            rec_bg = COLOR_REC_A_BG
            rec_title = "RECOMENDACIÓN A — ADOPTAR SIN OBSERVACIONES"
            rec_desc = "El software cumple con los umbrales de calidad técnica y no presenta amenazas críticas para la organización."
        elif rec_code == 'B':
            rec_color = COLOR_REC_B
            rec_bg = COLOR_REC_B_BG
            rec_title = "RECOMENDACIÓN B — ADOPCIÓN CONDICIONADA CON MATICES"
            rec_desc = "El software es viable pero presenta debilidades o amenazas en factores prioritarios que requieren mitigación."
        elif rec_code == 'C':
            rec_color = COLOR_REC_C
            rec_bg = COLOR_REC_C_BG
            rec_title = "RECOMENDACIÓN C — POSPONER O DESACONSEJAR ADOPCIÓN"
            rec_desc = "El software presenta debilidades o amenazas críticas que comprometen la gobernanza tecnológica institucional."
        else:
            rec_color = COLOR_PRIMARY
            rec_bg = COLOR_PRIMARY_LIGHT
            rec_title = "DICTAMEN EN PROCESO DE EVALUACIÓN"
            rec_desc = "Sesión de evaluación técnica en curso de análisis."

        results_by_factor = {er.factor_id: er for er in evaluation.evaluation_results.all()}
        subfactors_by_factor = {}
        for esf in evaluation.evaluation_subfactors.all():
            sf_list = subfactors_by_factor.setdefault(esf.subfactor.factor_id, [])
            sf_list.append(esf)

        for fid in subfactors_by_factor:
            subfactors_by_factor[fid].sort(key=lambda s: (s.subfactor.order, s.subfactor.id))

        factors_qs = list(
            evaluation.evaluation_factors.select_related('factor__dimension')
            .order_by('factor__dimension__order', 'factor__order', 'factor__id')
        )

        # Clasificación FODA y PM Global
        strengths = []
        opportunities = []
        weaknesses = []
        threats = []
        pm_values = []
        relevant_factors = []
        discarded_factors = []

        for ef in factors_qs:
            res = results_by_factor.get(ef.factor_id)
            if ef.relative_importance == 1 or ef.is_relevant is False:
                discarded_factors.append(ef)
            else:
                relevant_factors.append(ef)

            if res and res.weighted_average is not None and ef.relative_importance != 1:
                pm_val = float(res.weighted_average)
                pm_values.append(pm_val)
                foda_class = (res.foda_classification or '').lower()
                foda_disp = (res.get_foda_classification_display() or '').lower()

                if 'strength' in foda_class or 'fortaleza' in foda_disp:
                    strengths.append((ef, pm_val))
                elif 'opportunity' in foda_class or 'oportunidad' in foda_disp:
                    opportunities.append((ef, pm_val))
                elif 'weakness' in foda_class or 'debilidad' in foda_disp:
                    weaknesses.append((ef, pm_val))
                elif 'threat' in foda_class or 'amenaza' in foda_disp:
                    threats.append((ef, pm_val))

        avg_pm = sum(pm_values) / len(pm_values) if pm_values else 0.0
        today_str = datetime.now().strftime("%d/%m/%Y")
        emission_date = verdict.calculated_at.strftime("%d/%m/%Y") if verdict and verdict.calculated_at else today_str
        emission_datetime = verdict.calculated_at.strftime("%d/%m/%Y %H:%M:%S") if verdict and verdict.calculated_at else datetime.now().strftime("%d/%m/%Y %H:%M:%S")

        # Hash criptográfico de validación de expediente
        hash_seed = f"{evaluation.id}-{evaluation.uuid}-{evaluation.software_name}-{rec_code}-{emission_date}"
        expediente_hash = hashlib.sha256(hash_seed.encode('utf-8')).hexdigest()[:16].upper()

        # ══════════════════════════════════════════════════════════════════════
        # ── PÁGINA 1: PORTADA INSTITUCIONAL EJECUTIVA (ALTO IMPACTO) ──────────
        # ══════════════════════════════════════════════════════════════════════

        # 1. Cabecera con Logotipo y Membrete
        logo_path = get_logo_path()
        header_cells = []
        if logo_path:
            logo_img = Image(logo_path, width=1.4 * cm, height=1.4 * cm)
            header_cells = [
                [
                    logo_img,
                    Paragraph(
                        "<b>GUIOS PRO</b><br/>"
                        "<font color='#059669' size='7.5'><b>MODELO DE ADOPCIÓN DE SOFTWARE LIBRE</b></font><br/>"
                        "<font color='#64748B' size='7'>Universidad Estatal de Milagro | Auditoría de Software</font>",
                        style_body,
                    ),
                    Paragraph(
                        "<font color='#059669' size='8'><b>EXPEDIENTE OFICIAL</b></font><br/>"
                        f"<font color='#0F172A' size='7.5'><b>Sesión #{evaluation.id}</b></font><br/>"
                        f"<font color='#64748B' size='7'>{today_str}</font>",
                        ParagraphStyle('HeadR', parent=style_body, alignment=TA_RIGHT),
                    ),
                ]
            ]
            header_table = Table(header_cells, colWidths=[1.6 * cm, CONTENT_W * 0.65, CONTENT_W * 0.25])
        else:
            header_cells = [
                [
                    Paragraph(
                        "<b>GUIOS PRO</b> | <font color='#059669'><b>MODELO DE ADOPCIÓN DE SOFTWARE LIBRE</b></font><br/>"
                        "<font color='#64748B' size='7'>Universidad Estatal de Milagro | Auditoría de Software</font>",
                        style_body,
                    ),
                    Paragraph(
                        f"<font color='#059669' size='8'><b>EXPEDIENTE OFICIAL #{evaluation.id}</b></font><br/>"
                        f"<font color='#64748B' size='7'>{today_str}</font>",
                        ParagraphStyle('HeadR', parent=style_body, alignment=TA_RIGHT),
                    ),
                ]
            ]
            header_table = Table(header_cells, colWidths=[CONTENT_W * 0.70, CONTENT_W * 0.30])

        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=2, color=COLOR_PRIMARY, spaceAfter=14, spaceBefore=4))

        # 2. Hero Title del Software Candidato
        story.append(Paragraph(
            "<font color='#059669' size='9'><b>DICTAMEN METODOLÓGICO DE ADOPCIÓN TECNOLÓGICA</b></font>",
            style_body,
        ))
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f"<font color='#064E3B' size='22'><b>{sanitize_pdf_text(evaluation.software_name)}</b></font> "
            f"<font color='#64748B' size='13'>v{sanitize_pdf_text(evaluation.software_version or '1.0')}</font>",
            ParagraphStyle('HeroTitle', parent=styles['Normal'], leading=24),
        ))
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f"Categoría: <b>{sanitize_pdf_text(evaluation.software_category or 'General')}</b>"
            f"{f' | Repositorio: <u>{evaluation.software_repo_url}</u>' if evaluation.software_repo_url else ''}",
            style_cell_body_muted,
        ))
        story.append(Spacer(1, 14))

        # 3. Medalla Oficial de Dictamen Institucional
        seal_inner = Table([
            [
                Paragraph(f"<font size='26' color='{rec_color.hexval()}'><b>{rec_code}</b></font>", ParagraphStyle('SealL', alignment=TA_CENTER)),
                Paragraph(
                    f"<font size='9' color='{rec_color.hexval()}'><b>{rec_title}</b></font><br/>"
                    f"<font size='7.5' color='#334155'>{rec_desc}</font><br/>"
                    f"<font size='7' color='#64748B'>Emisión oficial: {emission_date} | Metodología: GUIOS PRO v2.0 (Cuartiles + OpenAlex)</font>",
                    style_body,
                ),
            ]
        ], colWidths=[2.2 * cm, CONTENT_W - 2.2 * cm - 8])
        seal_inner.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ]))

        verdict_banner = Table([[seal_inner]], colWidths=[CONTENT_W])
        verdict_banner.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), rec_bg),
            ('BOX', (0, 0), (-1, -1), 1.2, rec_color),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(verdict_banner)
        story.append(Spacer(1, 16))

        # 4. Ficha Técnica Institucional (Metadata de Organización y Contexto)
        evaluator_name = (
            evaluation.created_by.get_full_name() or evaluation.created_by.username
            if evaluation.created_by else 'Evaluador Técnico Autorizado'
        )
        evaluator_name = sanitize_pdf_text(evaluator_name)
        org_name = sanitize_pdf_text(evaluation.org_name)
        org_sector = sanitize_pdf_text(evaluation.org_sector or 'No especificado')

        meta_rows = [
            [
                Paragraph("<b>Organización Evaluadora:</b>", style_cell_body),
                Paragraph(org_name, style_cell_body),
                Paragraph("<b>Sector / Rubro:</b>", style_cell_body),
                Paragraph(org_sector, style_cell_body),
            ],
            [
                Paragraph("<b>Responsable Técnico:</b>", style_cell_body),
                Paragraph(evaluator_name, style_cell_body),
                Paragraph("<b>Estado de Auditoría:</b>", style_cell_body),
                Paragraph(f"<b>{evaluation.get_status_display()}</b>", style_cell_body),
            ],
            [
                Paragraph("<b>Plazo Previsto de Adopción:</b>", style_cell_body),
                Paragraph(sanitize_pdf_text(evaluation.target_timeline or 'No registrado'), style_cell_body),
                Paragraph("<b>Tamaño de Organización:</b>", style_cell_body),
                Paragraph(sanitize_pdf_text(evaluation.org_size or 'No registrado'), style_cell_body),
            ],
            [
                Paragraph("<b>Expediente UUID:</b>", style_cell_body),
                Paragraph(f"<font color='#059669' size='6.5'><b>{evaluation.uuid}</b></font>", style_cell_body),
                Paragraph("<b>Hash de Integridad:</b>", style_cell_body),
                Paragraph(f"<font color='#475569' size='6.5'><b>SHA256:{expediente_hash}</b></font>", style_cell_body),
            ],
        ]
        meta_table = Table(meta_rows, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.32, CONTENT_W * 0.20, CONTENT_W * 0.26])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_PAGE),
            ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 4.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 16))

        # 5. Declaración de Certificación Metodológica en la Portada
        cert_p = Paragraph(
            "<b>Certificación Metodológica GUIOS:</b> El presente informe técnico certifica la evaluación "
            "integral del software candidato conforme al modelo metodológico GUIOS. La ponderación de factores "
            "incorpora minería de literatura científica indexada (OpenAlex) para calcular la importancia de la literatura (IL), "
            "ponderación del decisor institucional (ID) y calificación técnica de afirmaciones verificables (PM). "
            "Este documento constituye el sustento oficial para la toma de decisiones tecnológicas.",
            style_cell_body_muted,
        )
        cert_box = Table([[cert_p]], colWidths=[CONTENT_W])
        cert_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_PRIMARY_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, COLOR_PRIMARY),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(cert_box)
        story.append(PageBreak())

        # ══════════════════════════════════════════════════════════════════════
        # ── PÁGINA 2: RESUMEN EJECUTIVO Y MATRIZ FODA CONSOLIDADA ─────────────
        # ══════════════════════════════════════════════════════════════════════

        story.append(Paragraph("1. Resumen Ejecutivo y Diagnóstico FODA Consolidado", style_h1))
        story.append(Spacer(1, 4))

        # 1. Cuatro Tarjetas KPI Cuantitativas con Celdas Estructuradas (Sin solapamientos)
        kpi_col_w = CONTENT_W / 4
        kpi_cells = [
            [
                [
                    Paragraph("DICTAMEN OFICIAL", style_kpi_label),
                    Spacer(1, 2),
                    Paragraph(f"<font color='{rec_color.hexval()}'>Rec. {rec_code}</font>", style_kpi_val),
                    Spacer(1, 2),
                    Paragraph(sanitize_pdf_text(evaluation.software_name)[:18], style_kpi_sub),
                ],
                [
                    Paragraph("PM GLOBAL PROMEDIO", style_kpi_label),
                    Spacer(1, 2),
                    Paragraph(f"{avg_pm:.2f} <font size='7' color='#64748B'>/ 4.0</font>", style_kpi_val),
                    Spacer(1, 2),
                    Paragraph(
                        f"<font color='{'#059669' if avg_pm >= 3.0 else '#D97706'}'><b>{'Calificación Favorable' if avg_pm >= 3.0 else 'Requiere Mitigación'}</b></font>",
                        style_kpi_sub,
                    ),
                ],
                [
                    Paragraph("FACTORES EVALUADOS", style_kpi_label),
                    Spacer(1, 2),
                    Paragraph(f"{len(relevant_factors)} <font size='7' color='#64748B'>de {len(factors_qs)}</font>", style_kpi_val),
                    Spacer(1, 2),
                    Paragraph(f"{len(discarded_factors)} descartados (IR=1)", style_kpi_sub),
                ],
                [
                    Paragraph("BALANCE FODA", style_kpi_label),
                    Spacer(1, 2),
                    Paragraph(
                        f"<font color='#059669'>{len(strengths)}F</font> &nbsp; "
                        f"<font color='#0284C7'>{len(opportunities)}O</font> &nbsp; "
                        f"<font color='#D97706'>{len(weaknesses)}D</font> &nbsp; "
                        f"<font color='#DC2626'>{len(threats)}A</font>",
                        style_kpi_val,
                    ),
                    Spacer(1, 2),
                    Paragraph(f"{len(strengths) + len(opportunities)} favorables | {len(weaknesses) + len(threats)} de riesgo", style_kpi_sub),
                ],
            ]
        ]
        kpi_table = Table(kpi_cells, colWidths=[kpi_col_w] * 4)
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_PAGE),
            ('BOX', (0, 0), (-1, -1), 0.8, COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 6))

        # 2. Resumen Ejecutivo Narrativo / Diagnóstico de Inteligencia (Parsed Markdown Callout)
        exec_text = (verdict.ai_executive_summary or verdict.explanation_text) if verdict else 'Sin resumen registrado.'
        summary_box = build_callout_box(
            "Diagnóstico Institucional del Dictamen:",
            exec_text,
            CONTENT_W,
            box_styles,
            accent_color=COLOR_PRIMARY,
            bg_color=COLOR_BG_PAGE,
        )
        story.append(summary_box)
        story.append(Spacer(1, 6))

        # 3. Matriz FODA Consolidada Gráfica (2x2)
        story.append(Paragraph("Matriz FODA Consolidada (2×2)", style_h2))
        story.append(Spacer(1, 2))

        style_foda_head = ParagraphStyle('FodaHead', fontName='Helvetica-Bold', fontSize=7, leading=8.5, textColor=COLOR_WHITE)
        style_foda_item = ParagraphStyle('FodaItem', fontName='Helvetica', fontSize=6.2, leading=7.8, textColor=COLOR_TEXT_PRIMARY)

        def make_foda_quadrant_content(items, empty_msg):
            if not items:
                return f"<i><font color='#64748B'>{empty_msg}</font></i>"
            lines = [f"&bull; <b>{sanitize_pdf_text(ef.factor.name)}</b> <font color='#475569'>(PM: {pm:.2f})</font>" for ef, pm in items]
            return "<br/>".join(lines)

        str_content = make_foda_quadrant_content(strengths, "Sin factores en este cuadrante")
        opp_content = make_foda_quadrant_content(opportunities, "Sin factores en este cuadrante")
        wea_content = make_foda_quadrant_content(weaknesses, "Sin factores en este cuadrante")
        thr_content = make_foda_quadrant_content(threats, "Sin factores en este cuadrante")

        QUAD_W = (CONTENT_W - 6) / 2

        # Cuadrante Fortalezas
        table_f = Table([
            [Paragraph(f"FORTALEZAS (F) — {len(strengths)} Factores Internos (PM >= 3.0)", style_foda_head)],
            [Paragraph(str_content, style_foda_item)],
        ], colWidths=[QUAD_W])
        table_f.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_REC_A),
            ('BACKGROUND', (0, 1), (-1, 1), COLOR_REC_A_BG),
            ('BOX', (0, 0), (-1, -1), 0.8, COLOR_REC_A),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))

        # Cuadrante Oportunidades
        table_o = Table([
            [Paragraph(f"OPORTUNIDADES (O) — {len(opportunities)} Factores Externos (PM >= 3.0)", style_foda_head)],
            [Paragraph(opp_content, style_foda_item)],
        ], colWidths=[QUAD_W])
        table_o.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_FODA_O),
            ('BACKGROUND', (0, 1), (-1, 1), COLOR_FODA_O_BG),
            ('BOX', (0, 0), (-1, -1), 0.8, COLOR_FODA_O),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))

        # Cuadrante Debilidades
        table_d = Table([
            [Paragraph(f"DEBILIDADES (D) — {len(weaknesses)} Factores Internos (PM &lt; 3.0)", style_foda_head)],
            [Paragraph(wea_content, style_foda_item)],
        ], colWidths=[QUAD_W])
        table_d.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_REC_B),
            ('BACKGROUND', (0, 1), (-1, 1), COLOR_REC_B_BG),
            ('BOX', (0, 0), (-1, -1), 0.8, COLOR_REC_B),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))

        # Cuadrante Amenazas
        table_a = Table([
            [Paragraph(f"AMENAZAS (A) — {len(threats)} Factores Externos (PM &lt; 3.0)", style_foda_head)],
            [Paragraph(thr_content, style_foda_item)],
        ], colWidths=[QUAD_W])
        table_a.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_REC_C),
            ('BACKGROUND', (0, 1), (-1, 1), COLOR_REC_C_BG),
            ('BOX', (0, 0), (-1, -1), 0.8, COLOR_REC_C),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))

        foda_2x2_grid = Table([
            [table_f, table_o],
            [table_d, table_a],
        ], colWidths=[QUAD_W + 3, QUAD_W + 3])
        foda_2x2_grid.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(foda_2x2_grid)
        story.append(PageBreak())

        # ══════════════════════════════════════════════════════════════════════
        # ── PÁGINA 3+: SCORECARD TÉCNICO Y SUBFACTORES POR DIMENSIÓN ──────────
        # ══════════════════════════════════════════════════════════════════════

        story.append(Paragraph("2. Evaluación Ponderada de Factores y Auditoría Técnica", style_h1))
        story.append(Paragraph(
            "Desglose de los 18 factores metodológicos agrupados por sus dimensiones rectoras. "
            "Se detallan las ponderaciones medias obtenidas (PM), el nivel de importancia relativa (IR) y los "
            "indicadores de literatura científica indexada (citas c_i, ratio r_i y cuartil IL).",
            style_body,
        ))
        story.append(Spacer(1, 6))

        # Agrupar factores por Dimensión
        dimensions_dict = {}
        for ef in factors_qs:
            dim = ef.factor.dimension
            dim_list = dimensions_dict.setdefault(dim, [])
            dim_list.append(ef)

        # Ordenar dimensiones por orden
        sorted_dims = sorted(dimensions_dict.keys(), key=lambda d: d.order)

        for dim in sorted_dims:
            dim_factors = dimensions_dict[dim]

            # Banner de Dimensión
            dim_header = Table([
                [Paragraph(f"<b>DIMENSIÓN {dim.order}: {dim.name.upper()}</b>", style_cell_header)]
            ], colWidths=[CONTENT_W])
            dim_header.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), COLOR_PRIMARY_DARK),
                ('TOPPADDING', (0, 0), (-1, -1), 3.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ]))

            factor_table_rows = [
                [
                    Paragraph("Factor Metodológico", style_cell_header),
                    Paragraph("IR", style_cell_header_center),
                    Paragraph("PM", style_cell_header_center),
                    Paragraph("Diagnóstico FODA", style_cell_header_center),
                    Paragraph("Citas (c_i)", style_cell_header_center),
                    Paragraph("Ratio (r_i)", style_cell_header_center),
                    Paragraph("IL", style_cell_header_center),
                    Paragraph("ID", style_cell_header_center),
                    Paragraph("IS", style_cell_header_center),
                ]
            ]

            for ef in dim_factors:
                res = results_by_factor.get(ef.factor_id)
                is_disc = ef.relative_importance == 1 or ef.is_relevant is False

                if is_disc:
                    foda_text = "<font color='#64748B'>Descartado</font>"
                    pm_text = "<font color='#64748B'>—</font>"
                elif res and res.weighted_average is not None:
                    pm_val = float(res.weighted_average)
                    pm_text = f"<b>{pm_val:.2f}</b>"
                    f_disp = res.get_foda_classification_display()
                    if 'fortaleza' in f_disp.lower():
                        foda_text = f"<font color='#059669'><b>{f_disp}</b></font>"
                    elif 'oportunidad' in f_disp.lower():
                        foda_text = f"<font color='#0284C7'><b>{f_disp}</b></font>"
                    elif 'debilidad' in f_disp.lower():
                        foda_text = f"<font color='#D97706'><b>{f_disp}</b></font>"
                    elif 'amenaza' in f_disp.lower():
                        foda_text = f"<font color='#DC2626'><b>{f_disp}</b></font>"
                    else:
                        foda_text = f_disp
                else:
                    pm_text = "—"
                    foda_text = "—"

                ci = str(ef.citations_count) if ef.citations_count is not None else '-'
                ri = f"{ef.citation_ratio:.2f}" if ef.citation_ratio is not None else '-'
                il = str(ef.literature_importance_calculated) if ef.literature_importance_calculated is not None else '-'
                did = str(ef.decisor_importance) if ef.decisor_importance is not None else '-'
                is_val = str(ef.systemic_importance_snapshot) if ef.systemic_importance_snapshot is not None else '-'
                ir_val = str(ef.relative_importance) if ef.relative_importance is not None else '-'

                factor_table_rows.append([
                    Paragraph(f"<b>{sanitize_pdf_text(ef.factor.name)}</b>", style_cell_body),
                    Paragraph(f"<b>{ir_val}</b>", style_cell_body_center),
                    Paragraph(pm_text, style_cell_body_center),
                    Paragraph(foda_text, style_cell_body_center),
                    Paragraph(ci, style_cell_body_center),
                    Paragraph(ri, style_cell_body_center),
                    Paragraph(il, style_cell_body_center),
                    Paragraph(did, style_cell_body_center),
                    Paragraph(is_val, style_cell_body_center),
                ])

            # Anchos calculados exactamente a CONTENT_W (515 pt)
            dim_table = Table(
                factor_table_rows,
                colWidths=[155, 35, 45, 85, 40, 45, 35, 35, 40],
                repeatRows=1,
            )
            dim_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_DARK),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_PAGE]),
                ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))

            story.append(KeepTogether([
                dim_header,
                dim_table,
                Spacer(1, 8),
            ]))

        # Subfactores detallados (Auditoría de Afirmaciones Técnicas Verificables)
        story.append(Spacer(1, 4))
        story.append(Paragraph("2.1 Desglose de Afirmaciones Técnicas Evaluadas (Subfactores)", style_h2))
        story.append(Paragraph(
            "Registro de las afirmaciones verificables calificadas en Fase 2. Escala: "
            "<b>1</b> = No cumple | <b>2</b> = Desconocido | "
            "<b>3</b> = Parcialmente favorable | <b>4</b> = Totalmente satisfactorio.",
            style_cell_body_muted,
        ))
        story.append(Spacer(1, 4))

        sf_table_rows = [
            [
                Paragraph("Factor", style_cell_header),
                Paragraph("Afirmación Técnica Verificable", style_cell_header),
                Paragraph("Calificación", style_cell_header_center),
            ]
        ]

        for ef in factors_qs:
            sfs = subfactors_by_factor.get(ef.factor_id, [])
            if not sfs:
                continue

            for esf in sfs:
                r_val = esf.rating
                if r_val == 4:
                    badge = "<font color='#059669'><b>4 / 4 • Cumple</b></font>"
                elif r_val == 3:
                    badge = "<font color='#0284C7'><b>3 / 4 • Parcial</b></font>"
                elif r_val == 2:
                    badge = "<font color='#D97706'><b>2 / 4 • Desconoce</b></font>"
                elif r_val == 1:
                    badge = "<font color='#DC2626'><b>1 / 4 • No cumple</b></font>"
                else:
                    badge = "<font color='#64748B'>— (Excluido)</font>"

                sf_desc = sanitize_pdf_text(esf.description_snapshot or '')
                sf_desc = xml_escape(sf_desc)

                sf_table_rows.append([
                    Paragraph(f"<font size='6.8'><b>{sanitize_pdf_text(ef.factor.name)}</b></font>", style_cell_body),
                    Paragraph(sf_desc, style_cell_body),
                    Paragraph(badge, style_cell_body_center),
                ])

        sf_table = Table(
            sf_table_rows,
            colWidths=[CONTENT_W * 0.25, CONTENT_W * 0.55, CONTENT_W * 0.20],
            repeatRows=1,
        )
        sf_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_DARK),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_PAGE]),
            ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(sf_table)
        story.append(PageBreak())

        # ══════════════════════════════════════════════════════════════════════
        # ── PÁGINA N: PLAN DE MITIGACIÓN DE BRECHAS Y RIESGOS ─────────────────
        # ══════════════════════════════════════════════════════════════════════

        has_negatives = len(weaknesses) > 0 or len(threats) > 0
        mitigation_text = verdict.ai_mitigation_plan if verdict else ''

        if has_negatives or mitigation_text:
            story.append(Paragraph("3. Plan de Mitigación de Brechas Metodológicas", style_h1))
            story.append(Paragraph(
                "Para viabilizar la adopción institucional o mitigar riesgos de gobernanza y seguridad, "
                "se formulan las siguientes acciones prioritarias sobre los factores clasificados en cuadrantes desfavorables.",
                style_body,
            ))
            story.append(Spacer(1, 6))

            mitigation_rows = [
                [
                    Paragraph("Factor / Brecha", style_cell_header),
                    Paragraph("Riesgo Metodológico", style_cell_header),
                    Paragraph("Acción Correctiva Sugerida", style_cell_header),
                    Paragraph("Responsable / Meta", style_cell_header),
                ]
            ]

            negative_factors = weaknesses + threats
            for ef, pm in negative_factors:
                res = results_by_factor.get(ef.factor_id)
                foda_label = res.get_foda_classification_display() if res else "Riesgo"
                is_threat = 'amenaza' in foda_label.lower()

                factor_name_clean = sanitize_pdf_text(ef.factor.name)

                riesgo_desc = (
                    f"Impacto crítico externo (PM={pm:.2f} &lt; 3.0). Riesgo de dependencia o vulnerabilidad externa."
                    if is_threat else
                    f"Carencia interna operativa (PM={pm:.2f} &lt; 3.0). Insuficiencia en procesos, capacitación o infraestructura."
                )

                accion_desc = (
                    f"Establecer plan de contingencia técnico, auditorías trimestrales y acuerdos de nivel de servicio (SLA) para {factor_name_clean}."
                    if is_threat else
                    f"Diseñar programa de capacitación interna, asignación presupuestaria y endurecimiento de procesos para {factor_name_clean}."
                )

                meta_desc = f"<b>Área de TI / Seguridad</b><br/><font color='#059669'>Elevar PM &gt;= 3.0 en 90 días</font>"

                mitigation_rows.append([
                    Paragraph(f"<b>{factor_name_clean}</b><br/><font size='6.5' color='{'#DC2626' if is_threat else '#D97706'}'>{foda_label}</font>", style_cell_body),
                    Paragraph(riesgo_desc, style_cell_body),
                    Paragraph(accion_desc, style_cell_body),
                    Paragraph(meta_desc, style_cell_body),
                ])

            mit_table = Table(
                mitigation_rows,
                colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.28, CONTENT_W * 0.30, CONTENT_W * 0.20],
                repeatRows=1,
            )
            mit_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_DARK),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_PAGE]),
                ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
                ('TOPPADDING', (0, 0), (-1, -1), 3.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(mit_table)
            story.append(Spacer(1, 10))

            if mitigation_text:
                plan_callout = build_callout_box(
                    "Recomendaciones Estratégicas Complementarias de Mitigación:",
                    mitigation_text,
                    CONTENT_W,
                    box_styles,
                    accent_color=COLOR_REC_B,
                    bg_color=COLOR_BG_PAGE,
                )
                story.append(plan_callout)

            story.append(PageBreak())

        # ══════════════════════════════════════════════════════════════════════
        # ── PÁGINA FINAL: EVIDENCIAS CIENTÍFICAS DOI Y BLOQUE DE FIRMAS ───────
        # ══════════════════════════════════════════════════════════════════════

        story.append(Paragraph("4. Evidencias Bibliográficas Científicas Indexadas (OpenAlex)", style_h1))
        story.append(Paragraph(
            "Artículos académicos y publicaciones indexadas con DOI que respaldan los criterios evaluados. "
            f"Umbrales de corte cuartílico aplicados: "
            f"<b>Q1</b> = {evaluation.q1_threshold or '—'} | "
            f"<b>Q2 (Mediana)</b> = {evaluation.q2_threshold or '—'} | "
            f"<b>Q3</b> = {evaluation.q3_threshold or '—'} | "
            f"<b>Q4 (Máx)</b> = {evaluation.q4_threshold or '—'}.",
            style_body,
        ))
        story.append(Spacer(1, 6))

        all_sources = []
        for ef in factors_qs:
            for s in (ef.ai_literature_sources or []):
                if s.get("doi") or s.get("title"):
                    all_sources.append({
                        "dimension": ef.factor.dimension.name,
                        "factor": ef.factor.name,
                        "doi": s.get("doi") or "",
                        "title": s.get("title") or "Sin título registrado",
                        "url": s.get("url") or "",
                        "snippet": s.get("snippet") or "",
                    })

        if all_sources:
            source_rows = [
                [
                    Paragraph("Factor Evaluado", style_cell_header),
                    Paragraph("Título y Referencia Académica Indexada", style_cell_header),
                    Paragraph("Enlace DOI", style_cell_header_center),
                ]
            ]

            for src in all_sources:
                doi_link = (
                    f"<a href='https://doi.org/{src['doi']}' color='#059669'><u>{src['doi']}</u></a>"
                    if src['doi'] else "<font color='#64748B'>—</font>"
                )
                safe_title = xml_escape(sanitize_pdf_text(src['title']))
                title_text = f"<b>{safe_title}</b>"
                if src['snippet']:
                    safe_snippet = xml_escape(sanitize_pdf_text(src['snippet'][:180]))
                    title_text += f"<br/><font color='#64748B' size='6.5'>{safe_snippet}...</font>"

                source_rows.append([
                    Paragraph(sanitize_pdf_text(src["factor"]), style_cell_body),
                    Paragraph(title_text, style_cell_body),
                    Paragraph(doi_link, style_cell_body_center),
                ])

            source_table = Table(
                source_rows,
                colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.58, CONTENT_W * 0.20],
                repeatRows=1,
            )
            source_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), COLOR_PRIMARY_DARK),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLOR_WHITE, COLOR_BG_PAGE]),
                ('GRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(source_table)
        else:
            story.append(Paragraph("<i>No se registraron citas científicas adicionales con DOI para esta sesión.</i>", style_cell_body_muted))

        story.append(Spacer(1, 10))

        # Sello inferior estructurado de verificación criptográfica (Cierre formal de expediente)
        crypto_table = Table([
            [
                Paragraph(
                    "<b>CERTIFICACIÓN DE INTEGRIDAD CRIPTOGRÁFICA DE EXPEDIENTE</b>",
                    ParagraphStyle('CryptoH', parent=style_cell_body_center, fontName='Helvetica-Bold', fontSize=6.5, leading=8, textColor=COLOR_PRIMARY_DARK),
                )
            ],
            [
                Table([
                    [
                        Paragraph(f"<b>UUID:</b> <font color='#475569'>{evaluation.uuid}</font>", ParagraphStyle('CUuid', parent=style_cell_body, fontSize=6, leading=7.5)),
                        Paragraph(f"<b>HASH:</b> <font color='#475569'>SHA256:{expediente_hash}</font>", ParagraphStyle('CHash', parent=style_cell_body_center, fontSize=6, leading=7.5)),
                        Paragraph(f"<b>Emisión:</b> <font color='#475569'>{emission_datetime}</font>", ParagraphStyle('CDate', parent=style_cell_body, alignment=TA_RIGHT, fontSize=6, leading=7.5)),
                    ]
                ], colWidths=[CONTENT_W * 0.44, CONTENT_W * 0.32, CONTENT_W * 0.24])
            ]
        ], colWidths=[CONTENT_W])
        crypto_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_PAGE),
            ('BOX', (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDER_LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))

        story.append(KeepTogether([crypto_table]))

        # Construcción del documento con NumberedCanvas
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer
