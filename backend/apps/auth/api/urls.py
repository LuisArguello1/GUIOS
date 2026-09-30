from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views.user_views import UserViewSet
from .views.audit_views import AuditLogViewSet
from .views.auth_views import (
    LoginView,
    LogoutView,
    PasswordResetWizardViewSet,
    CookieTokenRefreshView,
    Verify2FAView,
    TOTPManagementViewSet,
)

app_name = 'authentication'

# Simplificamos con un router para los ViewSets
router = SimpleRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'audit/logs', AuditLogViewSet, basename='auditlog')
router.register(r'password-reset', PasswordResetWizardViewSet, basename='password-reset')
router.register(r'auth/2fa', TOTPManagementViewSet, basename='totp-mgmt')

urlpatterns = [
    # Router endpoints (users, audit, password-reset, totp)
    path('', include(router.urls)),
    
    # Auth endpoints
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/login/verify-2fa/', Verify2FAView.as_view(), name='login_verify_2fa'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
]
