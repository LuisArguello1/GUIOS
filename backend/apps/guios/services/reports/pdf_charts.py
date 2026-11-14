"""
apps/guios/services/reports/pdf_charts.py
─────────────────────────────────────────────────────────────────────────────
Gráficos vectoriales ReportLab (sin dependencias externas) para el informe PDF:
1. Escala lineal de cumplimiento PM global vs umbral 3.00 (portada).
2. Perfil comparativo Cleveland Dot-Bar por factor contra umbral 3.00.
3. Barra proporcional de balance estratégico FODA (F / O / D / A).
"""

from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String
from reportlab.lib import colors

from .pdf_theme import (
    INK_FAINT,
    INK_MUTED,
    INK_PRIMARY,
    INK_SECONDARY,
    RULE_LIGHT,
    RULE_MED,
    SEMANTIC_FAIL,
    SEMANTIC_OPP,
    SEMANTIC_PASS,
    SEMANTIC_WARN,
    sanitize_pdf_text,
)

FODA_SIGNAL_COLORS = {
    "strength": SEMANTIC_PASS,
    "opportunity": SEMANTIC_OPP,
    "weakness": SEMANTIC_WARN,
    "threat": SEMANTIC_FAIL,
}

FODA_SHORT_CODES = {
    "strength": "F",
    "opportunity": "O",
    "weakness": "D",
    "threat": "A",
}


def _truncate_label(text: str, max_len: int = 28) -> str:
    cleaned = sanitize_pdf_text(text).strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3].rstrip() + "..."


def build_verdict_gauge(avg_pm: float, accent_color: colors.Color, width: float = 165.0) -> Drawing:
    """
    Construye un medidor vectorial minimalista en escala 1.00 - 4.00
    con referencia fija en el umbral metodológico 3.00.
    """
    height = 38.0
    d = Drawing(width, height)

    track_x0 = 4.0
    track_w = width - 8.0
    track_y = 18.0

    def to_x(val: float) -> float:
        clamped = max(1.0, min(4.0, float(val)))
        return track_x0 + ((clamped - 1.0) / 3.0) * track_w

    # Track base
    d.add(Rect(track_x0, track_y - 2.0, track_w, 4.0, fillColor=RULE_LIGHT, strokeColor=None))

    # Segmento activo 1.0 -> avg_pm
    val_x = to_x(avg_pm)
    d.add(
        Rect(
            track_x0,
            track_y - 2.0,
            max(2.0, val_x - track_x0),
            4.0,
            fillColor=accent_color,
            strokeColor=None,
        )
    )

    # Ticks 1, 2, 3 (umbral), 4
    for tick in (1, 2, 3, 4):
        tx = to_x(float(tick))
        is_threshold = tick == 3
        tick_h = 8.0 if is_threshold else 4.5
        tick_color = INK_PRIMARY if is_threshold else INK_FAINT
        d.add(
            Line(
                tx,
                track_y - tick_h,
                tx,
                track_y + tick_h,
                strokeColor=tick_color,
                strokeWidth=1.1 if is_threshold else 0.6,
            )
        )
        lbl_color = INK_PRIMARY if is_threshold else INK_MUTED
        lbl_text = "3.0 UMB" if is_threshold else f"{tick}.0"
        d.add(
            String(
                tx,
                4.0,
                lbl_text,
                fontName="Courier-Bold" if is_threshold else "Courier",
                fontSize=5.8,
                fillColor=lbl_color,
                textAnchor="middle",
            )
        )

    # Marcador circular del promedio
    d.add(
        Circle(
            val_x,
            track_y,
            4.2,
            fillColor=accent_color,
            strokeColor=colors.white,
            strokeWidth=1.2,
        )
    )
    d.add(
        String(
            min(track_x0 + track_w - 2, max(track_x0 + 2, val_x)),
            track_y + 9.0,
            f"PM {avg_pm:.2f}",
            fontName="Courier-Bold",
            fontSize=6.8,
            fillColor=accent_color,
            textAnchor="middle" if 1.4 <= avg_pm <= 3.6 else ("start" if avg_pm < 1.4 else "end"),
        )
    )
    return d


def build_factor_benchmark_chart(factor_entries: list[dict], width: float) -> Drawing | None:
    """
    Gráfico horizontal Cleveland Dot-Bar de todos los factores evaluados frente
    al umbral metodológico 3.00. Cada entrada requiere:
      {'name': str, 'pm': float, 'ir': int | None, 'foda_key': str, 'meets': bool}
    """
    if not factor_entries:
        return None

    row_h = 15.0
    top_pad = 16.0
    bottom_pad = 18.0
    height = top_pad + bottom_pad + len(factor_entries) * row_h

    d = Drawing(width, height)

    label_col_w = width * 0.36
    meta_col_w = width * 0.16
    plot_x0 = label_col_w + 8.0
    plot_w = width - label_col_w - meta_col_w - 14.0
    plot_x1 = plot_x0 + plot_w

    def val_to_x(val: float) -> float:
        clamped = max(1.0, min(4.0, float(val)))
        return plot_x0 + ((clamped - 1.0) / 3.0) * plot_w

    # Rejilla vertical y etiquetas de escala superior/inferior
    grid_bottom = bottom_pad - 2.0
    grid_top = height - top_pad + 3.0
    for tick in (1, 2, 3, 4):
        tx = val_to_x(float(tick))
        if tick == 3:
            d.add(
                Line(
                    tx,
                    grid_bottom,
                    tx,
                    grid_top,
                    strokeColor=INK_PRIMARY,
                    strokeWidth=1.0,
                    strokeDashArray=[2.5, 2.0],
                )
            )
            d.add(
                String(
                    tx,
                    grid_top + 3.5,
                    "UMBRAL 3.00",
                    fontName="Courier-Bold",
                    fontSize=6.0,
                    fillColor=INK_PRIMARY,
                    textAnchor="middle",
                )
            )
        else:
            d.add(Line(tx, grid_bottom, tx, grid_top, strokeColor=RULE_LIGHT, strokeWidth=0.5))

        d.add(
            String(
                tx,
                4.0,
                f"{tick}.0",
                fontName="Courier",
                fontSize=6.0,
                fillColor=INK_MUTED,
                textAnchor="middle",
            )
        )

    # Filas de factores (de arriba hacia abajo)
    for idx, entry in enumerate(factor_entries):
        cy = height - top_pad - (idx * row_h) - (row_h / 2.0)

        # Banda alterna muy sutil
        if idx % 2 == 1:
            d.add(
                Rect(
                    0,
                    cy - (row_h / 2.0),
                    width,
                    row_h,
                    fillColor=colors.HexColor("#FAFAF9"),
                    strokeColor=None,
                )
            )

        # Nombre del factor
        d.add(
            String(
                2.0,
                cy - 2.2,
                _truncate_label(entry["name"], 29),
                fontName="Helvetica",
                fontSize=7.2,
                fillColor=INK_PRIMARY if entry["meets"] else SEMANTIC_FAIL,
                textAnchor="start",
            )
        )

        # Track 1.0 -> 4.0
        d.add(Line(plot_x0, cy, plot_x1, cy, strokeColor=RULE_MED, strokeWidth=0.7))

        # Segmento activo 1.0 -> PM
        pm_val = float(entry["pm"])
        px = val_to_x(pm_val)
        dot_color = FODA_SIGNAL_COLORS.get(entry.get("foda_key", ""), INK_SECONDARY)
        d.add(Line(plot_x0, cy, px, cy, strokeColor=dot_color, strokeWidth=2.0))
        d.add(
            Circle(
                px,
                cy,
                3.2,
                fillColor=dot_color,
                strokeColor=colors.white,
                strokeWidth=0.7,
            )
        )

        # Lectura derecha monospace: PM + IR + código FODA
        f_code = FODA_SHORT_CODES.get(entry.get("foda_key", ""), "-")
        ir_str = str(entry.get("ir") or "-")
        d.add(
            String(
                width - 2.0,
                cy - 2.2,
                f"{pm_val:.2f}  IR:{ir_str} [{f_code}]",
                fontName="Courier-Bold" if not entry["meets"] else "Courier",
                fontSize=6.7,
                fillColor=dot_color if not entry["meets"] else INK_SECONDARY,
                textAnchor="end",
            )
        )

    return d


def build_foda_quadrant_visual(foda_counts: dict[str, int], width: float) -> Drawing:
    """
    Construye una barra apilada proporcional de las 4 categorías FODA
    con leyenda tabular debajo.
    """
    height = 34.0
    d = Drawing(width, height)

    ordered = [
        ("strength", "FORTALEZAS (F)", SEMANTIC_PASS),
        ("opportunity", "OPORTUNIDADES (O)", SEMANTIC_OPP),
        ("weakness", "DEBILIDADES (D)", SEMANTIC_WARN),
        ("threat", "AMENAZAS (A)", SEMANTIC_FAIL),
    ]
    total = sum(foda_counts.get(k, 0) for k, _, _ in ordered)

    bar_y = 20.0
    bar_h = 8.0
    if total <= 0:
        d.add(Rect(0, bar_y, width, bar_h, fillColor=RULE_LIGHT, strokeColor=None))
    else:
        cursor_x = 0.0
        for idx, (key, _, seg_color) in enumerate(ordered):
            count = foda_counts.get(key, 0)
            if count <= 0:
                continue
            seg_w = (count / total) * width
            gap = 1.5 if idx < 3 else 0.0
            draw_w = max(2.0, seg_w - gap)
            d.add(Rect(cursor_x, bar_y, draw_w, bar_h, fillColor=seg_color, strokeColor=None))
            cursor_x += seg_w

    # Leyenda horizontal distribuida en 4 cuartos
    slot_w = width / 4.0
    for idx, (key, label, seg_color) in enumerate(ordered):
        sx = idx * slot_w
        count = foda_counts.get(key, 0)
        d.add(Rect(sx, 5.5, 5.5, 5.5, fillColor=seg_color, strokeColor=None))
        d.add(
            String(
                sx + 8.5,
                5.8,
                f"{label}: {count}",
                fontName="Courier-Bold" if count > 0 else "Courier",
                fontSize=6.4,
                fillColor=INK_PRIMARY if count > 0 else INK_MUTED,
                textAnchor="start",
            )
        )

    return d
