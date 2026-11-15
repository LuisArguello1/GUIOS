from datetime import timedelta
import pyotp
from django.http import HttpResponse
from django.test import TestCase, override_settings
from django.urls import reverse
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.test import APIRequestFactory
from django.contrib.auth import get_user_model
from apps.auth.models.user import CustomUser
from django.core.cache import cache

from apps.auth.authentication import CookieJWTAuthentication
from apps.auth.middleware.audit import clear_audit_context, get_audit_context
from apps.auth.services.auth import set_auth_cookies
from apps.auth.models.totp import TOTPDevice
from django.contrib.auth.models import Group

User = CustomUser

SIMPLE_JWT_TEST_SETTINGS = {
	'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
	'REFRESH_TOKEN_LIFETIME': timedelta(hours=8),
}


class AuthCookieSecurityTests(TestCase):
	@override_settings(DEBUG=True, SIMPLE_JWT=SIMPLE_JWT_TEST_SETTINGS)
	def test_set_auth_cookies_are_not_secure_in_debug(self):
		# Asegurar que JWT_COOKIE_SECURE también sea False
		with override_settings(JWT_COOKIE_SECURE=False):
			response = HttpResponse()
			set_auth_cookies(response, {'access': 'access-token', 'refresh': 'refresh-token'})
			self.assertIn('access_token', response.cookies)
			self.assertIn('refresh_token', response.cookies)
			self.assertFalse(bool(response.cookies['access_token']['secure']))
			self.assertFalse(bool(response.cookies['refresh_token']['secure']))

	@override_settings(DEBUG=False, SIMPLE_JWT=SIMPLE_JWT_TEST_SETTINGS)
	def test_set_auth_cookies_are_secure_in_production(self):
		# Forzar explícitamente JWT_COOKIE_SECURE a True ya que en settings locales puede estar en False
		with override_settings(JWT_COOKIE_SECURE=True):
			response = HttpResponse()
			set_auth_cookies(response, {'access': 'access-token', 'refresh': 'refresh-token'})
			self.assertIn('access_token', response.cookies)
			self.assertIn('refresh_token', response.cookies)
			self.assertTrue(bool(response.cookies['access_token']['secure']))
			self.assertTrue(bool(response.cookies['refresh_token']['secure']))


class AuditContextAuthenticationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        # FIX: Se eliminan can_read y can_modify de la creación ya que no existen en CustomUser
        self.user = User.objects.create_user(
            email='audit-context@example.com',
            password='TestPass123!',
        )
        self.addCleanup(clear_audit_context)

    def test_cookie_jwt_authentication_populates_audit_user(self):
        request = self.factory.get('/api/v1/auth/login/')
        authentication = CookieJWTAuthentication()

        with patch.object(CookieJWTAuthentication, 'get_header', return_value=b'header'), \
            patch.object(CookieJWTAuthentication, 'get_raw_token', return_value=b'raw-token'), \
            patch.object(CookieJWTAuthentication, 'get_validated_token', return_value={'user_id': self.user.id}), \
            patch.object(CookieJWTAuthentication, 'get_user', return_value=self.user):
            result = authentication.authenticate(request)

        self.assertIsNotNone(result)
        self.assertEqual(result[0], self.user)
        self.assertEqual(get_audit_context()['user'], self.user)


@override_settings(
    REST_FRAMEWORK={
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {},
    }
)
class TwoFactorAuthTests(APITestCase):
    """
    Pruebas para el flujo de 2FA.
    """
    def setUp(self):
        cache.clear()
        self.email = "test@example.com"
        self.password = "password123"
        self.user = User.objects.create_user(
            email=self.email, 
            password=self.password,
            is_active=True
        )
        self.login_url = reverse('authentication:login')
        self.verify_2fa_url = reverse('authentication:login_verify_2fa')
        self.totp_config_url = reverse('authentication:totp-mgmt-get-config')
        self.totp_activate_url = reverse('authentication:totp-mgmt-activate')

    def test_login_without_2fa_returns_tokens_directly(self):
        """Verifica que el login normal sigue funcionando si 2FA está desactivado."""
        response = self.client.post(self.login_url, {
            'email': self.email,
            'password': self.password
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertIn('access_token', response.cookies)

    def test_activate_2fa_flow(self):
        """Prueba el flujo de activación de 2FA."""
        self.client.force_authenticate(user=self.user)
        
        # 1. Obtener configuración
        response = self.client.get(self.totp_config_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        secret = response.data['secret']
        
        # 2. Activar con código válido
        totp = pyotp.totp.TOTP(secret)
        valid_code = totp.now()
        
        response = self.client.post(self.totp_activate_url, {'code': valid_code})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verificar en DB
        device = TOTPDevice.objects.get(user=self.user)
        self.assertTrue(device.is_active)

    def test_login_with_2fa_required_flow(self):
        """Prueba el flujo de login en dos pasos cuando 2FA está activo."""
        # Activar 2FA manualmente para el test
        device = TOTPDevice.objects.create(user=self.user, is_active=True)
        totp = pyotp.totp.TOTP(device.secret)
        
        # PASO 1: Login inicial
        response = self.client.post(self.login_url, {
            'email': self.email,
            'password': self.password
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('requires_2fa'))
        pre_auth_token = response.data.get('pre_auth_token')
        self.assertIsNotNone(pre_auth_token)
        # No debe haber cookies de auth aún
        self.assertNotIn('access_token', response.cookies)
        
        # PASO 2: Verificar código TOTP
        valid_code = totp.now()
        response = self.client.post(self.verify_2fa_url, {
            'pre_auth_token': pre_auth_token,
            'code': valid_code
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertIn('access_token', response.cookies)
        
        # Verificar que el pre_auth_token se invalidó
        self.assertIsNone(cache.get(f"2fa_pre_auth:{pre_auth_token}"))

    def test_login_with_2fa_invalid_code(self):
        """Verifica que un código incorrecto sea rechazado."""
        device = TOTPDevice.objects.create(user=self.user, is_active=True)
        
        # PASO 1: Login inicial
        response = self.client.post(self.login_url, {
            'email': self.email,
            'password': self.password
        })
        pre_auth_token = response.data.get('pre_auth_token')
        
        # Código inválido
        response = self.client.post(self.verify_2fa_url, {
            'pre_auth_token': pre_auth_token,
            'code': '000000'
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('access_token', response.cookies)


class PasswordChangeTests(APITestCase):
    def setUp(self):
        self.email = "pass@example.com"
        self.old_password = "old_password_123"
        self.new_password = "new_password_456"
        self.user = User.objects.create_user(
            email=self.email, 
            password=self.old_password,
            is_active=True
        )
        self.change_password_url = reverse('authentication:user-change-password')

    def test_change_password_success(self):
        """Verifica el cambio exitoso de contraseña."""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.post(self.change_password_url, {
            'old_password': self.old_password,
            'new_password': self.new_password,
            'confirm_password': self.new_password
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # La contraseña en DB debe haber cambiado
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))

    def test_change_password_invalid_old_password(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.change_password_url, {
            'old_password': 'wrong_password',
            'new_password': self.new_password,
            'confirm_password': self.new_password
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # FIX: Buscar en el diccionario interno 'errors' debido al custom exception handler
        self.assertIn('old_password', response.data.get('errors', response.data))

    def test_change_password_requires_otp_if_2fa_active(self):
        # Activar 2FA
        TOTPDevice.objects.create(user=self.user, is_active=True)
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.change_password_url, {
            'old_password': self.old_password,
            'new_password': self.new_password,
            'confirm_password': self.new_password
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # FIX: Buscar en el diccionario interno 'errors' debido al custom exception handler
        self.assertIn('otp_code', response.data.get('errors', response.data))

    def test_change_password_with_valid_otp(self):
        device = TOTPDevice.objects.create(user=self.user, is_active=True)
        totp = pyotp.totp.TOTP(device.secret)
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.change_password_url, {
            'old_password': self.old_password,
            'new_password': self.new_password,
            'confirm_password': self.new_password,
            'otp_code': totp.now()
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))


class QASprint3AuthFixesTests(APITestCase):
    """Pruebas unitarias e integración para hallazgos QA-04, D-33, D-34 y D-35."""

    def setUp(self):
        cache.clear()
        self.password = "StrongPass!123"
        self.user = User.objects.create_user(
            email="qa-user@example.com",
            username="qa_user",
            password=self.password,
            is_active=True,
        )
        self.qa_group, _ = Group.objects.get_or_create(name="Evaluador QA")
        self.superuser = User.objects.create_superuser(
            email="superadmin@example.com",
            username="superadmin",
            password=self.password,
        )
        self.login_url = reverse('authentication:login')
        self.me_url = reverse('authentication:user-me')
        self.reset_request_url = reverse('authentication:password-reset-request-reset')

    def tearDown(self):
        cache.clear()

    def test_qa04_account_locked_after_five_failed_attempts_and_blocks_correct_password(self):
        """QA-04: tras 5 intentos fallidos, bloquea la cuenta e impide login con clave correcta."""
        for _ in range(4):
            res = self.client.post(self.login_url, {
                'email': self.user.email,
                'password': 'WrongPassword!',
            })
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res_5 = self.client.post(self.login_url, {
            'email': self.user.email,
            'password': 'WrongPassword!',
        })
        self.assertEqual(res_5.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(res_5.data.get('code'), 'account_locked')

        # Con la contraseña correcta dentro de la ventana de bloqueo sigue rechazado
        res_valid = self.client.post(self.login_url, {
            'email': self.user.email,
            'password': self.password,
        })
        self.assertEqual(res_valid.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(res_valid.data.get('code'), 'account_locked')

    def test_d33_superuser_without_groups_does_not_inherit_other_groups(self):
        """D-33: un superusuario sin grupos propios no hereda el grupo Evaluador QA."""
        self.assertEqual(self.superuser.groups.count(), 0)
        res = self.client.post(self.login_url, {
            'email': self.superuser.email,
            'password': self.password,
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('groups'), [])

    def test_d34_users_me_exposes_has_2fa_and_real_operator_stats(self):
        """D-34: /users/me/ expone has_2fa real y operator_stats calculadas desde BD."""
        TOTPDevice.objects.create(user=self.user, is_active=True)
        self.client.force_authenticate(user=self.user)

        res = self.client.get(self.me_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('has_2fa'))
        stats = res.data.get('operator_stats')
        self.assertIsInstance(stats, dict)
        self.assertEqual(stats['evaluations_total'], 0)
        self.assertEqual(stats['audited_factors'], 0)
        self.assertEqual(stats['verdicts_a'], 0)
        self.assertEqual(stats['critical_observations'], 0)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
        EMAIL_HOST='',
        DEFAULT_FROM_EMAIL='',
    )
    def test_d35_password_reset_returns_503_when_smtp_config_missing(self):
        """D-35: retorna HTTP 503 cuando falta configuración SMTP para usuario activo."""
        res = self.client.post(self.reset_request_url, {
            'email': self.user.email,
        })
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.data.get('code'), 'email_delivery_failed')

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        DEFAULT_FROM_EMAIL='noreply@guios.test',
    )
    @patch('apps.auth.services.otp.EmailMultiAlternatives.send', side_effect=OSError('SMTP down'))
    def test_d35_password_reset_returns_503_when_smtp_send_fails(self, _mock_send):
        """D-35: retorna HTTP 503 cuando msg.send() falla al entregar OTP."""
        res = self.client.post(self.reset_request_url, {
            'email': self.user.email,
        })
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.data.get('code'), 'email_delivery_failed')
