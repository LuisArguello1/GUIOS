"""
Paso 9: asistencia de IA. Todas las pruebas usan el proveedor falso o un cliente
de Anthropic simulado; nunca hay llamadas reales.
"""
import json
from types import SimpleNamespace
from unittest import mock

import anthropic
from django.test import SimpleTestCase, override_settings

from apps.guios.models import AIAssistanceLog, EvaluationFactor, EvaluationResult, EvaluationSubfactor, Factor
from apps.guios.services import ai
from apps.guios.services.ai import schemas
from apps.guios.services.ai.anthropic_provider import AnthropicProvider
from apps.guios.services.ai.fake_provider import FakeProvider
from apps.guios.services.ai.provider import (
    TASK_REPORT,
    TASK_SUGGESTION,
    AIInvalidResponse,
    AIProviderError,
    AITimeout,
)

from .test_public_api import BASE, UNEMI, PublicApiTestBase

SECRET = 'sk-ant-test-secret'


def use_provider(provider):
    return mock.patch('apps.guios.services.ai.assistance.get_provider', return_value=provider)


@override_settings(ANTHROPIC_API_KEY=SECRET)
class AIApiTestBase(PublicApiTestBase):

    def create_ai(self, **overrides):
        return self.create(ai_enabled=True, **overrides)

    def post_ai(self, uuid, token, path):
        return self.client.post(f'{BASE}/evaluations/{uuid}/ai/{path}', **self.headers(token))

    def ratings_path(self, code):
        return f'factors/{Factor.objects.get(code=code).pk}/ratings/'


class AIDisabledTests(PublicApiTestBase):
    """Sin clave en el .env la IA queda desactivada sin errores."""

    @override_settings(ANTHROPIC_API_KEY='')
    def test_without_key_ai_is_off_and_everything_else_works(self):
        self.assertIsNone(ai.get_provider())
        self.assertEqual(self.client.get(f'{BASE}/ai/status/').data, {'available': False})
        uuid, token = self.create(ai_enabled=True)
        self.assertFalse(self.get(uuid, token=token).data['ai_enabled'])
        response = self.client.post(f'{BASE}/evaluations/{uuid}/ai/importance/', **self.headers(token))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'ai_unavailable')
        self.fill_unemi(uuid, token)
        self.assertEqual(self.post_verdict(uuid, token).data['verdict']['recommendation'], 'C')
        self.assertFalse(AIAssistanceLog.objects.exists())

    @override_settings(ANTHROPIC_API_KEY=SECRET, GUIOS_AI_SUGGESTION_MODEL='m-sug',
                       GUIOS_AI_REPORT_MODEL='m-rep', GUIOS_AI_TIMEOUT=12.5)
    def test_with_key_the_anthropic_provider_uses_the_settings(self):
        provider = ai.get_provider()
        self.assertIsInstance(provider, AnthropicProvider)
        self.assertEqual(provider.model_for(TASK_SUGGESTION), 'm-sug')
        self.assertEqual(provider.model_for(TASK_REPORT), 'm-rep')
        self.assertEqual(provider.timeout, 12.5)
        self.assertEqual(self.client.get(f'{BASE}/ai/status/').data, {'available': True})
        self.assertNotIn(SECRET, json.dumps(self.client.get(f'{BASE}/ai/status/').data))


class AIRegistrationTests(AIApiTestBase):

    def test_ai_enabled_requires_description_or_repository(self):
        response = self.client.post(f'{BASE}/evaluations/', {
            'software_name': 'X', 'org_name': 'Y', 'ai_enabled': True,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('ai_enabled', response.data)
        uuid, token = self.create_ai(org_description='', software_repo_url='https://example.org/repo')
        self.assertTrue(self.get(uuid, token=token).data['ai_enabled'])

    def test_not_enabled_evaluation_is_rejected_without_calling_the_ai(self):
        uuid, token = self.create()
        provider = FakeProvider()
        with use_provider(provider):
            response = self.post_ai(uuid, token, 'importance/')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'ai_not_enabled')
        self.assertEqual(provider.calls, [])

    def test_wrong_token_is_404(self):
        uuid, _ = self.create_ai()
        self.assertEqual(self.post_ai(uuid, 'otro', 'importance/').status_code, 404)


class AIImportanceTests(AIApiTestBase):

    def test_suggestions_are_saved_but_the_id_stays_unrated(self):
        uuid, token = self.create_ai()
        provider = FakeProvider()
        with use_provider(provider):
            response = self.post_ai(uuid, token, 'importance/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['suggestions']), 18)
        for item in EvaluationFactor.objects.filter(evaluation__uuid=uuid):
            self.assertEqual(item.ai_suggested_id, item.suggested_importance_snapshot)
            self.assertEqual(item.ai_id_justification, "Sugerencia de prueba.")
            self.assertIsNone(item.decisor_importance)
            self.assertFalse(item.id_was_ai_accepted)
        state = self.get(uuid, token=token).data['factors'][0]
        self.assertEqual(state['ai_suggested_id'], state['suggested_importance'])
        payload = provider.calls[0]['payload']
        self.assertEqual(payload['organizacion']['nombre'], 'UNEMI')
        self.assertEqual(len(payload['factores']), 18)

    def test_accepted_flag_only_when_value_equals_suggestion(self):
        uuid, token = self.create_ai()
        with use_provider(FakeProvider()):
            self.post_ai(uuid, token, 'importance/')
        item = EvaluationFactor.objects.get(evaluation__uuid=uuid, factor__code='TEC-COM')
        self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=item.ai_suggested_id)
        item.refresh_from_db()
        self.assertTrue(item.id_was_ai_accepted)
        other = 1 if item.ai_suggested_id != 1 else 2
        self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=other)
        item.refresh_from_db()
        self.assertFalse(item.id_was_ai_accepted)

    def test_call_is_logged_without_credentials(self):
        uuid, token = self.create_ai()
        with use_provider(FakeProvider()):
            self.post_ai(uuid, token, 'importance/')
        log = AIAssistanceLog.objects.get()
        self.assertEqual(log.request_type, AIAssistanceLog.REQ_FACTOR_IMPORTANCE)
        self.assertEqual(log.status, AIAssistanceLog.STATUS_SUCCESS)
        self.assertEqual(log.request_payload['model'], f'fake-{TASK_SUGGESTION}')
        self.assertIsNotNone(log.response_time_ms)
        self.assertNotIn(SECRET, json.dumps([log.request_payload, log.response_payload, log.error_message]))

    def test_locked_evaluation_gets_409(self):
        uuid, token = self.create_ai()
        self.fill_unemi(uuid, token)
        self.post_verdict(uuid, token)
        provider = FakeProvider()
        with use_provider(provider):
            response = self.post_ai(uuid, token, 'importance/')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(provider.calls, [])


class AIFailureTests(AIApiTestBase):
    """Timeout, error del proveedor y respuestas inválidas: se informa, se registra y no se guarda nada."""

    def assert_failure(self, provider, http_status, code, log_status=AIAssistanceLog.STATUS_ERROR):
        uuid, token = self.create_ai()
        with use_provider(provider):
            response = self.post_ai(uuid, token, 'importance/')
        self.assertEqual(response.status_code, http_status, response.data)
        self.assertEqual(response.data['code'], code)
        self.assertIn('modo manual', response.data['detail'])
        self.assertFalse(EvaluationFactor.objects.filter(evaluation__uuid=uuid, ai_suggested_id__isnull=False).exists())
        log = AIAssistanceLog.objects.get()
        self.assertEqual(log.status, log_status)
        self.assertTrue(log.error_message)
        # La evaluación sigue en modo manual.
        self.assertEqual(self.patch_factor(uuid, token, 'TEC-COM', decisor_importance=4).status_code, 200)

    def test_timeout(self):
        self.assert_failure(FakeProvider(error=AITimeout("Tiempo agotado.")), 504, 'ai_timeout',
                            AIAssistanceLog.STATUS_TIMEOUT)

    def test_provider_error(self):
        self.assert_failure(FakeProvider(error=AIProviderError("Error 500.")), 502, 'ai_error')

    def test_unexpected_exception(self):
        self.assert_failure(FakeProvider(error=RuntimeError("boom")), 502, 'ai_error')

    def test_garbage(self):
        self.assert_failure(FakeProvider(response="no es json"), 502, 'ai_invalid_response')

    def test_unserializable_garbage_is_logged(self):
        self.assert_failure(FakeProvider(response={'suggestions': object()}), 502, 'ai_invalid_response')

    def test_missing_factor(self):
        def drop_one(payload):
            data = FakeProvider._valid_response(TASK_SUGGESTION, payload)
            data['suggestions'].pop()
            return data
        self.assert_failure(FakeProvider(response=drop_one), 502, 'ai_invalid_response')

    def test_value_out_of_range(self):
        def out_of_range(payload):
            data = FakeProvider._valid_response(TASK_SUGGESTION, payload)
            data['suggestions'][0]['value'] = 5
            return data
        self.assert_failure(FakeProvider(response=out_of_range), 502, 'ai_invalid_response')


class AIRatingTests(AIApiTestBase):

    def test_ratings_only_for_relevant_factors(self):
        uuid, token = self.create_ai()
        provider = FakeProvider()
        with use_provider(provider):
            # Sin ID: no es relevante todavía.
            response = self.post_ai(uuid, token, self.ratings_path('TEC-COM'))
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data['code'], 'factor_not_relevant')
            # Usabilidad (IS 2) con ID 1 deja IR = 1 (Irrelevante): tampoco.
            self.patch_factor(uuid, token, 'TEC-USA', decisor_importance=1)
            item = EvaluationFactor.objects.get(evaluation__uuid=uuid, factor__code='TEC-USA')
            self.assertEqual(item.relative_importance, 1)
            self.assertFalse(item.is_relevant)
            response = self.post_ai(uuid, token, self.ratings_path('TEC-USA'))
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data['code'], 'factor_not_relevant')
        self.assertEqual(provider.calls, [])
        self.assertFalse(AIAssistanceLog.objects.exists())

    def test_ratings_saved_as_suggestions_only(self):
        uuid, token = self.create_ai()
        self.patch_factor(uuid, token, 'TEC-PER', decisor_importance=3)
        with use_provider(FakeProvider()):
            response = self.post_ai(uuid, token, self.ratings_path('TEC-PER'))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['suggestions']), len(UNEMI['TEC-PER'][1]))
        items = EvaluationSubfactor.objects.filter(evaluation__uuid=uuid, subfactor__factor__code='TEC-PER')
        for item in items:
            self.assertEqual(item.ai_suggested_rating, 3)
            self.assertIsNone(item.rating)
        log = AIAssistanceLog.objects.get()
        self.assertEqual(log.request_type, AIAssistanceLog.REQ_SUBFACTOR_RATING)
        self.assertEqual(log.factor.code, 'TEC-PER')
        first = items.order_by('subfactor__order').first()
        self.patch_rating(uuid, token, first.subfactor.code, 3)
        first.refresh_from_db()
        self.assertTrue(first.rating_was_ai_accepted)

    def test_unknown_factor_is_404(self):
        uuid, token = self.create_ai()
        self.assertEqual(self.post_ai(uuid, token, 'factors/999999/ratings/').status_code, 404)


class AIReportTests(AIApiTestBase):

    def test_report_requires_verdict(self):
        uuid, token = self.create_ai()
        with use_provider(FakeProvider()):
            response = self.post_ai(uuid, token, 'report/')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'verdict_required')

    def test_report_for_c_includes_mitigation_and_keeps_the_verdict(self):
        uuid, token = self.create_ai()
        self.fill_unemi(uuid, token)
        verdict = self.post_verdict(uuid, token).data['verdict']
        provider = FakeProvider()
        with use_provider(provider):
            response = self.post_ai(uuid, token, 'report/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['executive_summary'])
        self.assertTrue(response.data['mitigation_plan'])
        payload = provider.calls[0]['payload']
        self.assertEqual(payload['dictamen']['letra'], 'C')
        self.assertEqual(
            {f['nombre'] for f in payload['factores_causantes']},
            {'Personalización', 'Formación', 'Soporte'},
        )
        self.assertEqual(provider.calls[0]['task'], TASK_REPORT)
        state = self.get(uuid, token=token).data['verdict']
        self.assertEqual(state['recommendation'], verdict['recommendation'])
        self.assertEqual(state['explanation_text'], verdict['explanation_text'])
        self.assertEqual(state['ai_executive_summary'], response.data['executive_summary'])

    def test_report_without_mitigation_for_b_or_c_is_rejected(self):
        uuid, token = self.create_ai()
        self.fill_unemi(uuid, token)
        self.post_verdict(uuid, token)
        provider = FakeProvider(response={'executive_summary': "Resumen.", 'mitigation_plan': " "})
        with use_provider(provider):
            response = self.post_ai(uuid, token, 'report/')
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data['code'], 'ai_invalid_response')
        self.assertEqual(self.get(uuid, token=token).data['verdict']['ai_executive_summary'], '')


class VerdictIndependenceTests(AIApiTestBase):
    """Test clave (RN-14): el dictamen es idéntico con la IA apagada, encendida, fallando o con basura."""

    def run_case(self, provider):
        uuid, token = self.create_ai() if provider else self.create()
        with use_provider(provider):
            self.post_ai(uuid, token, 'importance/')
            self.fill_unemi(uuid, token)
            for code in UNEMI:
                self.post_ai(uuid, token, self.ratings_path(code))
            response = self.post_verdict(uuid, token)
            self.post_ai(uuid, token, 'report/')
        self.assertEqual(response.status_code, 201, response.data)
        results = sorted(
            (r.factor.code, str(r.weighted_average), r.meets_threshold, r.foda_classification)
            for r in EvaluationResult.objects.filter(evaluation__uuid=uuid).select_related('factor')
        )
        summary = response.data['summary']
        return response.data['verdict']['recommendation'], summary['factors'], results

    def test_same_verdict_in_every_mode(self):
        def garbage(payload):
            return {'suggestions': [{'factor_id': 'x', 'value': 99}], 'extra': True}

        cases = {
            'off': None,
            'on': FakeProvider(),
            'timeout': FakeProvider(error=AITimeout("Tiempo agotado.")),
            'error': FakeProvider(error=AIProviderError("Error.")),
            'garbage': FakeProvider(response=garbage),
        }
        outcomes = {name: self.run_case(provider) for name, provider in cases.items()}
        baseline = outcomes['off']
        self.assertEqual(baseline[0], 'C')
        for name, outcome in outcomes.items():
            self.assertEqual(outcome, baseline, name)
        self.assertTrue(cases['on'].calls)


class SchemaValidationTests(SimpleTestCase):

    def test_valid_suggestions(self):
        data = {'suggestions': [{'factor_id': 1, 'value': 3, 'justification': ' Motivo. '}]}
        self.assertEqual(
            schemas.validate_suggestions(data, schemas.IMPORTANCE_SCHEMA, 'factor_id', [1]),
            {1: (3, 'Motivo.')},
        )

    def test_invalid_suggestions(self):
        def item(**overrides):
            return {'factor_id': 1, 'value': 3, 'justification': 'Motivo.', **overrides}
        invalid = [
            None, [], {}, {'suggestions': 'x'},
            {'suggestions': [item(value=0)]},
            {'suggestions': [item(value=True)]},
            {'suggestions': [item(value='3')]},
            {'suggestions': [item(justification='   ')]},
            {'suggestions': [item(justification='x' * 501)]},
            {'suggestions': [item(extra=1)]},
            {'suggestions': [item(), item()]},
            {'suggestions': [item(factor_id=2)]},
            {'suggestions': []},
        ]
        for data in invalid:
            with self.subTest(data=data), self.assertRaises(AIInvalidResponse):
                schemas.validate_suggestions(data, schemas.IMPORTANCE_SCHEMA, 'factor_id', [1])

    def test_report(self):
        data = {'executive_summary': 'Resumen.', 'mitigation_plan': 'Plan.'}
        self.assertEqual(schemas.validate_report(data, 'C'), ('Resumen.', 'Plan.'))
        self.assertEqual(schemas.validate_report(data, 'A'), ('Resumen.', ''))
        with self.assertRaises(AIInvalidResponse):
            schemas.validate_report({'executive_summary': '', 'mitigation_plan': ''}, 'A')
        with self.assertRaises(AIInvalidResponse):
            schemas.validate_report({'executive_summary': 'x' * 6001, 'mitigation_plan': ''}, 'A')


class AnthropicProviderTests(SimpleTestCase):
    """El proveedor real con el SDK simulado: sin llamadas a la red."""

    def setUp(self):
        self.provider = AnthropicProvider(api_key=SECRET, suggestion_model='m-sug', report_model='m-rep', timeout=30)
        patcher = mock.patch('anthropic.Anthropic')
        self.client_class = patcher.start()
        self.addCleanup(patcher.stop)
        self.create = self.client_class.return_value.messages.create

    def complete(self, task=TASK_SUGGESTION):
        return self.provider.complete(task=task, system='s', payload={'a': 'ñ'}, schema=schemas.REPORT_SCHEMA)

    def response(self, text, stop_reason='end_turn'):
        return SimpleNamespace(stop_reason=stop_reason, content=[
            SimpleNamespace(type='thinking'), SimpleNamespace(type='text', text=text),
        ])

    def test_request_and_parsed_response(self):
        self.create.return_value = self.response('{"ok": 1}')
        self.assertEqual(self.complete(TASK_REPORT), {'ok': 1})
        self.client_class.assert_called_once_with(api_key=SECRET, timeout=30, max_retries=0)
        kwargs = self.create.call_args.kwargs
        self.assertEqual(kwargs['model'], 'm-rep')
        self.assertEqual(kwargs['output_config']['format'], {'type': 'json_schema', 'schema': schemas.REPORT_SCHEMA})
        self.assertEqual(kwargs['messages'][0]['content'], '{"a": "ñ"}')

    def test_errors_are_mapped(self):
        request = mock.Mock()
        cases = [
            (anthropic.APITimeoutError(request=request), AITimeout),
            (anthropic.APIConnectionError(request=request), AIProviderError),
            (anthropic.InternalServerError('x', response=mock.Mock(status_code=500), body=None), AIProviderError),
        ]
        for error, expected in cases:
            with self.subTest(error=type(error).__name__):
                self.create.side_effect = error
                with self.assertRaises(expected) as ctx:
                    self.complete()
                self.assertNotIn(SECRET, str(ctx.exception))

    def test_invalid_responses(self):
        for response in (self.response('no json'), self.response('{}', stop_reason='max_tokens'),
                         SimpleNamespace(stop_reason='end_turn', content=[])):
            with self.subTest(response=response):
                self.create.return_value = response
                with self.assertRaises(AIInvalidResponse):
                    self.complete()
