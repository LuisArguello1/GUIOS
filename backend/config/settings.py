import os
import sys
from pathlib import Path
from datetime import timedelta
from celery.schedules import crontab
from kombu import Queue
from dotenv import load_dotenv

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / 'apps'))

# Load environment variables
load_dotenv(BASE_DIR.parent / '.env', override=True)


def _env_list(name: str, default: str = '') -> list[str]:
    raw = os.getenv(name, default)
    return [value.strip() for value in raw.split(',') if value.strip()]


# Security
SECRET_KEY = os.getenv('SECRET_KEY', 'iu4*20(b@7qmzwm0mg#oyo)5mwz7d6n@n4vc5o9rc4k2z94yea')
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# Protecciones de seguridad adicionales (Django SecurityMiddleware)
# solo se activan en producciÃ³n para evitar problemas con proxies locales sin SSL
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

# Allowed Hosts
ALLOWED_HOSTS = _env_list('ALLOWED_HOSTS', '*')

# Dinámicamente agregar la IP local y el hostname para evitar problemas en intranet
import socket
import platform

def _get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

try:
    _local_ip = _get_local_ip()
    _hostname = platform.node()
    for _host in [_local_ip, _hostname, f"{_hostname}.local"]:
        if _host and _host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_host)
except Exception:
    pass


# Frontend deployment paths
SITE_URL = os.getenv('VITE_BACKEND_URL', 'http://localhost:8040').rstrip('/')
FRONTEND_URL = os.getenv('VITE_BACKEND_URL', 'http://localhost:5173').rstrip('/')
FRONTEND_ADMIN_DIST_DIR = Path(os.getenv('FRONTEND_ADMIN_DIST_DIR', str(BASE_DIR.parent / 'frontend' / 'dist')))

# CSRF Trusted Origins
_DEFAULT_CSRF_TRUSTED_ORIGINS = [
    'http://localhost',
    'http://127.0.0.1',
    'https://*.trycloudflare.com',
]
CSRF_TRUSTED_ORIGINS = _DEFAULT_CSRF_TRUSTED_ORIGINS + _env_list('CSRF_TRUSTED_ORIGINS')

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Configuración de cookies seguras para JWT
JWT_COOKIE_SECURE = os.getenv('JWT_COOKIE_SECURE', 'False' if DEBUG else 'True').lower() in ('true', '1', 't')


# Application definition
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'django.contrib.postgres',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
]

LOCAL_APPS = [
    'apps.core',     
    'apps.auth',
    'apps.guios', 
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'apps.core.middleware.monitoring.GlobalExceptionMiddleware',
    'apps.core.middleware.monitoring.RequestTraceMiddleware',
    'apps.core.middleware.monitoring.PerformanceSecurityMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'apps.core.middleware.sanitization.XSSSanitizationMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.auth.middleware.AuditMiddleware',
    'apps.auth.middleware.security.SessionSecurityMiddleware',
]

if DEBUG:
    SLOW_REQUEST_WARNING_SECONDS = 5.0
    SLOW_REQUEST_CRITICAL_SECONDS = 15.0
else:
    SLOW_REQUEST_WARNING_SECONDS = 2.0
    SLOW_REQUEST_CRITICAL_SECONDS = 8.0

ROOT_URLCONF = 'config.urls'
ASGI_APPLICATION = 'config.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Permite ejecutar `python backend/manage.py test` desde la raíz del repositorio.
TEST_RUNNER = 'config.test_runner.BackendDiscoverRunner'
ASGI_APPLICATION = 'config.asgi.application'

# Database
if os.getenv('DB_ENGINE'):
    DATABASES = {
        'default': {
            'ENGINE': os.getenv('DB_ENGINE'),
            'NAME': os.getenv('DB_NAME'),
            'USER': os.getenv('DB_USER'),
            'PASSWORD': os.getenv('DB_PASSWORD'),
            'HOST': os.getenv('DB_HOST'),
            'PORT': os.getenv('DB_PORT'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'es-ec'
TIME_ZONE = 'America/Guayaquil'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
STATICFILES_DIRS = []
if FRONTEND_ADMIN_DIST_DIR.exists():
    STATICFILES_DIRS.append(FRONTEND_ADMIN_DIST_DIR)

WHITENOISE_INDEX_FILE = True
WHITENOISE_MIMETYPES = {
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
}

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default settings
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'authentication.CustomUser'

# Cache (Redis)
REDIS_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1')
if os.getenv('REDIS_URL') or os.getenv('REDIS_CACHE_URL'):
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': os.getenv('REDIS_CACHE_URL', REDIS_URL),
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            },
            'KEY_PREFIX': 'guios_cache',
        }
    }
else:
    # Desarrollo local sin Redis: cache en memoria (se pierde al reiniciar el servidor)
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'KEY_PREFIX': 'guios_cache',
        }
    }

# Usar Redis para el almacenamiento de sesiones
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"


# Throttling (ProtecciÃ³n DoS bÃ¡sica via DRF)
# ------------------------------------------------------------------------------
# Estos lÃ­mites protegen contra ataques masivos de scripts o malintencionados.
# Usuarios anÃ³nimos: 100 peticiones por minuto.
# Usuarios autenticados: 1000 peticiones por minuto.

# REST Framework
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'apps.core.utils.exception_handler.custom_exception_handler',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.auth.authentication.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    # Throttling
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '600/minute',
        'login': '5/minute',            # Por IP
        'password_reset': '5/minute',   # Por IP
        'refresh': '20/minute',         # Por IP
        # API pública de GUIOS (guardado automático; varios equipos pueden compartir IP)
        'guios_public': os.getenv('GUIOS_PUBLIC_RATE', '600/minute'),
    },
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# GUIOS: límite de creación de evaluaciones públicas por IP (django-ratelimit)
GUIOS_EVALUATION_CREATE_RATE = os.getenv('GUIOS_EVALUATION_CREATE_RATE', '100/h')

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=8),
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=60),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(hours=8),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'TOKEN_USER_CLASS': 'rest_framework_simplejwt.models.TokenUser',
}

# CORS Configuration
_DEFAULT_CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https?://localhost:\d+$",
    r"^https?://127\.0\.0\.1:\d+$",
    r"^https?://192\.168\.\d+\.\d+:\d+$",
    r"^https?://10\.\d+\.\d+\.\d+:\d+$",
    r"^https?://172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$",
    r"^https://[a-z0-9\-]+\.trycloudflare\.com$",
    r"^https?://localhost$",
    r"^https?://127\.0\.0\.1$",
    r"^https?://192\.168\.\d+\.\d+$",
    r"^https?://10\.\d+\.\d+\.\d+$",
]
CORS_ALLOWED_ORIGIN_REGEXES = _DEFAULT_CORS_ALLOWED_ORIGIN_REGEXES + _env_list('CORS_ALLOWED_ORIGIN_REGEXES')

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', default=587))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', default=True)
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')

# Cuota diaria de correos (tracking en Redis vía apps.core.services.email_tracker).
DAILY_EMAIL_LIMIT = int(os.getenv('DAILY_EMAIL_LIMIT', 500))

# 2FA / TOTP Configuration
TOTP_ISSUER_NAME = os.getenv('TOTP_ISSUER_NAME', 'GUIOS')

# Asegura el directorio de logs antes de que Django configure handlers de archivo.
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# LOGGING
# ------------------------------------------------------------------------------
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'auth_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': str(LOGS_DIR / 'auth.log'),
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'apps.auth': {
            'handlers': ['auth_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ==============================================================================
# CELERY & REDIS CONFIGURATION
# ==============================================================================
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'))
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'))
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60



