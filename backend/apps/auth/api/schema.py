"""
Extensión de drf-spectacular para CookieJWTAuthentication.

Sin ella, el esquema avisa en cada vista autenticada ("could not resolve
authenticator"). El panel envía el JWT en la cookie HttpOnly `access_token`; la
cabecera `Authorization: Bearer` ya la documenta la extensión de simplejwt (jwtAuth).
"""
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = 'apps.auth.authentication.CookieJWTAuthentication'
    name = 'jwtCookieAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': 'access_token',
            'description': 'JWT de acceso en la cookie HttpOnly que fija el login del panel.',
        }
