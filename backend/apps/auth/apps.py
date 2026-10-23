from django.apps import AppConfig


class AuthConfig(AppConfig):
    name = 'apps.auth'
    label = 'authentication'
    verbose_name = 'Autenticación'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        from .signals import register_audit_signals
        register_audit_signals()

        # Registra la extensión de drf-spectacular para CookieJWTAuthentication.
        from .api import schema  # noqa: F401
        
        from django.db.models.signals import post_migrate