import warnings

from django.test import SimpleTestCase
from drf_spectacular.drainage import GENERATOR_STATS
from drf_spectacular.generators import SchemaGenerator


class SchemaAuthenticationTests(SimpleTestCase):
    """CookieJWTAuthentication está documentada en el esquema (sin avisos)."""

    def test_cookie_jwt_scheme_is_registered_without_warnings(self):
        GENERATOR_STATS.reset()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            schema = SchemaGenerator().get_schema(request=None, public=True)
        schemes = schema['components']['securitySchemes']
        self.assertEqual(schemes['jwtCookieAuth'], {
            'type': 'apiKey', 'in': 'cookie', 'name': 'access_token',
            'description': 'JWT de acceso en la cookie HttpOnly que fija el login del panel.',
        })
        operation = schema['paths']['/api/v1/guios/admin/metrics/']['get']
        self.assertIn({'jwtCookieAuth': []}, operation['security'])
        self.assertFalse(
            [w for w in GENERATOR_STATS._warn_cache if 'could not resolve authenticator' in w],
        )


class SchemaCleanTests(SimpleTestCase):
    """El esquema se genera sin errores ni avisos de drf-spectacular (Paso 11)."""

    def test_schema_has_no_errors_or_warnings(self):
        GENERATOR_STATS.reset()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            schema = SchemaGenerator().get_schema(request=None, public=True)
        self.assertEqual(list(GENERATOR_STATS._error_cache), [])
        self.assertEqual(list(GENERATOR_STATS._warn_cache), [])
        for path in ('/api/v1/auth/login/', '/api/v1/core/menu/', '/api/v1/core/organization/',
                     '/api/v1/core/permission-tree/'):
            self.assertIn(path, schema['paths'])
