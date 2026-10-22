import os
from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, HttpResponse

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

def serve_spa(request, path=""):
    """
    Sirve el frontend SPA de React e iconos estaticos (favicon.ico)
    para cualquier ruta no API ni Admin, evitando errores 404 en Waitress.
    """
    clean_path = path.lstrip('/')
    if clean_path:
        direct_file = os.path.join(settings.STATIC_ROOT, clean_path)
        if os.path.isfile(direct_file):
            return FileResponse(open(direct_file, 'rb'))

    index_file = os.path.join(settings.STATIC_ROOT, 'index.html')
    if os.path.isfile(index_file):
        return FileResponse(open(index_file, 'rb'), content_type='text/html')

    return HttpResponse("<h3>Backend API</h3><p>API activa.</p>")

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    # Esquema OpenAPI (JSON/YAML)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # Swagger UI
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # ReDoc
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),

    # API Core & Auth
    path('api/v1/core/', include('apps.core.api.urls')),
    path('api/v1/guios/', include('apps.guios.api.urls')),
    path('api/v1/', include('apps.auth.api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Fallback para servir media con Waitress cuando Nginx esta apagado en intranet.
    from django.views.static import serve

    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]

# Fallback SPA React: captura la raíz '/' y cualquier ruta del cliente que no sea API
urlpatterns += [
    re_path(r'^(?P<path>(?!api/|admin/|media/|static/).*)$', serve_spa, name='spa-fallback'),
]
