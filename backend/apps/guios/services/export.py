"""
Exportaciones del panel (RF-ADM-36): historial en CSV y detalle en PDF.
Cada exportación queda en la auditoría con la acción EXPORT (RF-ADM-37).
"""
import csv
import io
import uuid as uuid_lib
from xml.sax.saxutils import escape

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.auth.middleware.audit import get_audit_context
from apps.auth.models.audit import AuditLog
from apps.core.models.organization import Organization

from ..models import Evaluation, EvaluationFactor, EvaluationSubfactor, EvaluationVerdict

FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')

IMPORTANCE_LABELS = dict(EvaluationFactor.IMPORTANCE_CHOICES)
RATING_LABELS = dict(EvaluationSubfactor.RATING_CHOICES)
FODA_LABELS = {'strength': 'Fortaleza', 'weakness': 'Debilidad', 'opportunity': 'Oportunidad', 'threat': 'Amenaza'}
SCOPE_LABELS = {'internal': 'Interno', 'external': 'Externo'}
STATUS_LABELS = dict(Evaluation.STATUS_CHOICES)
RECOMMENDATION_LABELS = dict(EvaluationVerdict.RECOMMENDATION_CHOICES)

CSV_HEADER = [
    'UUID', 'Software', 'Versión', 'Organización', 'Sector', 'Estado', 'Dictamen',
    'Inicio', 'Finalización',
]


def safe_cell(value) -> str:
    """Evita que Excel o LibreOffice interpreten la celda como fórmula (CSV injection)."""
    text = '' if value is None else str(value)
    return f"'{text}" if text.startswith(FORMULA_PREFIXES) else text


def _format_datetime(value) -> str:
    return timezone.localtime(value).strftime('%Y-%m-%d %H:%M') if value else ''


def _audit_export(*, user, object_id: str, reason: str, extra: dict):
    ctx = get_audit_context()
    request_id = ctx.get('request_id')
    try:
        request_id = uuid_lib.UUID(str(request_id)) if request_id else None
    except ValueError:
        request_id = None
    AuditLog.objects.create(
        action='EXPORT',
        source='api',
        reason=reason,
        content_type=ContentType.objects.get_for_model(Evaluation),
        object_id=object_id,
        user=user if getattr(user, 'is_authenticated', False) else None,
        ip_address=ctx.get('ip_address'),
        user_agent=ctx.get('user_agent') or '',
        session_key=ctx.get('session_key') or '',
        request_id=request_id,
        extra=extra,
    )


# ── CSV ───────────────────────────────────────────────────────────────────────

def export_history_csv(evaluations, *, user, filters: dict) -> bytes:
    """Historial filtrado en CSV (UTF-8 con BOM para Excel) y registro EXPORT."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADER)
    rows = 0
    for evaluation in evaluations:
        verdict = getattr(evaluation, 'verdict', None)
        writer.writerow([safe_cell(value) for value in (
            evaluation.uuid,
            evaluation.software_name,
            evaluation.software_version,
            evaluation.org_name,
            evaluation.org_sector,
            STATUS_LABELS.get(evaluation.status, evaluation.status),
            verdict.recommendation if verdict else '',
            _format_datetime(evaluation.started_at),
            _format_datetime(evaluation.completed_at),
        )])
        rows += 1
    _audit_export(
        user=user,
        object_id='history',
        reason=f"Exportación CSV del historial ({rows} evaluaciones)",
        extra={'format': 'csv', 'rows': rows, 'filters': {k: str(v) for k, v in filters.items() if v}},
    )
    return ('﻿' + buffer.getvalue()).encode('utf-8')


# ── PDF ───────────────────────────────────────────────────────────────────────

def _p(text, style):
    """Párrafo con el texto escapado: ReportLab interpreta marcas en Paragraph."""
    return Paragraph(escape('' if text is None else str(text)).replace('\n', '<br/>'), style)


def _table(rows, widths, header=True):
    table = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#C8CCD2')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]
    if header:
        style.append(('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ECFDF5')))
    table.setStyle(TableStyle(style))
    return table


def build_evaluation_pdf(detail: dict) -> bytes:
    """Detalle de una evaluación en PDF (membrete de la organización, RN-10)."""
    evaluation = detail['evaluation']
    styles = getSampleStyleSheet()
    body = ParagraphStyle('body', parent=styles['BodyText'], fontSize=9, leading=12, alignment=TA_LEFT)
    small = ParagraphStyle('small', parent=body, fontSize=8, leading=10)
    h1 = ParagraphStyle('h1', parent=styles['Heading1'], fontSize=15, spaceAfter=4)
    h2 = ParagraphStyle('h2', parent=styles['Heading2'], fontSize=11, spaceBefore=10, spaceAfter=4)

    organization = Organization.objects.first()
    story = []
    if organization:
        story.append(_p(organization.name, ParagraphStyle('org', parent=body, fontSize=11, leading=14)))
        if organization.slogan:
            story.append(_p(organization.slogan, small))
    story.append(_p('Detalle de evaluación GUIOS', h1))
    story.append(_p(f"Generado el {_format_datetime(timezone.now())}", small))

    story.append(_p('Software y organización', h2))
    data = [
        ('Software', f"{evaluation.software_name} {evaluation.software_version}".strip()),
        ('Repositorio', evaluation.software_repo_url or ''),
        ('Organización', evaluation.org_name),
        ('Sector', evaluation.org_sector),
        ('Descripción', evaluation.org_description),
        ('Estado', STATUS_LABELS.get(evaluation.status, evaluation.status)),
        ('Inicio', _format_datetime(evaluation.started_at)),
        ('Finalización', _format_datetime(evaluation.completed_at)),
        ('Identificador', str(evaluation.uuid)),
    ]
    story.append(_table([[_p(k, body), _p(v, body)] for k, v in data], [4 * cm, 13 * cm], header=False))

    verdict = detail['verdict']
    story.append(_p('Dictamen', h2))
    if verdict:
        story.append(_p(RECOMMENDATION_LABELS.get(verdict.recommendation, verdict.recommendation),
                        ParagraphStyle('verdict', parent=body, fontSize=11, leading=14)))
        story.append(Spacer(1, 4))
        story.append(_p(verdict.explanation_text, body))
        if verdict.ai_executive_summary:
            story.append(_p('Resumen ejecutivo (IA, orientativo)', h2))
            story.append(_p(verdict.ai_executive_summary, body))
        if verdict.ai_mitigation_plan:
            story.append(_p('Plan de mitigación (IA, orientativo)', h2))
            story.append(_p(verdict.ai_mitigation_plan, body))
    else:
        story.append(_p('Evaluación en progreso: todavía no hay dictamen.', body))

    factors = detail['factors']
    relevant = [f for f in factors if f['is_relevant'] and f['foda']]
    story.append(_p('Matriz FODA', h2))
    quadrant = lambda key: '<br/>'.join(  # noqa: E731
        escape(f"{f['name']} (PM {f['weighted_average']})") for f in relevant if f['foda'] == key
    ) or 'Ningún factor'
    story.append(_table([
        [_p('Fortalezas (interno, PM >= 3)', body), _p('Debilidades (interno, PM < 3)', body)],
        [Paragraph(quadrant('strength'), body), Paragraph(quadrant('weakness'), body)],
        [_p('Oportunidades (externo, PM >= 3)', body), _p('Amenazas (externo, PM < 3)', body)],
        [Paragraph(quadrant('opportunity'), body), Paragraph(quadrant('threat'), body)],
    ], [8.5 * cm, 8.5 * cm], header=False))

    story.append(_p('Factores', h2))
    rows = [[_p(h, small) for h in ('Factor', 'IS', 'ID', 'IR', 'Ámbito', 'PM', 'FODA')]]
    for f in factors:
        rows.append([_p(cell, small) for cell in (
            f['name'],
            IMPORTANCE_LABELS.get(f['suggested_importance'], ''),
            IMPORTANCE_LABELS.get(f['decisor_importance'], 'Sin calificar'),
            IMPORTANCE_LABELS.get(f['relative_importance'], ''),
            SCOPE_LABELS.get(f['scope_used'], 'Sin elegir'),
            f['weighted_average'] if f['weighted_average'] is not None else '',
            FODA_LABELS.get(f['foda'], 'No relevante' if f['is_relevant'] is False else ''),
        )])
    story.append(_table(rows, [5 * cm, 2 * cm, 2 * cm, 2 * cm, 1.8 * cm, 1.4 * cm, 2.8 * cm]))

    story.append(_p('Calificación de los subfactores', h2))
    for f in factors:
        if not f['is_relevant']:
            continue
        story.append(_p(f['name'], ParagraphStyle('fname', parent=body, fontName='Helvetica-Bold', spaceBefore=6)))
        story.append(_table(
            [[_p('Criterio', small), _p('Calificación', small)]]
            + [[_p(s['description'], small), _p(RATING_LABELS.get(s['rating'], 'Sin calificar'), small)]
               for s in f['subfactors']],
            [12.5 * cm, 4.5 * cm],
        ))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title=f"Evaluación GUIOS - {evaluation.software_name}", author=organization.name if organization else 'GUIOS',
    )
    doc.build(story)
    return buffer.getvalue()


def export_evaluation_pdf(detail: dict, *, user) -> bytes:
    content = build_evaluation_pdf(detail)
    evaluation = detail['evaluation']
    _audit_export(
        user=user,
        object_id=str(evaluation.uuid),
        reason=f"Exportación PDF de la evaluación «{evaluation.software_name}»",
        extra={'format': 'pdf', 'evaluation_uuid': str(evaluation.uuid), 'results_source': detail['results_source']},
    )
    return content
