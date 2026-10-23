"""
Proveedor falso para las pruebas (RNF-13, RF-IA-07): nunca hace llamadas reales.
Por defecto devuelve respuestas válidas y deterministas; también puede devolver
lo que se le indique (basura incluida) o lanzar un error.
"""
from .provider import TASK_REPORT, ProveedorIA


class FakeProvider(ProveedorIA):

    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []

    def model_for(self, task):
        return f'fake-{task}'

    def complete(self, *, task, system, payload, schema):
        self.calls.append({'task': task, 'system': system, 'payload': payload, 'schema': schema})
        if self.error is not None:
            raise self.error
        if self.response is not None:
            return self.response(payload) if callable(self.response) else self.response
        return self._valid_response(task, payload)

    @staticmethod
    def _valid_response(task, payload):
        if task == TASK_REPORT:
            negative = payload['dictamen']['letra'] in ('B', 'C')
            return {
                'executive_summary': "Resumen de prueba para la alta dirección.",
                'mitigation_plan': "Plan de prueba para los factores negativos." if negative else "",
            }
        if 'factores' in payload:
            return {'suggestions': [
                {'factor_id': f['factor_id'], 'value': f['importancia_sugerida'], 'justification': "Sugerencia de prueba."}
                for f in payload['factores']
            ]}
        return {'suggestions': [
            {'subfactor_id': s['subfactor_id'], 'value': 3, 'justification': "Sugerencia de prueba."}
            for s in payload['subfactores']
        ]}
