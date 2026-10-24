"""
apps/guios/api/urls.py
─────────────────────────────────────────────────────────────────────────────
Enrutador unificado de endpoints para GUIOS:
- ViewSets administrativos y de gestión (dimensiones, factores, subfactores, evaluaciones, ai-logs, dashboard)
- Vistas públicas para el flujo wizard de evaluación de software y catálogo público
- Rutas administrativas avanzadas de árbol de catálogo y métricas
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views.dimension_views import DimensionViewSet
from .views.factor_views import FactorViewSet
from .views.subfactor_views import SubfactorViewSet
from .views.evaluation_views import (
    EvaluationViewSet,
    EvaluationCreateView,
    EvaluationDetailView,
    EvaluationDuplicateView,
    EvaluationFactorView,
    EvaluationSubfactorView,
    EvaluationSummaryView,
    EvaluationVerdictView,
)
from .views.ai_log_views import AILogViewSet
from .views.dashboard_views import DashboardViewSet
from .views.admin_catalog_views import (
    CatalogTreeView,
    DimensionAdminViewSet,
    FactorAdminViewSet,
    SubfactorAdminViewSet,
)
from .views.admin_evaluation_views import EvaluationAdminViewSet
from .views.admin_metrics_views import MetricsView
from .views.ai_views import AIImportanceView, AIRatingsView, AIReportView, AIStatusView
from .views.catalog_views import PublicCatalogView

app_name = 'guios'

# Router principal (CRUDs, dashboard y evaluaciones administrativas)
router = DefaultRouter()
router.register(r'dimensions', DimensionViewSet, basename='dimension')
router.register(r'factors', FactorViewSet, basename='factor')
router.register(r'subfactors', SubfactorViewSet, basename='subfactor')
router.register(r'evaluations', EvaluationViewSet, basename='evaluation')
router.register(r'ai-logs', AILogViewSet, basename='ai-log')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

# Router administrativo de catálogo de guios-pro
admin_router = DefaultRouter()
admin_router.include_root_view = False
admin_router.register('dimensions', DimensionAdminViewSet, basename='admin-dimension')
admin_router.register('factors', FactorAdminViewSet, basename='admin-factor')
admin_router.register('subfactors', SubfactorAdminViewSet, basename='admin-subfactor')
admin_router.register('evaluations', EvaluationAdminViewSet, basename='admin-evaluation')

urlpatterns = [
    # ── Rutas públicas de evaluación (Paso 5 y 6) ───────────────────────────
    path('public/catalog/', PublicCatalogView.as_view(), name='public-catalog'),
    path('public/evaluations/', EvaluationCreateView.as_view(), name='public-evaluation-create'),
    path('public/evaluations/<uuid:evaluation_uuid>/', EvaluationDetailView.as_view(), name='public-evaluation-detail'),
    path('public/evaluations/<uuid:evaluation_uuid>/summary/', EvaluationSummaryView.as_view(), name='public-evaluation-summary'),
    path('public/evaluations/<uuid:evaluation_uuid>/factors/<int:factor_id>/', EvaluationFactorView.as_view(), name='public-evaluation-factor'),
    path('public/evaluations/<uuid:evaluation_uuid>/subfactors/<int:subfactor_id>/', EvaluationSubfactorView.as_view(), name='public-evaluation-subfactor'),
    path('public/evaluations/<uuid:evaluation_uuid>/verdict/', EvaluationVerdictView.as_view(), name='public-evaluation-verdict'),
    path('public/evaluations/<uuid:evaluation_uuid>/duplicate/', EvaluationDuplicateView.as_view(), name='public-evaluation-duplicate'),
    path('public/ai/status/', AIStatusView.as_view(), name='public-ai-status'),
    path('public/evaluations/<uuid:evaluation_uuid>/ai/importance/', AIImportanceView.as_view(), name='public-ai-importance'),
    path('public/evaluations/<uuid:evaluation_uuid>/ai/factors/<int:factor_id>/ratings/', AIRatingsView.as_view(), name='public-ai-ratings'),
    path('public/evaluations/<uuid:evaluation_uuid>/ai/report/', AIReportView.as_view(), name='public-ai-report'),

    # ── Rutas administrativas adicionales de guios-pro ───────────────────────
    path('admin/catalog/tree/', CatalogTreeView.as_view(), name='admin-catalog-tree'),
    path('admin/metrics/', MetricsView.as_view(), name='admin-metrics'),
    path('admin/', include(admin_router.urls)),
] + router.urls
