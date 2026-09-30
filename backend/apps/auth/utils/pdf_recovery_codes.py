import io
from datetime import datetime
from django.conf import settings
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    Image,
)

# ─── Paleta de Colores de Marca (GUIOS) ───
COLOR_PRIMARY       = colors.HexColor('#FE2C55')   # Rojo Coral
COLOR_SECONDARY     = colors.HexColor('#25F4EE')   # Cyan / Aqua
COLOR_DARK_HEADER   = colors.HexColor('#010101')   # Fondo Negro Mate
COLOR_SURFACE_DARK  = colors.HexColor('#161823')   # Superficie Oscura
COLOR_BG_CARD       = colors.HexColor('#F8F8F9')   # Fondo sutil claro
COLOR_BORDER        = colors.HexColor('#E2E2E6')   # Borde sutil
COLOR_BORDER_STRONG = colors.HexColor('#CBD0D8')   # Borde medio
COLOR_TEXT_DARK     = colors.HexColor('#161823')   # Texto principal
COLOR_TEXT_MUTED    = colors.HexColor('#757780')   # Texto secundario
COLOR_WHITE         = colors.HexColor('#FFFFFF')
COLOR_TAG_BG        = colors.HexColor('#FFF1F3')   # Fondo suave para badges rojos


class RecoveryCodesPDFGenerator:
    """Generador institucional de PDF para códigos de recuperación 2FA con identidad GUIOS."""

    @classmethod
    def generate(cls, codes: list[str], user_email: str) -> io.BytesIO:
        buffer = io.BytesIO()

        PAGE_W = A4[0]
        MARGIN = 1.8 * cm
        CONTENT_W = PAGE_W - 2 * MARGIN

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=MARGIN,
            leftMargin=MARGIN,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm,
        )

        styles = getSampleStyleSheet()

        # ── Estilos Tipográficos ──────────────────────────────────────────────
        header_title = ParagraphStyle(
            'HeaderTitle',
            parent=styles['Normal'],
            fontSize=16,
            fontName='Helvetica-Bold',
            textColor=COLOR_WHITE,
            alignment=TA_LEFT,
            leading=20,
        )
        header_sub = ParagraphStyle(
            'HeaderSub',
            parent=styles['Normal'],
            fontSize=9,
            fontName='Helvetica',
            textColor=colors.HexColor('#A0A1A8'),
            alignment=TA_LEFT,
            leading=13,
        )
        header_doc_type = ParagraphStyle(
            'HeaderDocType',
            parent=styles['Normal'],
            fontSize=8,
            fontName='Helvetica-Bold',
            textColor=COLOR_PRIMARY,
            alignment=TA_LEFT,
            leading=11,
            spaceBefore=3,
        )
        label_style = ParagraphStyle(
            'LabelStyle',
            parent=styles['Normal'],
            fontSize=7.5,
            fontName='Helvetica-Bold',
            textColor=COLOR_TEXT_MUTED,
            spaceAfter=0,
        )
        value_style = ParagraphStyle(
            'ValueStyle',
            parent=styles['Normal'],
            fontSize=9,
            fontName='Helvetica-Bold',
            textColor=COLOR_TEXT_DARK,
            spaceAfter=0,
        )
        section_title = ParagraphStyle(
            'SectionTitle',
            parent=styles['Normal'],
            fontSize=8.5,
            fontName='Helvetica-Bold',
            textColor=COLOR_TEXT_DARK,
            spaceAfter=4,
            spaceBefore=0,
        )
        inst_text = ParagraphStyle(
            'InstrText',
            parent=styles['Normal'],
            fontSize=8.5,
            fontName='Helvetica',
            textColor=COLOR_TEXT_DARK,
            leading=13,
            alignment=TA_JUSTIFY,
        )
        code_style = ParagraphStyle(
            'CodeStyle',
            parent=styles['Normal'],
            fontSize=12,
            fontName='Courier-Bold',
            textColor=COLOR_TEXT_DARK,
            alignment=TA_CENTER,
            leading=14,
        )
        code_num_style = ParagraphStyle(
            'CodeNumStyle',
            parent=styles['Normal'],
            fontSize=8,
            fontName='Helvetica-Bold',
            textColor=COLOR_PRIMARY,
            alignment=TA_CENTER,
            leading=10,
        )
        footer_main = ParagraphStyle(
            'FooterMain',
            parent=styles['Normal'],
            fontSize=7.5,
            fontName='Helvetica-Bold',
            textColor=COLOR_WHITE,
            alignment=TA_LEFT,
        )
        footer_sub = ParagraphStyle(
            'FooterSub',
            parent=styles['Normal'],
            fontSize=6.5,
            fontName='Helvetica',
            textColor=colors.HexColor('#A0A1A8'),
            alignment=TA_RIGHT,
        )

        elements = []
        now = datetime.now()

        # ── 1. CABECERA INSTITUCIONAL ─────────────────────────────────────────
        static_dir = Path(settings.BASE_DIR) / 'static' / 'img'
        logo_path_png = static_dir / 'Logotipo.png'
        logo_path_webp = static_dir / 'Logotipo.webp'
        isotipo_path_png = static_dir / 'Isotipo.png'

        chosen_logo = None
        for p in [logo_path_png, isotipo_path_png, logo_path_webp]:
            if p.exists():
                chosen_logo = p
                break

        LOGO_W = 4.8 * cm

        if chosen_logo:
            try:
                logo_img = Image(str(chosen_logo))
                aspect = logo_img.imageHeight / logo_img.imageWidth
                logo_img.drawWidth = LOGO_W
                logo_img.drawHeight = LOGO_W * aspect
                logo_img.hAlign = 'LEFT'
                logo_cell = logo_img
            except Exception:
                logo_cell = Paragraph("<b>GUIOS</b>", header_title)
        else:
            logo_cell = Paragraph("<b>GUIOS</b>", header_title)

        header_text_block = [
            Paragraph("GUIOS", header_title),
            Paragraph("Plataforma de Seguridad y Control de Acceso", header_sub),
            Paragraph("DOCUMENTO CONFIDENCIAL · CÓDIGOS DE RESPALDO 2FA", header_doc_type),
        ]

        header_table = Table(
            [[logo_cell, header_text_block]],
            colWidths=[LOGO_W + 0.4 * cm, CONTENT_W - LOGO_W - 0.4 * cm],
        )
        header_table.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), COLOR_DARK_HEADER),
            ('BACKGROUND',    (0, 0), (0, -1), COLOR_DARK_HEADER),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN',         (0, 0), (0, -1), 'CENTER'),
            ('LEFTPADDING',   (0, 0), (0, -1), 12),
            ('LEFTPADDING',   (1, 0), (1, -1), 18),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 14),
            ('TOPPADDING',    (0, 0), (-1, -1), 16),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
        ]))
        elements.append(header_table)

        # Banda de acento roja debajo del header
        elements.append(
            HRFlowable(width='100%', thickness=3, color=COLOR_PRIMARY, spaceAfter=0, spaceBefore=0)
        )

        elements.append(Spacer(1, 0.45 * cm))

        # ── 2. FICHA DE INFORMACIÓN ──────────────────────────────────────────
        folio = f"DVI-2FA-{now.strftime('%Y%m%d%H%M%S')}"
        fecha_gen = now.strftime("%d/%m/%Y · %H:%M hrs")

        info_data = [
            [
                Paragraph("USUARIO / CUENTA", label_style),
                Paragraph("FECHA DE EMISIÓN", label_style),
                Paragraph("FOLIO DE SEGURIDAD", label_style),
            ],
            [
                Paragraph(user_email, value_style),
                Paragraph(fecha_gen, value_style),
                Paragraph(folio, value_style),
            ],
        ]
        info_table = Table(info_data, colWidths=[CONTENT_W * 0.44, CONTENT_W * 0.30, CONTENT_W * 0.26])
        info_table.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0), COLOR_BG_CARD),
            ('BACKGROUND',    (0, 1), (-1, 1), COLOR_WHITE),
            ('BOX',           (0, 0), (-1, -1), 0.6, COLOR_BORDER_STRONG),
            ('INNERGRID',     (0, 0), (-1, -1), 0.4, COLOR_BORDER),
            ('LEFTPADDING',   (0, 0), (-1, -1), 10),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(info_table)

        elements.append(Spacer(1, 0.5 * cm))

        # ── 3. INSTRUCCIONES DE USO ──────────────────────────────────────────
        elements.append(Paragraph("■ &nbsp;INSTRUCCIONES Y RECOMENDACIONES", section_title))

        instructions = [
            [
                Paragraph("01", ParagraphStyle('Num', parent=styles['Normal'], fontSize=9,
                           fontName='Helvetica-Bold', textColor=COLOR_PRIMARY, alignment=TA_CENTER)),
                Paragraph(
                    "Estos códigos de emergencia le permiten recuperar el acceso inmediato a su cuenta "
                    "en caso de extravío o inaccesibilidad de su dispositivo de autenticación (2FA).",
                    inst_text,
                ),
            ],
            [
                Paragraph("02", ParagraphStyle('Num', parent=styles['Normal'], fontSize=9,
                           fontName='Helvetica-Bold', textColor=COLOR_PRIMARY, alignment=TA_CENTER)),
                Paragraph(
                    "Cada código es de <b>uso único e intransferible</b>. Una vez utilizado para iniciar sesión, "
                    "queda automáticamente invalidado en el sistema.",
                    inst_text,
                ),
            ],
            [
                Paragraph("03", ParagraphStyle('Num', parent=styles['Normal'], fontSize=9,
                           fontName='Helvetica-Bold', textColor=COLOR_PRIMARY, alignment=TA_CENTER)),
                Paragraph(
                    "Guarde este documento en un lugar seguro y protegido. Se recomienda conservar una copia "
                    "impresa o archivada en un gestor de claves cifrado.",
                    inst_text,
                ),
            ],
            [
                Paragraph("04", ParagraphStyle('Num', parent=styles['Normal'], fontSize=9,
                           fontName='Helvetica-Bold', textColor=COLOR_PRIMARY, alignment=TA_CENTER)),
                Paragraph(
                    "El equipo de GUIOS <b>nunca le solicitará estos códigos</b> "
                    "por correo electrónico, mensajería ni soporte técnico. No los comparta.",
                    inst_text,
                ),
            ],
        ]

        inst_table = Table(instructions, colWidths=[0.9 * cm, CONTENT_W - 0.9 * cm])
        inst_table.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), COLOR_BG_CARD),
            ('BOX',           (0, 0), (-1, -1), 0.6, COLOR_BORDER_STRONG),
            ('LINEAFTER',     (0, 0), (0, -1), 0.5, COLOR_BORDER),
            ('LEFTPADDING',   (0, 0), (-1, -1), 8),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
            ('TOPPADDING',    (0, 0), (-1, -1), 6.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6.5),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            *[('LINEBELOW', (0, r), (-1, r), 0.4, COLOR_BORDER) for r in range(len(instructions) - 1)],
        ]))
        elements.append(inst_table)

        elements.append(Spacer(1, 0.5 * cm))

        # ── 4. TABLA DE CÓDIGOS DE RECUPERACIÓN ─────────────────────────────
        elements.append(Paragraph("■ &nbsp;CÓDIGOS DE RECUPERACIÓN (USO ÚNICO)", section_title))

        COL = 2
        COL_W = CONTENT_W / COL

        rows = []
        for i in range(0, len(codes), COL):
            row = []
            for j in range(COL):
                idx = i + j
                if idx < len(codes):
                    cell_content = [
                        [
                            Paragraph(f"#{idx + 1:02d}", code_num_style),
                            Paragraph(codes[idx], code_style),
                        ]
                    ]
                    cell_table = Table(cell_content, colWidths=[1.1 * cm, COL_W - 1.5 * cm])
                    cell_table.setStyle(TableStyle([
                        ('BACKGROUND',    (0, 0), (-1, -1), COLOR_WHITE),
                        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
                        ('LEFTPADDING',   (0, 0), (-1, -1), 6),
                        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
                        ('TOPPADDING',    (0, 0), (-1, -1), 9),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
                        ('LINEAFTER',     (0, 0), (0, -1), 0.5, COLOR_BORDER),
                    ]))
                    row.append(cell_table)
                else:
                    row.append("")
            rows.append(row)

        codes_table = Table(rows, colWidths=[COL_W] * COL, hAlign='LEFT')
        codes_table.setStyle(TableStyle([
            ('ALIGN',         (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('INNERGRID',     (0, 0), (-1, -1), 0.4, COLOR_BORDER),
            ('BOX',           (0, 0), (-1, -1), 0.8, COLOR_BORDER_STRONG),
            *[('BACKGROUND',  (0, r), (-1, r), COLOR_BG_CARD if r % 2 == 0 else COLOR_WHITE)
              for r in range(len(rows))],
            ('TOPPADDING',    (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(codes_table)

        elements.append(Spacer(1, 0.45 * cm))

        # ── 5. AVISO DE CONFIDENCIALIDAD ─────────────────────────────────────
        aviso = Paragraph(
            "<b>AVISO DE CONFIDENCIALIDAD:</b> Este documento contiene credenciales de seguridad de carácter "
            "estrictamente personal, confidencial e intransferible. Su divulgación, reproducción o distribución "
            "no autorizada compromete la seguridad de su cuenta en GUIOS.",
            ParagraphStyle(
                'Aviso',
                parent=styles['Normal'],
                fontSize=7,
                fontName='Helvetica',
                textColor=COLOR_TEXT_MUTED,
                leading=10,
                alignment=TA_JUSTIFY,
            ),
        )
        aviso_table = Table([[aviso]], colWidths=[CONTENT_W])
        aviso_table.setStyle(TableStyle([
            ('BOX',           (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ('BACKGROUND',    (0, 0), (-1, -1), COLOR_BG_CARD),
            ('LEFTPADDING',   (0, 0), (-1, -1), 10),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(aviso_table)

        # ── 6. PIE DE PÁGINA ─────────────────────────────────────────────────
        elements.append(Spacer(1, 0.35 * cm))

        footer_data = [
            [
                Paragraph("GUIOS · Sistema de Seguridad 2FA", footer_main),
                Paragraph("Documento generado automáticamente — Uso confidencial", footer_sub),
            ]
        ]
        footer_table = Table(footer_data, colWidths=[CONTENT_W * 0.55, CONTENT_W * 0.45])
        footer_table.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), COLOR_DARK_HEADER),
            ('LEFTPADDING',   (0, 0), (-1, -1), 12),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 12),
            ('TOPPADDING',    (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN',         (0, 0), (0, -1), 'LEFT'),
            ('ALIGN',         (1, 0), (1, -1), 'RIGHT'),
        ]))
        elements.append(footer_table)

        doc.build(elements)
        buffer.seek(0)
        return buffer
