"""
apps/guios/services/reports/pdf_theme.py
─────────────────────────────────────────────────────────────────────────────
Sistema de diseño tipográfico y utilidades de saneamiento/Markdown para
el informe PDF de auditoría técnica GUIOS (estética Editorial Suiza / Grafito).
"""

import re
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle


# ── Paleta Editorial Grafito & Titanio + Semántica Quirúrgica ────────────────
INK_PRIMARY = colors.HexColor("#18181B")     # Tinta principal (Zinc-900)
INK_DARK = colors.HexColor("#111827")        # Títulos de alto contraste
INK_SECONDARY = colors.HexColor("#3F3F46")   # Cuerpo técnico (Zinc-700)
INK_MUTED = colors.HexColor("#71717A")       # Metadatos y rótulos (Zinc-500)
INK_FAINT = colors.HexColor("#A1A1AA")       # Ticks y líneas auxiliares

RULE_HEAVY = colors.HexColor("#18181B")      # Filetes estructurales (1.2pt)
RULE_MED = colors.HexColor("#D4D4D8")        # Separadores medios (0.7pt)
RULE_LIGHT = colors.HexColor("#E4E4E7")      # Hairlines de tabla (0.45pt)

PAPER_WHITE = colors.HexColor("#FFFFFF")
SURFACE_ALT = colors.HexColor("#FAFAF9")     # Alternancia sutil (Warm Alabaster)
SURFACE_BAND = colors.HexColor("#F4F4F5")    # Bandas técnicas suaves

# Semántica estrictamente reservada para dictamen, umbral y FODA
SEMANTIC_PASS = colors.HexColor("#047857")
SEMANTIC_PASS_BG = colors.HexColor("#ECFDF5")

SEMANTIC_WARN = colors.HexColor("#B45309")
SEMANTIC_WARN_BG = colors.HexColor("#FFFBEB")

SEMANTIC_FAIL = colors.HexColor("#B91C1C")
SEMANTIC_FAIL_BG = colors.HexColor("#FEF2F2")

SEMANTIC_OPP = colors.HexColor("#1D4ED8")
SEMANTIC_OPP_BG = colors.HexColor("#EFF6FF")

RECOMMENDATION_META = {
    "A": {
        "title": "ADOPTAR SIN OBSERVACIONES",
        "short": "Adopción directa",
        "hex": "#047857",
        "color": SEMANTIC_PASS,
        "bg": SEMANTIC_PASS_BG,
        "rule_text": "Todos los factores críticos e importantes alcanzan o superan el umbral 3.00.",
    },
    "B": {
        "title": "ADOPTAR CON MATICES",
        "short": "Adopción condicionada",
        "hex": "#B45309",
        "color": SEMANTIC_WARN,
        "bg": SEMANTIC_WARN_BG,
        "rule_text": "Existen brechas moderadas o bajo umbral que exigen plan de mitigación.",
    },
    "C": {
        "title": "POSPONER Y ANALIZAR ADOPCIÓN",
        "short": "Posponer adopción",
        "hex": "#B91C1C",
        "color": SEMANTIC_FAIL,
        "bg": SEMANTIC_FAIL_BG,
        "rule_text": "Se registran factores críticos por debajo de 3.00 con impacto directo.",
    },
    "N/A": {
        "title": "EN PROCESO DE EVALUACIÓN",
        "short": "Evaluación abierta",
        "hex": "#52525B",
        "color": INK_SECONDARY,
        "bg": SURFACE_BAND,
        "rule_text": "Dictamen definitivo pendiente de cierre metodológico.",
    },
}


def sanitize_pdf_text(text: str) -> str:
    """Normaliza signos Unicode incompatibles con las fuentes Type1 de ReportLab."""
    if not text:
        return ""
    replacements = {
        "\u2011": "-",
        "\u2010": "-",
        "\u2212": "-",
        "\u2013": "-",
        "\u2014": " -- ",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u00a0": " ",
        "\u202f": " ",
        "\u2022": "-",
        "\u25a0": "*",
        "\u2265": ">=",
        "\u2264": "<=",
        "\u2192": "->",
        "\u21d2": "=>",
        "\u2713": "[OK]",
        "\u2717": "[X]",
        "\u00d7": "x",
        "\u2211": "Sum",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    # Eliminar caracteres fuera del rango Latin-1 / WinAnsi que renderizan cajas negras
    return "".join(ch if ord(ch) < 256 else " " for ch in text)


def render_inline_markup(raw_text: str) -> str:
    """
    Escapa caracteres XML especiales primero y luego convierte **negrita** y `código`
    a etiquetas válidas de ReportLab sin romper `<`, `>` o `&`.
    """
    cleaned = sanitize_pdf_text(raw_text)
    escaped = xml_escape(cleaned)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`([^`]+?)`", r"<font face='Courier'>\1</font>", escaped)
    return escaped


def parse_markdown_to_editorial_flowables(raw_text: str, styles: dict) -> list:
    """
    Convierte texto Markdown del resumen o recomendaciones en elementos editoriales
    limpios (sin cajas grises ni emojis), listos para insertar directo en el folio.
    """
    if not raw_text:
        return []

    elements = []
    lines = raw_text.strip().split("\n")

    for line in lines:
        stripped = line.strip()
        if not stripped:
            elements.append(Spacer(1, 3))
            continue

        if stripped.startswith("### "):
            heading = render_inline_markup(stripped[4:].strip())
            elements.append(Spacer(1, 3))
            elements.append(Paragraph(heading.upper(), styles["editorial_subhead"]))
        elif stripped.startswith("## "):
            heading = render_inline_markup(stripped[3:].strip())
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(heading, styles["editorial_h3"]))
        elif stripped.startswith("# "):
            heading = render_inline_markup(stripped[2:].strip())
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(heading, styles["editorial_h3"]))
        elif stripped.startswith(("- ", "* ")):
            item = render_inline_markup(stripped[2:].strip())
            elements.append(
                Paragraph(
                    f"<font face='Courier' color='#18181B'><b>--</b></font>  {item}",
                    styles["editorial_bullet"],
                )
            )
        elif re.match(r"^\d+[\.\)]\s+", stripped):
            match = re.match(r"^(\d+[\.\)])\s+(.*)$", stripped)
            if match:
                idx_lbl = xml_escape(match.group(1))
                body = render_inline_markup(match.group(2))
                elements.append(
                    Paragraph(
                        f"<font face='Courier' color='#18181B'><b>{idx_lbl}</b></font> {body}",
                        styles["editorial_bullet"],
                    )
                )
        else:
            elements.append(Paragraph(render_inline_markup(stripped), styles["editorial_body"]))

    return elements


def build_section_header(index_code: str, title: str, right_meta: str, width: float, styles: dict) -> Table:
    """
    Encabezado de sección estilo monografía editorial: índice en Courier,
    título en Helvetica-Bold y línea base anclada de 1.2pt.
    """
    left_html = (
        f"<font face='Courier' size='7.5' color='#71717A'>{xml_escape(index_code)} //</font> "
        f"<font face='Helvetica-Bold' size='11.5' color='#18181B'>{xml_escape(sanitize_pdf_text(title))}</font>"
    )
    right_html = (
        f"<font face='Courier' size='7.5' color='#52525B'>{xml_escape(sanitize_pdf_text(right_meta))}</font>"
        if right_meta
        else ""
    )
    tbl = Table(
        [[Paragraph(left_html, styles["raw_left"]), Paragraph(right_html, styles["raw_right"])]],
        colWidths=[width * 0.72, width * 0.28],
    )
    tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 1.1, RULE_HEAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))
    return tbl


def build_editorial_styles() -> dict:
    """Registra la hoja tipográfica coherente para todo el informe PDF."""
    base = getSampleStyleSheet()["Normal"]
    return {
        "eyebrow": ParagraphStyle(
            "EditorialEyebrow",
            parent=base,
            fontName="Courier-Bold",
            fontSize=7.5,
            leading=10,
            textColor=INK_MUTED,
        ),
        "cover_title": ParagraphStyle(
            "EditorialCoverTitle",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=27,
            textColor=INK_DARK,
        ),
        "cover_version": ParagraphStyle(
            "EditorialCoverVersion",
            parent=base,
            fontName="Courier",
            fontSize=10,
            leading=13,
            textColor=INK_MUTED,
        ),
        "cover_sub": ParagraphStyle(
            "EditorialCoverSub",
            parent=base,
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=INK_SECONDARY,
        ),
        "raw_left": ParagraphStyle(
            "RawLeft",
            parent=base,
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=INK_PRIMARY,
            alignment=TA_LEFT,
        ),
        "raw_right": ParagraphStyle(
            "RawRight",
            parent=base,
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=INK_MUTED,
            alignment=TA_RIGHT,
        ),
        "raw_center": ParagraphStyle(
            "RawCenter",
            parent=base,
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=INK_PRIMARY,
            alignment=TA_CENTER,
        ),
        "editorial_h3": ParagraphStyle(
            "EditorialH3",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=13,
            textColor=INK_DARK,
            spaceAfter=2,
        ),
        "editorial_subhead": ParagraphStyle(
            "EditorialSubhead",
            parent=base,
            fontName="Courier-Bold",
            fontSize=7.5,
            leading=10,
            textColor=INK_SECONDARY,
            spaceAfter=2,
        ),
        "editorial_body": ParagraphStyle(
            "EditorialBody",
            parent=base,
            fontName="Helvetica",
            fontSize=8.6,
            leading=12.6,
            textColor=INK_SECONDARY,
            alignment=TA_JUSTIFY,
            spaceAfter=3,
        ),
        "editorial_bullet": ParagraphStyle(
            "EditorialBullet",
            parent=base,
            fontName="Helvetica",
            fontSize=8.4,
            leading=12,
            textColor=INK_SECONDARY,
            leftIndent=10,
            firstLineIndent=-8,
            spaceAfter=2,
        ),
        "kpi_label": ParagraphStyle(
            "EditorialKpiLabel",
            parent=base,
            fontName="Courier-Bold",
            fontSize=6.8,
            leading=9,
            textColor=INK_MUTED,
        ),
        "kpi_value": ParagraphStyle(
            "EditorialKpiValue",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=16.5,
            leading=19,
            textColor=INK_DARK,
        ),
        "kpi_sub": ParagraphStyle(
            "EditorialKpiSub",
            parent=base,
            fontName="Helvetica",
            fontSize=7.2,
            leading=9.5,
            textColor=INK_MUTED,
        ),
        "th_left": ParagraphStyle(
            "ThLeft",
            parent=base,
            fontName="Courier-Bold",
            fontSize=6.8,
            leading=8.5,
            textColor=INK_MUTED,
            alignment=TA_LEFT,
        ),
        "th_center": ParagraphStyle(
            "ThCenter",
            parent=base,
            fontName="Courier-Bold",
            fontSize=6.8,
            leading=8.5,
            textColor=INK_MUTED,
            alignment=TA_CENTER,
        ),
        "th_right": ParagraphStyle(
            "ThRight",
            parent=base,
            fontName="Courier-Bold",
            fontSize=6.8,
            leading=8.5,
            textColor=INK_MUTED,
            alignment=TA_RIGHT,
        ),
        "td_left": ParagraphStyle(
            "TdLeft",
            parent=base,
            fontName="Helvetica",
            fontSize=7.8,
            leading=10.5,
            textColor=INK_PRIMARY,
            alignment=TA_LEFT,
        ),
        "td_muted": ParagraphStyle(
            "TdMuted",
            parent=base,
            fontName="Helvetica",
            fontSize=7.4,
            leading=10,
            textColor=INK_MUTED,
            alignment=TA_LEFT,
        ),
        "td_mono_center": ParagraphStyle(
            "TdMonoCenter",
            parent=base,
            fontName="Courier",
            fontSize=7.5,
            leading=10,
            textColor=INK_PRIMARY,
            alignment=TA_CENTER,
        ),
        "td_mono_right": ParagraphStyle(
            "TdMonoRight",
            parent=base,
            fontName="Courier",
            fontSize=7.5,
            leading=10,
            textColor=INK_PRIMARY,
            alignment=TA_RIGHT,
        ),
        "foda_list": ParagraphStyle(
            "FodaList",
            parent=base,
            fontName="Helvetica",
            fontSize=7.8,
            leading=11.5,
            textColor=INK_SECONDARY,
        ),
    }
