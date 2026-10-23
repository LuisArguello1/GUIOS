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
