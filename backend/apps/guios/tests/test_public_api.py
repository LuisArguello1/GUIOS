from io import StringIO
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.auth.models.audit import AuditLog
from apps.guios.models import (
    Evaluation,
    EvaluationFactor,
    EvaluationResult,
    EvaluationSubfactor,
    EvaluationVerdict,
    Factor,
    Subfactor,
)
from apps.guios.selectors.evaluation import build_engine_inputs, evaluation_factors
from apps.guios.services import engine
from apps.guios.services import evaluation as evaluation_service

BASE = '/api/v1/guios/public'

REGISTRATION = {
    'software_name': 'LibreOffice',
    'software_version': '7.6',
    'software_repo_url': 'https://git.libreoffice.org/core',
    'org_name': 'UNEMI',
    'org_sector': 'Educación superior',
    'org_description': 'Universidad pública con 1 200 equipos de escritorio.',
}

# Caso UNEMI con LibreOffice (tesis, Figs. 6.3-6.5): código -> (ID, calificaciones).
UNEMI = {
    'TEC-COM': (4, [4, 4, 4, 4, 4, 4, 4, 2]),
    'TEC-PER': (3, [1, 1, 2, 2, 2, 2]),
    'TEC-FIA': (3, [4, 3, 3, 3, 3]),
    'TEC-REU': (2, [3, 3]),
    'TEC-USA': (3, [4, 3, 4, 3]),
    'TEC-DOC': (3, [3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2]),
    'TEC-MAN': (3, [4]),
    'TEC-POR': (3, [2, 2]),
    'TEC-PRU': (3, [3]),
    'ORG-SOP': (4, [3, 3, 2, 2, 2, 2]),
    'ORG-TIE': (2, [4, 3]),
    'ORG-FOR': (3, [3, 3, 3, 2]),
    'ORG-CAS': (2, [3]),
    'ORG-CEN': (2, [3, 2]),
    'ORG-APO': (3, [4]),
    'ORG-BLO': (2, [2]),
    'ORG-ACT': (2, [3, 3]),
    'ECO-TCO': (3, [4, 3]),
}


class PublicApiTestBase(APITestCase):

    @classmethod
    def setUpTestData(cls):
        call_command('seed_guios_catalog', stdout=StringIO())

    def setUp(self):
        cache.clear()   # límites de peticiones (django-ratelimit y throttle)

    def create(self, **overrides):
        response = self.client.post(f'{BASE}/evaluations/', {**REGISTRATION, **overrides}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['uuid'], response.data['session_token']

    def headers(self, token):
        return {'HTTP_X_EVALUATION_TOKEN': token}

    def get(self, uuid, path='', token=None):
        return self.client.get(f'{BASE}/evaluations/{uuid}/{path}', **self.headers(token) if token else {})

    def patch_factor(self, uuid, token, code, **data):
        factor_id = Factor.objects.get(code=code).pk
        return self.client.patch(
            f'{BASE}/evaluations/{uuid}/factors/{factor_id}/', data, format='json', **self.headers(token),
        )

    def patch_rating(self, uuid, token, code, rating):
        subfactor_id = Subfactor.objects.get(code=code).pk
        return self.client.patch(
            f'{BASE}/evaluations/{uuid}/subfactors/{subfactor_id}/', {'rating': rating},
            format='json', **self.headers(token),
        )

    def post_verdict(self, uuid, token):
        return self.client.post(f'{BASE}/evaluations/{uuid}/verdict/', **self.headers(token))

    def fill_unemi(self, uuid, token):
        for code, (id_, ratings) in UNEMI.items():
            self.assertEqual(self.patch_factor(uuid, token, code, decisor_importance=id_).status_code, 200)
            subfactors = Subfactor.objects.filter(factor__code=code).order_by('order', 'id')
            for subfactor, rating in zip(subfactors, ratings):
                self.assertEqual(self.patch_rating(uuid, token, subfactor.code, rating).status_code, 200)
        return self.patch_factor(uuid, token, 'ORG-SOP', scope_used='internal')


class CatalogTests(PublicApiTestBase):

    def test_catalog_lists_active_items_in_order(self):
        response = self.client.get(f'{BASE}/catalog/')
        self.assertEqual(response.status_code, 200)
        dimensions = response.data['dimensions']
        self.assertEqual([d['code'] for d in dimensions], ['TEC', 'ORG', 'ECO'])
        factors = [f for d in dimensions for f in d['factors']]
        self.assertEqual(len(factors), 18)
        self.assertEqual(sum(len(f['subfactors']) for f in factors), 61)
        self.assertEqual(factors[0]['code'], 'TEC-COM')
        self.assertEqual(factors[0]['subfactors'][0]['code'], 'TEC-COM-01')
        usability = next(f for f in factors if f['code'] == 'TEC-USA')
        self.assertEqual(usability['suggested_importance'], 2)
        self.assertEqual(usability['suggested_importance_label'], 'Opcional')
        self.assertTrue(usability['description'])
        support = next(f for f in factors if f['code'] == 'ORG-SOP')
        self.assertTrue(support['scope_configurable'])
        self.assertEqual([s['value'] for s in response.data['rating_scale']], [1, 2, 3, 4])

    def test_catalog_excludes_inactive_and_factors_without_active_subfactors(self):
        Subfactor.objects.filter(factor__code='TEC-PRU').update(is_active=False)
        Factor.objects.filter(code='TEC-MAN').update(is_active=False)
        Subfactor.objects.filter(code='TEC-COM-01').update(is_active=False)
        Subfactor.objects.filter(factor__code='ECO-TCO').update(is_active=False)

        response = self.client.get(f'{BASE}/catalog/')
        dimensions = response.data['dimensions']
        self.assertEqual([d['code'] for d in dimensions], ['TEC', 'ORG'])
        codes = [f['code'] for d in dimensions for f in d['factors']]
        self.assertNotIn('TEC-PRU', codes)
        self.assertNotIn('TEC-MAN', codes)
        self.assertEqual(len(codes), 15)
        compatibility = next(f for d in dimensions for f in d['factors'] if f['code'] == 'TEC-COM')
        self.assertNotIn('TEC-COM-01', [s['code'] for s in compatibility['subfactors']])

    def test_expired_jwt_cookie_does_not_cause_401(self):
        self.client.cookies['access_token'] = 'token-caducado'
        self.assertEqual(self.client.get(f'{BASE}/catalog/').status_code, 200)
        uuid, token = self.create()
        self.assertEqual(self.get(uuid, token=token).status_code, 200)


class CreateEvaluationTests(PublicApiTestBase):

    def test_creation_copies_snapshots_and_starts_unrated(self):
        uuid, token = self.create()
        evaluation = Evaluation.objects.get(uuid=uuid)
        self.assertEqual(evaluation.status, Evaluation.STATUS_IN_PROGRESS)
        self.assertEqual(EvaluationFactor.objects.filter(evaluation=evaluation).count(), 18)
        self.assertEqual(EvaluationSubfactor.objects.filter(evaluation=evaluation).count(), 61)
        self.assertFalse(EvaluationFactor.objects.filter(evaluation=evaluation, decisor_importance__isnull=False).exists())
        self.assertFalse(EvaluationSubfactor.objects.filter(evaluation=evaluation, rating__isnull=False).exists())

        usability = EvaluationFactor.objects.get(evaluation=evaluation, factor__code='TEC-USA')
        self.assertEqual(usability.suggested_importance_snapshot, 2)
        self.assertEqual(usability.factor_name_snapshot, 'Usabilidad')
        self.assertEqual(usability.scope_used, 'external')
        support = EvaluationFactor.objects.get(evaluation=evaluation, factor__code='ORG-SOP')
        self.assertEqual(support.scope_used, '')
        subfactor = EvaluationSubfactor.objects.get(evaluation=evaluation, subfactor__code='ECO-TCO-02')
        self.assertEqual(subfactor.description_snapshot, Subfactor.objects.get(code='ECO-TCO-02').description)

    def test_token_is_returned_once_and_stored_hashed(self):
        uuid, token = self.create()
        evaluation = Evaluation.objects.get(uuid=uuid)
        self.assertNotEqual(evaluation.session_token, token)
        self.assertEqual(len(evaluation.session_token), 64)
        detail = self.get(uuid, token=token)
        self.assertNotIn('session_token', detail.data)

    def test_catalog_changes_do_not_alter_started_evaluation(self):
        uuid, token = self.create()
        Factor.objects.filter(code='TEC-USA').update(name='Usabilidad (editado)', suggested_importance=4)
        Subfactor.objects.filter(code='TEC-USA-01').update(description='Texto editado')
        Subfactor.objects.create(factor=Factor.objects.get(code='TEC-USA'), description='Subfactor nuevo')

        data = self.get(uuid, token=token).data
        usability = next(f for f in data['factors'] if f['code'] == 'TEC-USA')
        self.assertEqual(usability['name'], 'Usabilidad')
        self.assertEqual(usability['suggested_importance'], 2)
        self.assertEqual(len(usability['subfactors']), 4)
        self.assertTrue(usability['description'])
        self.assertNotEqual(usability['subfactors'][0]['description'], 'Texto editado')

        response = self.patch_factor(uuid, token, 'TEC-USA', decisor_importance=1)
        row = next(f for f in response.data['factors'] if f['code'] == 'TEC-USA')
        self.assertEqual(row['relative_importance'], 1)   # IS 2 (instantánea) e ID 1

    def test_factor_without_active_subfactors_is_not_copied(self):
        Subfactor.objects.filter(factor__code='TEC-PRU').update(is_active=False)
        uuid, _ = self.create()
        evaluation = Evaluation.objects.get(uuid=uuid)
        self.assertFalse(EvaluationFactor.objects.filter(evaluation=evaluation, factor__code='TEC-PRU').exists())
        self.assertEqual(EvaluationFactor.objects.filter(evaluation=evaluation).count(), 17)

    def test_required_fields(self):
        response = self.client.post(f'{BASE}/evaluations/', {'software_name': 'X'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('org_name', response.data)

    def test_special_characters_are_saved_as_typed(self):
        uuid, token = self.create(
            software_name='B&R Consultores',
            org_name='Ñandú & Cía.',
            org_sector='a < b',
            org_description='x > 3 <script>alert(1)</script>',
        )
        evaluation = Evaluation.objects.get(uuid=uuid)
        self.assertEqual(evaluation.software_name, 'B&R Consultores')
        self.assertEqual(evaluation.org_name, 'Ñandú & Cía.')
        self.assertEqual(evaluation.org_sector, 'a < b')
        self.assertTrue(evaluation.org_description.startswith('x > 3'))
        self.assertNotIn('<script', evaluation.org_description)
        detail = self.get(uuid, token=token).data
        self.assertEqual(detail['software_name'], 'B&R Consultores')
        self.assertEqual(detail['org_sector'], 'a < b')

    @override_settings(GUIOS_EVALUATION_CREATE_RATE='2/h')
    def test_creation_rate_limit(self):
        self.create()
        self.create()
        response = self.client.post(f'{BASE}/evaluations/', REGISTRATION, format='json')
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'rate_limited')
        self.assertEqual(Evaluation.objects.count(), 2)

    def test_public_throttle_scope(self):
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'guios_public': '2/min'}):
            self.assertEqual(self.client.get(f'{BASE}/catalog/').status_code, 200)
            self.assertEqual(self.client.get(f'{BASE}/catalog/').status_code, 200)
            self.assertEqual(self.client.get(f'{BASE}/catalog/').status_code, 429)


class TokenTests(PublicApiTestBase):

    def test_missing_token_is_rejected(self):
        uuid, _ = self.create()
        self.assertEqual(self.get(uuid).status_code, 403)
        self.assertEqual(self.get(uuid, 'summary/').status_code, 403)
        factor_id = Factor.objects.get(code='TEC-COM').pk
        response = self.client.patch(f'{BASE}/evaluations/{uuid}/factors/{factor_id}/', {'decisor_importance': 3}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.post(f'{BASE}/evaluations/{uuid}/verdict/').status_code, 403)

    def test_wrong_or_foreign_token_is_rejected(self):
        uuid, token = self.create()
        other_uuid, other_token = self.create()
        for bad in ('token-inventado', other_token):
            with self.subTest(token=bad):
                self.assertEqual(self.get(uuid, token=bad).status_code, 404)
                self.assertEqual(self.get(uuid, 'summary/', token=bad).status_code, 404)
                self.assertEqual(self.patch_factor(uuid, bad, 'TEC-COM', decisor_importance=3).status_code, 404)
                self.assertEqual(self.patch_rating(uuid, bad, 'TEC-COM-01', 4).status_code, 404)
                self.assertEqual(self.post_verdict(uuid, bad).status_code, 404)
        self.assertFalse(EvaluationFactor.objects.filter(evaluation__uuid=uuid, decisor_importance__isnull=False).exists())
        self.assertEqual(self.get(other_uuid, token=other_token).status_code, 200)

    def test_unknown_evaluation_is_404(self):
        _, token = self.create()
        self.assertEqual(self.get('00000000-0000-0000-0000-000000000000', token=token).status_code, 404)

    def test_items_from_outside_the_evaluation_are_404(self):
        uuid, token = self.create()
        url = f'{BASE}/evaluations/{uuid}'
        self.assertEqual(self.client.patch(f'{url}/factors/999999/', {'decisor_importance': 3}, format='json', **self.headers(token)).status_code, 404)
        self.assertEqual(self.client.patch(f'{url}/subfactors/999999/', {'rating': 3}, format='json', **self.headers(token)).status_code, 404)


class ProgressTests(PublicApiTestBase):

    def test_decisor_importance_range_and_reset(self):
        uuid, token = self.create()
        for value in (0, 5, 'tres', True):
            with self.subTest(value=value):
                self.assertEqual(self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=value).status_code, 400)
        for value in (1, 2, 3, 4):
            self.assertEqual(self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=value).status_code, 200)
        item = EvaluationFactor.objects.get(evaluation__uuid=uuid, factor__code='TEC-COM')
        self.assertEqual((item.decisor_importance, item.relative_importance, item.is_relevant), (4, 3, True))

        response = self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=None)
        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual((item.decisor_importance, item.relative_importance, item.is_relevant), (None, None, None))

    def test_rating_range_and_reset(self):
        uuid, token = self.create()
        for value in (0, 5, 'x'):
            with self.subTest(value=value):
                self.assertEqual(self.patch_rating(uuid, token, 'TEC-COM-01', value).status_code, 400)
        self.assertEqual(self.patch_rating(uuid, token, 'TEC-COM-01', 2).status_code, 200)
        item = EvaluationSubfactor.objects.get(evaluation__uuid=uuid, subfactor__code='TEC-COM-01')
        self.assertEqual(item.rating, 2)
        self.assertEqual(self.patch_rating(uuid, token, 'TEC-COM-01', None).status_code, 200)
        item.refresh_from_db()
        self.assertIsNone(item.rating)

    def test_empty_factor_change_is_rejected(self):
        uuid, token = self.create()
        self.assertEqual(self.patch_factor(uuid, token, 'TEC-COM').status_code, 400)

    def test_only_support_accepts_scope(self):
        uuid, token = self.create()
        response = self.patch_factor(uuid, token, 'TEC-COM', scope_used='internal')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_change')
        self.assertEqual(EvaluationFactor.objects.get(evaluation__uuid=uuid, factor__code='TEC-COM').scope_used, 'external')

        self.assertEqual(self.patch_factor(uuid, token, 'ORG-SOP', scope_used='both').status_code, 400)
        self.assertEqual(self.patch_factor(uuid, token, 'ORG-SOP', scope_used='external').status_code, 200)
        support = EvaluationFactor.objects.get(evaluation__uuid=uuid, factor__code='ORG-SOP')
        self.assertEqual(support.scope_used, 'external')
        self.assertEqual(self.patch_factor(uuid, token, 'ORG-SOP', scope_used=None).status_code, 200)
        support.refresh_from_db()
        self.assertEqual(support.scope_used, '')

    def test_progress_does_not_create_audit_logs(self):
        before = AuditLog.objects.count()
        uuid, token = self.create()
        self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=3)
        self.patch_factor(uuid, token, 'ORG-SOP', scope_used='internal')
        self.patch_rating(uuid, token, 'TEC-COM-01', 4)
        self.patch_rating(uuid, token, 'TEC-COM-01', None)
        self.assertEqual(AuditLog.objects.count(), before)

    def test_summary_lists_missing_items(self):
        uuid, token = self.create()
        summary = self.get(uuid, 'summary/', token=token).data
        self.assertFalse(summary['is_complete'])
        self.assertEqual(len(summary['missing']), 18)
        self.assertEqual({m['kind'] for m in summary['missing']}, {'decisor_importance'})

        response = self.patch_factor(uuid, token, 'ORG-SOP', decisor_importance=4)
        support_missing = [m for m in response.data['missing'] if m['factor_name'] == 'Soporte']
        self.assertEqual(support_missing[0]['kind'], 'scope')
        self.assertEqual(sum(1 for m in support_missing if m['kind'] == 'subfactor_rating'), 6)


class SummaryMatchesEngineTests(PublicApiTestBase):

    def assert_matches_engine(self, uuid, summary):
        evaluation = Evaluation.objects.get(uuid=uuid)
        expected = engine.evaluate(build_engine_inputs(evaluation_factors(evaluation)))
        self.assertEqual(summary['is_complete'], expected.is_complete)
        self.assertEqual(len(summary['factors']), len(expected.factors))
        for row, result in zip(summary['factors'], expected.factors):
            self.assertEqual(row['factor_id'], int(result.code))
            self.assertEqual(row['relative_importance'], result.relative_importance)
            self.assertEqual(row['is_relevant'], result.is_relevant)
            self.assertEqual(row['meets_threshold'], result.meets_threshold)
            self.assertEqual(row['foda'], result.foda)
            expected_pm = None if result.weighted_average is None else str(result.weighted_average_display)
            self.assertEqual(row['weighted_average'], expected_pm)
            self.assertEqual(
                [(s['subfactor_id'], s['rating']) for s in row['failing_subfactors']],
                [(int(s.code), s.rating) for s in result.failing_subfactors],
            )
        self.assertEqual(
            [(m['kind'], m['factor_id'], m['subfactor_id']) for m in summary['missing']],
            [(m.kind, int(m.factor_code), int(m.subfactor_code) if m.subfactor_code else None) for m in expected.missing],
        )

    def test_partial_summary_matches_engine(self):
        uuid, token = self.create()
        self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=4)
        self.patch_factor(uuid, token, 'TEC-REU', decisor_importance=1)
        for code in ('TEC-COM-01', 'TEC-COM-02'):
            self.patch_rating(uuid, token, code, 2)
        self.assert_matches_engine(uuid, self.get(uuid, 'summary/', token=token).data)

    def test_unemi_case_through_the_api_gives_c(self):
        uuid, token = self.create()
        response = self.fill_unemi(uuid, token)
        summary = response.data
        self.assertTrue(summary['is_complete'])
        self.assert_matches_engine(uuid, summary)

        response = self.post_verdict(uuid, token)
        self.assertEqual(response.status_code, 201, response.data)
        verdict = response.data['verdict']
        self.assertEqual(verdict['recommendation'], 'C')
        self.assertEqual(verdict['recommendation_label'], 'Recomendación C (Analizar y posponer la adopción)')
        text = verdict['explanation_text']
        for name in ('Personalización', 'Formación', 'Soporte'):
            self.assertIn(f'- {name}: IR Importante', text)
        self.assertIn('PM 2.75, Debilidad', text)
        self.assertIn('PM 1.67, Amenaza', text)
        self.assertIn('No cumple:', text)
        self.assertIn('No se sabe:', text)
        self.assertNotIn('- Documentación', text)   # negativo con IR Opcional: no causa la C

        formation_line = text.split('- Formación')[1].split('\n- ')[0]
        self.assertIn('No se sabe:', formation_line)
        self.assertNotIn('No cumple:', formation_line)


class VerdictTests(PublicApiTestBase):

    def test_incomplete_verdict_is_rejected_with_missing_items(self):
        uuid, token = self.create()
        response = self.post_verdict(uuid, token)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'evaluation_incomplete')
        self.assertEqual(len(response.data['missing']), 18)

        self.fill_unemi(uuid, token)
        self.patch_rating(uuid, token, 'TEC-COM-03', None)
        self.patch_factor(uuid, token, 'ORG-SOP', scope_used=None)
        response = self.post_verdict(uuid, token)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            [(m['kind'], m['factor_name'], m['subfactor_id']) for m in response.data['missing']],
            [
                ('subfactor_rating', 'Compatibilidad', Subfactor.objects.get(code='TEC-COM-03').pk),
                ('scope', 'Soporte', None),
            ],
        )
        self.assertFalse(EvaluationVerdict.objects.exists())
        self.assertFalse(EvaluationResult.objects.exists())
        self.assertEqual(Evaluation.objects.get(uuid=uuid).status, Evaluation.STATUS_IN_PROGRESS)

    def test_verdict_saves_results_closes_and_audits(self):
        uuid, token = self.create()
        self.fill_unemi(uuid, token)
        audit_before = AuditLog.objects.count()
        self.assertEqual(self.post_verdict(uuid, token).status_code, 201)

        evaluation = Evaluation.objects.get(uuid=uuid)
        self.assertEqual(evaluation.status, Evaluation.STATUS_COMPLETED)
        self.assertIsNotNone(evaluation.completed_at)
        self.assertEqual(evaluation.verdict.recommendation, 'C')
        results = EvaluationResult.objects.filter(evaluation=evaluation)
        self.assertEqual(results.count(), 18)
        self.assertEqual(str(results.get(factor__code='ORG-FOR').weighted_average), '2.75')
        self.assertEqual(results.get(factor__code='ORG-SOP').foda_classification, 'weakness')

        self.assertEqual(AuditLog.objects.count(), audit_before + 1)
        log = AuditLog.objects.order_by('-pk').first()
        self.assertEqual(log.extra, {'event': 'verdict_generated'})
        self.assertEqual(log.reason, 'Dictamen generado (C)')
        self.assertEqual(log.object_id, str(evaluation.verdict.pk))
        self.assertEqual(log.after['causing_factors'], ['Personalización', 'Soporte', 'Formación'])

    def test_completed_evaluation_is_locked(self):
        uuid, token = self.create()
        self.fill_unemi(uuid, token)
        self.assertEqual(self.post_verdict(uuid, token).status_code, 201)

        for response in (
            self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=1),
            self.patch_factor(uuid, token, 'ORG-SOP', scope_used='external'),
            self.patch_rating(uuid, token, 'TEC-PER-01', 4),
            self.post_verdict(uuid, token),
        ):
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.data['code'], 'evaluation_locked')

        item = EvaluationFactor.objects.get(evaluation__uuid=uuid, factor__code='TEC-COM')
        self.assertEqual(item.decisor_importance, 4)
        self.assertEqual(EvaluationVerdict.objects.count(), 1)
        self.assertEqual(self.get(uuid, token=token).data['verdict']['recommendation'], 'C')
        self.assertEqual(self.get(uuid, 'summary/', token=token).data['status'], 'completed')

    def test_verdict_failure_saves_nothing(self):
        uuid, token = self.create()
        self.fill_unemi(uuid, token)
        evaluation = Evaluation.objects.get(uuid=uuid)
        audit_before = AuditLog.objects.count()

        with mock.patch.object(AuditLog.objects, 'create', side_effect=RuntimeError("fallo de auditoría")):
            with self.assertRaises(RuntimeError):
                evaluation_service.generate_verdict(evaluation)

        evaluation.refresh_from_db()
        self.assertEqual(evaluation.status, Evaluation.STATUS_IN_PROGRESS)
        self.assertIsNone(evaluation.completed_at)
        self.assertFalse(EvaluationVerdict.objects.filter(evaluation=evaluation).exists())
        self.assertFalse(EvaluationResult.objects.filter(evaluation=evaluation).exists())
        self.assertEqual(AuditLog.objects.count(), audit_before)

        # Después del fallo, el dictamen se puede generar normalmente.
        self.assertEqual(self.post_verdict(uuid, token).status_code, 201)

    def test_invalid_request_id_header_does_not_break_verdict(self):
        uuid, token = self.create()
        self.fill_unemi(uuid, token)
        response = self.client.post(
            f'{BASE}/evaluations/{uuid}/verdict/', HTTP_X_REQUEST_ID='no-es-un-uuid', **self.headers(token),
        )
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(AuditLog.objects.order_by('-pk').first().request_id)

    def test_verdict_a_and_b_texts(self):
        uuid, token = self.create()
        # Todo cumple: A.
        for code, (id_, ratings) in UNEMI.items():
            self.patch_factor(uuid, token, code, decisor_importance=id_)
            for subfactor in Subfactor.objects.filter(factor__code=code):
                self.patch_rating(uuid, token, subfactor.code, 4)
        self.patch_factor(uuid, token, 'ORG-SOP', scope_used='internal')
        response = self.post_verdict(uuid, token)
        self.assertEqual(response.data['verdict']['recommendation'], 'A')
        self.assertNotIn('Factores que causan', response.data['verdict']['explanation_text'])

        uuid, token = self.create()
        # Solo Documentación (IR Opcional) no cumple: B.
        for code, (id_, ratings) in UNEMI.items():
            self.patch_factor(uuid, token, code, decisor_importance=id_)
            rating = 1 if code == 'TEC-DOC' else 4
            for subfactor in Subfactor.objects.filter(factor__code=code):
                self.patch_rating(uuid, token, subfactor.code, rating)
        self.patch_factor(uuid, token, 'ORG-SOP', scope_used='internal')
        verdict = self.post_verdict(uuid, token).data['verdict']
        self.assertEqual(verdict['recommendation'], 'B')
        self.assertIn('- Documentación: IR Opcional, PM 1.00, Amenaza.', verdict['explanation_text'])
        self.assertNotIn('No se sabe:', verdict['explanation_text'])


class DuplicateTests(PublicApiTestBase):

    def duplicate(self, uuid, token):
        return self.client.post(f'{BASE}/evaluations/{uuid}/duplicate/', **self.headers(token))

    def test_duplicate_closed_evaluation_copies_everything(self):
        uuid, token = self.create(software_name='B&R Suite')
        self.fill_unemi(uuid, token)
        self.assertEqual(self.post_verdict(uuid, token).status_code, 201)
        Factor.objects.filter(code='TEC-USA').update(name='Usabilidad (editado)', suggested_importance=4)

        response = self.duplicate(uuid, token)
        self.assertEqual(response.status_code, 201, response.data)
        copy_uuid, copy_token = response.data['uuid'], response.data['session_token']
        self.assertNotEqual(copy_uuid, uuid)
        self.assertNotEqual(copy_token, token)
        self.assertEqual(response.data['status'], 'in_progress')
        self.assertIsNone(response.data['verdict'])
        self.assertEqual(response.data['software_name'], 'B&R Suite')

        original = Evaluation.objects.get(uuid=uuid)
        copy = Evaluation.objects.get(uuid=copy_uuid)

        def factor_values(evaluation):
            return list(EvaluationFactor.objects.filter(evaluation=evaluation).order_by('factor_id').values_list(
                'factor_id', 'suggested_importance_snapshot', 'factor_name_snapshot',
                'decisor_importance', 'relative_importance', 'is_relevant', 'scope_used'))

        def subfactor_values(evaluation):
            return list(EvaluationSubfactor.objects.filter(evaluation=evaluation).order_by('subfactor_id').values_list(
                'subfactor_id', 'description_snapshot', 'rating'))

        self.assertEqual(factor_values(copy), factor_values(original))
        self.assertEqual(subfactor_values(copy), subfactor_values(original))
        self.assertEqual(
            EvaluationFactor.objects.get(evaluation=copy, factor__code='TEC-USA').factor_name_snapshot, 'Usabilidad')

        # La copia se puede corregir y cerrar; la original sigue igual y cerrada.
        self.assertEqual(self.patch_rating(copy_uuid, copy_token, 'TEC-PER-01', 4).status_code, 200)
        summary = self.get(copy_uuid, 'summary/', token=copy_token).data
        self.assertTrue(summary['is_complete'])
        self.assertEqual(self.post_verdict(copy_uuid, copy_token).status_code, 201)
        original.refresh_from_db()
        self.assertEqual(original.status, Evaluation.STATUS_COMPLETED)
        self.assertEqual(
            EvaluationSubfactor.objects.get(evaluation=original, subfactor__code='TEC-PER-01').rating, 1)
        self.assertEqual(EvaluationVerdict.objects.count(), 2)

    def test_duplicate_requires_the_original_token(self):
        uuid, _ = self.create()
        _, other_token = self.create()
        self.assertEqual(self.client.post(f'{BASE}/evaluations/{uuid}/duplicate/').status_code, 403)
        self.assertEqual(self.duplicate(uuid, other_token).status_code, 404)
        self.assertEqual(Evaluation.objects.count(), 2)

    @override_settings(GUIOS_EVALUATION_CREATE_RATE='2/h')
    def test_duplicate_counts_for_the_creation_limit(self):
        uuid, token = self.create()
        self.assertEqual(self.duplicate(uuid, token).status_code, 201)
        self.assertEqual(self.duplicate(uuid, token).status_code, 429)


class SchemaTests(PublicApiTestBase):

    def test_schema_documents_public_endpoints(self):
        from drf_spectacular.generators import SchemaGenerator

        schema = SchemaGenerator().get_schema(request=None, public=True)
        paths = schema['paths']
        for path in (
            '/api/v1/guios/public/catalog/',
            '/api/v1/guios/public/evaluations/',
            '/api/v1/guios/public/evaluations/{evaluation_uuid}/',
            '/api/v1/guios/public/evaluations/{evaluation_uuid}/summary/',
            '/api/v1/guios/public/evaluations/{evaluation_uuid}/factors/{factor_id}/',
            '/api/v1/guios/public/evaluations/{evaluation_uuid}/subfactors/{subfactor_id}/',
            '/api/v1/guios/public/evaluations/{evaluation_uuid}/verdict/',
            '/api/v1/guios/public/evaluations/{evaluation_uuid}/duplicate/',
        ):
            self.assertIn(path, paths)
        patch = paths['/api/v1/guios/public/evaluations/{evaluation_uuid}/factors/{factor_id}/']['patch']
        self.assertIn('X-Evaluation-Token', [p['name'] for p in patch['parameters']])
        self.assertIn('409', patch['responses'])
