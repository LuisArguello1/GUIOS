import csv
import io
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from pypdf import PdfReader

from apps.auth.models.audit import AuditLog
from apps.guios.models import Evaluation, EvaluationResult, EvaluationSubfactor, EvaluationVerdict, Factor

from .admin_base import ADMIN, AdminApiTestBase


def read_csv(response):
    text = response.content.decode('utf-8')
    assert text.startswith('﻿')
    return list(csv.reader(io.StringIO(text.lstrip('﻿'))))


def pdf_text(response):
    return '\n'.join(page.extract_text() for page in PdfReader(io.BytesIO(response.content)).pages)


class EvaluationPermissionTests(AdminApiTestBase):

    def test_permissions_by_role(self):
        evaluation = self.make_evaluation()
        detail = f'{ADMIN}/evaluations/{evaluation.uuid}/'
        cases = [
            (self.nobody, f'{ADMIN}/evaluations/', 403),
            (self.nobody, f'{ADMIN}/metrics/', 403),
            (self.editor, f'{ADMIN}/evaluations/', 403),             # catálogo sí, evaluaciones no
            (self.viewer, f'{ADMIN}/evaluations/', 200),
            (self.viewer, detail, 200),
            (self.viewer, f'{ADMIN}/evaluations/export/csv/', 403),  # ver no implica exportar
            (self.viewer, f'{detail}export/pdf/', 403),
            (self.viewer, f'{ADMIN}/metrics/', 403),
            (self.exporter, f'{ADMIN}/evaluations/export/csv/', 200),
            (self.exporter, f'{detail}export/pdf/', 200),
            (self.dashboard, f'{ADMIN}/metrics/', 200),
            (self.dashboard, f'{ADMIN}/evaluations/', 403),
            (self.superuser, f'{ADMIN}/evaluations/export/csv/', 200),
        ]
        for user, url, expected in cases:
            with self.subTest(user=user.email, url=url):
                self.client.cookies.clear()
                self.assertEqual(self.as_user(user).get(url).status_code, expected)

    def test_anonymous_is_rejected(self):
        for url in (f'{ADMIN}/evaluations/', f'{ADMIN}/metrics/', f'{ADMIN}/evaluations/export/csv/'):
            with self.subTest(url=url):
                self.assertIn(self.client.get(url).status_code, (401, 403))


class HistoryTests(AdminApiTestBase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.libre = cls.make_evaluation('LibreOffice', 'UNEMI')                               # C
        cls.moodle = cls.make_evaluation('Moodle', 'Universidad de Sevilla', close=False)    # en progreso
        cls.gimp = cls.make_evaluation('GIMP', 'GAD Milagro', fill=False)                    # en progreso, vacía
        old = timezone.now() - timedelta(days=40)
        Evaluation.objects.filter(pk=cls.gimp.pk).update(started_at=old)

    def list(self, **params):
        response = self.as_user(self.viewer).get(f'{ADMIN}/evaluations/', params)
        self.assertEqual(response.status_code, 200, response.data)
        return [row['software_name'] for row in response.data['results']]

    def test_filters(self):
        self.assertEqual(self.list(), ['Moodle', 'LibreOffice', 'GIMP'])
        self.assertEqual(self.list(software='libre'), ['LibreOffice'])
        self.assertEqual(self.list(organization='sevilla'), ['Moodle'])
        self.assertEqual(self.list(recommendation='C'), ['LibreOffice'])
        self.assertEqual(self.list(recommendation='A'), [])
        self.assertEqual(self.list(status='in_progress'), ['Moodle', 'GIMP'])
        self.assertEqual(self.list(status='completed'), ['LibreOffice'])
        today = timezone.localdate()
        self.assertEqual(self.list(date_from=today - timedelta(days=1)), ['Moodle', 'LibreOffice'])
        self.assertEqual(self.list(date_to=today - timedelta(days=30)), ['GIMP'])
        self.assertEqual(self.list(status='in_progress', organization='gad'), ['GIMP'])

    def test_invalid_filters_are_rejected(self):
        client = self.as_user(self.viewer)
        self.assertEqual(client.get(f'{ADMIN}/evaluations/', {'recommendation': 'D'}).status_code, 400)
        self.assertEqual(client.get(f'{ADMIN}/evaluations/', {'date_from': 'ayer'}).status_code, 400)
        today = timezone.localdate()
        response = client.get(f'{ADMIN}/evaluations/', {'date_from': today, 'date_to': today - timedelta(days=1)})
        self.assertEqual(response.status_code, 400)

    def test_pagination(self):
        response = self.as_user(self.viewer).get(f'{ADMIN}/evaluations/', {'page_size': 2})
        self.assertEqual(response.data['count'], 3)
        self.assertEqual(len(response.data['results']), 2)
        self.assertIsNotNone(response.data['next'])
        page2 = self.as_user(self.viewer).get(f'{ADMIN}/evaluations/', {'page_size': 2, 'page': 2})
        self.assertEqual([r['software_name'] for r in page2.data['results']], ['GIMP'])

    def test_list_row(self):
        row = self.as_user(self.viewer).get(f'{ADMIN}/evaluations/', {'software': 'libre'}).data['results'][0]
        self.assertEqual(row['recommendation'], 'C')
        self.assertEqual(row['status'], 'completed')
        self.assertEqual(row['uuid'], str(self.libre.uuid))


class DetailTests(AdminApiTestBase):

    def detail(self, evaluation):
        response = self.as_user(self.viewer).get(f'{ADMIN}/evaluations/{evaluation.uuid}/')
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_completed_detail_uses_stored_results_and_verdict(self):
        evaluation = self.make_evaluation()
        # Se alteran los valores guardados: el detalle debe mostrarlos tal cual, sin recalcular.
        EvaluationResult.objects.filter(evaluation=evaluation, factor__code='ORG-FOR').update(
            weighted_average=Decimal('1.11'), foda_classification='threat',
        )
        EvaluationVerdict.objects.filter(evaluation=evaluation).update(explanation_text='Texto guardado.')
        data = self.detail(evaluation)
        self.assertEqual(data['results_source'], 'stored')
        formation = next(f for f in data['factors'] if f['code'] == 'ORG-FOR')
        self.assertEqual(formation['weighted_average'], '1.11')
        self.assertEqual(formation['foda'], 'threat')
        self.assertEqual(data['verdict']['recommendation'], 'C')
        self.assertEqual(data['verdict']['explanation_text'], 'Texto guardado.')
        self.assertEqual(data['missing'], [])

    def test_completed_detail_uses_snapshots(self):
        evaluation = self.make_evaluation()
        Factor.objects.filter(code='TEC-USA').update(name='Usabilidad (editado)', suggested_importance=4)
        data = self.detail(evaluation)
        usability = next(f for f in data['factors'] if f['code'] == 'TEC-USA')
        self.assertEqual(usability['name'], 'Usabilidad')
        self.assertEqual(usability['suggested_importance'], 2)
        self.assertEqual((usability['decisor_importance'], usability['relative_importance']), (3, 2))
        self.assertEqual(len(usability['subfactors']), 4)
        personalization = next(f for f in data['factors'] if f['code'] == 'TEC-PER')
        self.assertEqual([s['rating'] for s in personalization['failing_subfactors']], [1, 1, 2, 2, 2, 2])
        self.assertEqual(data['evaluation']['software_name'], 'LibreOffice')

    def test_in_progress_detail_is_calculated_with_the_engine(self):
        evaluation = self.make_evaluation(close=False)
        EvaluationSubfactor.objects.filter(evaluation=evaluation, subfactor__code='TEC-COM-01').update(rating=None)
        data = self.detail(evaluation)
        self.assertEqual(data['results_source'], 'calculated')
        self.assertIsNone(data['verdict'])
        compatibility = next(f for f in data['factors'] if f['code'] == 'TEC-COM')
        self.assertIsNone(compatibility['weighted_average'])
        self.assertEqual([m['kind'] for m in data['missing']], ['subfactor_rating'])
        formation = next(f for f in data['factors'] if f['code'] == 'ORG-FOR')
        self.assertEqual((formation['weighted_average'], formation['foda']), ('2.75', 'weakness'))

    def test_unknown_evaluation_is_404(self):
        response = self.as_user(self.viewer).get(f'{ADMIN}/evaluations/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(response.status_code, 404)


class ExportTests(AdminApiTestBase):

    def test_csv_content_filters_and_audit(self):
        self.make_evaluation('LibreOffice', 'UNEMI')
        self.make_evaluation('Moodle', 'UNEMI', close=False)
        before = AuditLog.objects.filter(action='EXPORT').count()
        response = self.as_user(self.exporter).get(f'{ADMIN}/evaluations/export/csv/', {'status': 'completed'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('text/csv'))
        self.assertIn('attachment; filename="evaluaciones-guios-', response['Content-Disposition'])
        rows = read_csv(response)
        self.assertEqual(rows[0][:7], ['UUID', 'Software', 'Versión', 'Organización', 'Sector', 'Estado', 'Dictamen'])
        self.assertEqual(len(rows), 2)
        self.assertEqual((rows[1][1], rows[1][5], rows[1][6]), ('LibreOffice', 'Completada', 'C'))

        log = AuditLog.objects.filter(action='EXPORT').latest('pk')
        self.assertEqual(AuditLog.objects.filter(action='EXPORT').count(), before + 1)
        self.assertEqual(log.user, self.exporter)
        self.assertEqual(log.extra['format'], 'csv')
        self.assertEqual(log.extra['rows'], 1)
        self.assertEqual(log.extra['filters'], {'status': 'completed'})
        self.assertTrue(log.verify_integrity())

    def test_csv_neutralizes_formulas(self):
        for name in ('=1+1', '+SUM(A1:A9)', '-2+3', '@cmd', 'B&R Normal'):
            self.make_evaluation(software=name, org='=HYPERLINK("http://x")', fill=False)
        rows = read_csv(self.as_user(self.exporter).get(f'{ADMIN}/evaluations/export/csv/'))
        names = {row[1] for row in rows[1:]}
        self.assertEqual(names, {"'=1+1", "'+SUM(A1:A9)", "'-2+3", "'@cmd", 'B&R Normal'})
        self.assertTrue(all(row[3] == '\'=HYPERLINK("http://x")' for row in rows[1:]))

    def test_pdf_is_generated_with_stored_results_and_audited(self):
        evaluation = self.make_evaluation(software='B&R <Office>', org='Ñandú & Cía.')
        EvaluationVerdict.objects.filter(evaluation=evaluation).update(explanation_text='Texto guardado & verificado <ok>.')
        EvaluationResult.objects.filter(evaluation=evaluation, factor__code='ORG-FOR').update(weighted_average=Decimal('1.11'))
        response = self.as_user(self.exporter).get(f'{ADMIN}/evaluations/{evaluation.uuid}/export/pdf/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))
        text = pdf_text(response)
        self.assertIn('B&R <Office>', text)
        self.assertIn('Ñandú & Cía.', text)
        self.assertIn('Texto guardado & verificado <ok>.', text)
        self.assertIn('Formación (PM 1.11)', text)              # resultado guardado, no recalculado
        self.assertIn('Recomendación C', text)

        log = AuditLog.objects.filter(action='EXPORT').latest('pk')
        self.assertEqual(log.object_id, str(evaluation.uuid))
        self.assertEqual(log.extra['results_source'], 'stored')
        self.assertEqual(log.user, self.exporter)

    def test_pdf_of_in_progress_evaluation(self):
        evaluation = self.make_evaluation(close=False)
        response = self.as_user(self.exporter).get(f'{ADMIN}/evaluations/{evaluation.uuid}/export/pdf/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('todavía no hay dictamen', pdf_text(response))


class MetricsTests(AdminApiTestBase):

    def test_metrics(self):
        empty = self.as_user(self.dashboard).get(f'{ADMIN}/metrics/').data
        self.assertEqual((empty['total'], empty['verdicts']), (0, {'A': 0, 'B': 0, 'C': 0}))

        self.make_evaluation('LibreOffice', 'UNEMI')                 # C
        self.make_evaluation('Moodle', 'UNEMI', close=False)
        for i in range(11):
            self.make_evaluation(f'Software {i}', 'UNEMI', fill=False)
        EvaluationVerdict.objects.create(
            evaluation=self.make_evaluation('Otra', 'UNEMI', fill=False), recommendation='A', explanation_text='x',
        )
        data = self.as_user(self.dashboard).get(f'{ADMIN}/metrics/').data
        self.assertEqual(data['total'], 14)
        self.assertEqual(data['completed'], 1)
        self.assertEqual(data['in_progress'], 13)
        self.assertEqual(data['verdicts'], {'A': 1, 'B': 0, 'C': 1})
        self.assertEqual(len(data['recent']), 10)
        self.assertEqual(data['recent'][0]['software_name'], 'Otra')
        self.assertEqual(set(data['recent'][0]), {'uuid', 'software_name', 'org_name', 'status', 'recommendation', 'started_at', 'completed_at'})
