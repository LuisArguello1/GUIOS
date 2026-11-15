import logging
from django.http import FileResponse
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
logger = logging.getLogger(__name__)

from ..serializers.auth_serializers import (
    LoginSerializer,
    OTPVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    Verify2FASerializer,
    TOTPSetupSerializer,
)
from ..serializers.user_serializers import UserDetailSerializer
from ...services.auth import clear_auth_cookies, get_auth_tokens, set_auth_cookies
from ...services.otp import (
    EmailDeliveryError,
    complete_password_reset,
    initiate_password_reset,
    verify_reset_code,
)
from ...services.totp_service import TOTPService
from ...utils.pdf_recovery_codes import RecoveryCodesPDFGenerator
from django.core.cache import cache

class PasswordResetThrottle(AnonRateThrottle):
    """Tasa definida en settings.py -> 'password_reset'"""
    scope = 'password_reset'


class LoginThrottle(AnonRateThrottle):
    """Tasa definida en settings.py -> 'login'"""
    scope = 'login'


class RefreshThrottle(AnonRateThrottle):
    """Tasa definida en settings.py -> 'refresh'"""
    scope = 'refresh'


def _build_auth_payload(*, request, user, detail: str, selected_group: dict | None = None) -> dict:
    groups = list(user.groups.values('id', 'name'))

    payload = {
        'detail': detail,
        'user': UserDetailSerializer(user, context={'request': request}).data,
        'groups': groups,
    }
    if selected_group:
        payload['selected_group'] = selected_group
    return payload


def _finalize_login_response(*, request, user, detail: str, selected_group: dict | None = None) -> Response:
    tokens = get_auth_tokens(user)

    response = Response(
        _build_auth_payload(
            request=request,
            user=user,
            detail=detail,
            selected_group=selected_group,
        ),
        status=status.HTTP_200_OK,
    )
    set_auth_cookies(response, tokens)
    return response


class LoginView(APIView):
    """
    Vista de inicio de sesión con blindaje contra fuerza bruta (IP y Email) 
    y logs de auditoría detallados.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    # Configuración de bloqueo progresivo (QA-04: 5 intentos fallidos -> bloqueo de 5 min)
    _MAX_ATTEMPTS   = 5
    _ATTEMPT_WINDOW = 300
    _LOCKOUT_TIMES  = [300, 900, 3600, 86400]  # 5min, 15min, 1h, 24h

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        # ── 1. VERIFICAR BLOQUEO POR EMAIL (Cooldown) ──
        if self._is_email_locked(email):
            logger.warning(
                "LOGIN BLOQUEADO (cooldown activo) | IP: %s | Email: %s",
                request.META.get('REMOTE_ADDR'), email,
            )
            return Response(
                {
                    'detail': _('Demasiados intentos fallidos. Inténtalo más tarde.'),
                    'code': 'account_locked'
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # ── 2. AUTENTICAR ──
        user = authenticate(request, email=email, password=password)

        if not user:
            attempts = self._register_failed_attempt(email, request)
            if attempts >= self._MAX_ATTEMPTS:
                return Response(
                    {
                        'detail': _(
                            'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada '
                            'temporalmente por seguridad. Inténtalo de nuevo en unos minutos.'
                        ),
                        'code': 'account_locked',
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            return Response(
                {'detail': _('Credenciales inválidas o cuenta inactiva.')},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ── 3. VERIFICAR SI REQUIERE 2FA ──
        if hasattr(user, 'totp_device') and user.totp_device.is_active:
            pre_auth_token = TOTPService.create_pre_auth_session(user)
            logger.info("2FA REQUERIDO | UserID: %s | Email: %s", user.id, user.email)
            return Response(
                {
                    'detail': _('Se requiere autenticación de doble factor.'),
                    'requires_2fa': True,
                    'pre_auth_token': pre_auth_token
                },
                status=status.HTTP_200_OK,  # 200 porque las credenciales son correctas
            )

        # ── 4. LOGIN EXITOSO (Sin 2FA) ──
        self._clear_attempts(email)
        logger.info(
            "LOGIN EXITOSO | IP: %s | UserID: %s | Email: %s",
            request.META.get('REMOTE_ADDR'), user.id, user.email
        )

        return _finalize_login_response(
            request=request,
            user=user,
            detail=_('Inicio de sesión exitoso.'),
        )

    # ── Helpers de seguridad ──

    def _attempts_key(self, email: str) -> str:
        return f"login_attempts:{email}"

    def _is_email_locked(self, email: str) -> bool:
        return cache.get(self._attempts_key(email), 0) >= self._MAX_ATTEMPTS

    def _register_failed_attempt(self, email: str, request) -> int:
        key = self._attempts_key(email)
        attempts = cache.get(key, 0) + 1

        if attempts < self._MAX_ATTEMPTS:
            timeout = self._ATTEMPT_WINDOW
        else:
            # Escalar el tiempo de bloqueo según el número de fallos
            stage = max(0, (attempts // self._MAX_ATTEMPTS) - 1)
            index = min(stage, len(self._LOCKOUT_TIMES) - 1)
            timeout = self._LOCKOUT_TIMES[index]

        cache.set(key, attempts, timeout=timeout)

        logger.warning(
            "LOGIN FALLIDO | IP: %s | Email: %s | Intento: %d | Lockout: %d s",
            request.META.get('REMOTE_ADDR'), email, attempts, timeout,
        )
        return attempts

    def _clear_attempts(self, email: str):
        cache.delete(self._attempts_key(email))


class LogoutView(APIView):
    """Vista para cierre de sesión y limpieza de cookies."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        response = Response(
            {'detail': _('Sesión cerrada correctamente.')},
            status=status.HTTP_200_OK,
        )
        clear_auth_cookies(response)
        return response


class CookieTokenRefreshView(APIView):
    """
    Refresca el access_token usando el refresh_token almacenado en la cookie HttpOnly.
    Evita exponer los tokens en el cuerpo de la peticion en el cliente.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RefreshThrottle]

    def post(self, request):
        refresh_cookie = request.COOKIES.get('refresh_token')
        
        # Leemos el header si es un cliente programático que usa request bodies normales
        if not refresh_cookie and 'refresh' in request.data:
            refresh_cookie = request.data.get('refresh')

        if not refresh_cookie:
            return Response(
                {"detail": _("No se encontró el token de refresco en la sesión.")},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        try:
            # Usar el serializer oficial de SimpleJWT para el flujo de refresco
            serializer = TokenRefreshSerializer(data={'refresh': str(refresh_cookie)})
            serializer.is_valid(raise_exception=True)
            
            access_token = serializer.validated_data.get('access')
            # SimpleJWT puede o no rotar el refresh token según la configuración
            refresh_token = serializer.validated_data.get('refresh') or str(refresh_cookie)
            
            response = Response(
                {"detail": _("Token refrescado correctamente.")},
                status=status.HTTP_200_OK
            )
            
            # Renovamos las cookies transparentemente manteniendo el MISMO SID o el del nuevo token
            set_auth_cookies(response, {
                'access': access_token, 
                'refresh': refresh_token,
                'sid': sid
            })
            
            return response
            
        except Exception:
            # Si el refresh token es inválido o expiró, forzamos logout borrando cookies
            response = Response(
                {"detail": _("La sesión ha expirado, inicie sesión nuevamente.")},
                status=status.HTTP_401_UNAUTHORIZED
            )
            clear_auth_cookies(response)
            return response


class PasswordResetWizardViewSet(viewsets.ViewSet):
    """
    Flujo de recuperación de contraseña en 3 pasos (wizard).

    Todos los endpoints tienen throttling estricto para prevenir
    ataques de fuerza bruta y enumeración de emails.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    @action(detail=False, methods=['post'], url_path='request')
    def request_reset(self, request):
        """PASO 1: Enviar código OTP al email."""
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        try:
            initiate_password_reset(email)
        except EmailDeliveryError as exc:
            return Response(
                {
                    'detail': str(exc),
                    'code': 'email_delivery_failed',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Siempre retornar 200 para no revelar si el email existe cuando el servicio opera normalmente
        return Response(
            {'detail': _('Si el correo existe, recibirás un código de 6 dígitos en breve.')},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='verify')
    def verify_otp(self, request):
        """PASO 2: Verificar el código OTP."""
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        code = serializer.validated_data['code']

        is_valid = verify_reset_code(email, code)

        if not is_valid:
            return Response(
                {'detail': _('Código inválido o expirado.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'detail': _('Código verificado. Procede a cambiar tu contraseña.'),
                'verified': True,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='confirm')
    def confirm_reset(self, request):
        """PASO 3: Cambiar la contraseña definitiva."""
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']

        success = complete_password_reset(email, code, new_password)

        if not success:
            return Response(
                {'detail': _('No se pudo restablecer la contraseña. El código puede haber expirado.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {'detail': _('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')},
            status=status.HTTP_200_OK,
        )


class Verify2FAView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = Verify2FASerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pre_auth_token = serializer.validated_data['pre_auth_token']
        code = serializer.validated_data['code']

        user = TOTPService.get_user_from_pre_auth(pre_auth_token)
        if not user:
            return Response(
                {'detail': _('La sesión de verificación ha expirado o es inválida.')},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # MEJORA: verify_login_code ahora puede fallar por rate limit
        # (5 intentos fallidos) además de código incorrecto.
        # Ambos casos devuelven 400 con mensaje genérico para no filtrar
        # información sobre si el bloqueo está activo.
        if not TOTPService.verify_login_code(user, code):
            return Response(
                {'detail': _('Código de verificación incorrecto.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        TOTPService.invalidate_pre_auth(pre_auth_token)
        return _finalize_login_response(
            request=request,
            user=user,
            detail=_('Autenticación de doble factor exitosa.'),
        )


class TOTPManagementViewSet(viewsets.ViewSet):
    """
    Gestión de 2FA para el usuario autenticado.
    Permite obtener datos de configuración, activar y desactivar 2FA.
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='config')
    def get_config(self, request):
        """Obtiene la URI de provisioning y el estado actual."""
        data = TOTPService.get_provisioning_data(request.user)
        return Response(data)

    @action(detail=False, methods=['post'], url_path='activate')
    def activate(self, request):
        """Activa el 2FA tras verificar el primer código."""
        serializer = TOTPSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        result = TOTPService.activate_2fa(request.user, serializer.validated_data['code'])
        if result['success']:
            return Response({
                'detail': _('Autenticación de doble factor activada correctamente.'),
                'recovery_codes': result['recovery_codes']
            })
        
        return Response(
            {'detail': _('Código inválido. No se pudo activar el 2FA.')},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=False, methods=['post'], url_path='regenerate-codes')
    def regenerate_codes(self, request):
        """Regenera los códigos de recuperación (requiere validación de password)."""
        password = request.data.get('password')
        if not password or not request.user.check_password(password):
            return Response(
                {'detail': _('Contraseña incorrecta.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        codes = TOTPService.regenerate_recovery_codes(request.user)
        return Response({
            'detail': _('Nuevos códigos de recuperación generados.'),
            'recovery_codes': codes
        })

    @action(detail=False, methods=['post'], url_path='export-pdf')
    def export_pdf(self, request):
        """Exporta los códigos entregados por el frontend a un PDF."""
        codes = request.data.get('codes', [])
        if not codes:
            return Response(
                {'detail': _('Faltan los códigos para generar el PDF.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        pdf_buffer = RecoveryCodesPDFGenerator.generate(codes, request.user.email)
        return FileResponse(
            pdf_buffer, 
            as_attachment=True, 
            filename=f"dvi_recovery_codes_{request.user.id}.pdf",
            content_type='application/pdf'
        )

    @action(detail=False, methods=['post'], url_path='deactivate')
    def deactivate(self, request):
        """Desactiva el 2FA (requiere validación de password por seguridad)."""
        password = request.data.get('password')
        if not password or not request.user.check_password(password):
            return Response(
                {'detail': _('Contraseña incorrecta.')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        TOTPService.deactivate_2fa(request.user)
        return Response({'detail': _('Autenticación de doble factor desactivada.')})


