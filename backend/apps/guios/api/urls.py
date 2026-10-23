from django.urls import include, path
from rest_framework.routers import DefaultRouter

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
from .views.evaluation_views import (
    EvaluationCreateView,
    EvaluationDetailView,
    EvaluationDuplicateView,
    EvaluationFactorView,
    EvaluationSubfactorView,
    EvaluationSummaryView,
    EvaluationVerdictView,
)

app_name = 'guios'

admin_router = DefaultRouter()
admin_router.include_root_view = False
admin_router.register('dimensions', DimensionAdminViewSet, basename='admin-dimension')
admin_router.register('factors', FactorAdminViewSet, basename='admin-factor')
admin_router.register('subfactors', SubfactorAdminViewSet, basename='admin-subfactor')
admin_router.register('evaluations', EvaluationAdminViewSet, basename='admin-evaluation')

urlpatterns = [
    path('public/catalog/', PublicCatalogView.as_view(), name='public-catalog'),
    path('public/evaluations/', EvaluationCreateView.as_view(), name='public-evaluation-create'),
    path('public/evaluations/<uuid:evaluation_uuid>/', EvaluationDetailView.as_view(), name='public-evaluation-detail'),
    path('public/evaluations/<uuid:evaluation_uuid>/summary/', EvaluationSummaryView.as_view(), name='public-evaluation-summary'),
    path('public/evaluations/<uuid:evaluation_uuid>/factors/<int:factor_id>/', EvaluationFactorView.as_view(), name='public-evaluation-factor'),
    path('public/evaluations/<uuid:evaluation_uuid>/subfactors/<int:subfactor_id>/', EvaluationSubfactorView.as_view(), name='public-evaluation-subfactor'),
    path('public/evaluations/<uuid:evaluation_uuid>/verdict/', EvaluationVerdictView.as_view(), name='public-evaluation-verdict'),
    path('public/evaluations/<uuid:evaluation_uuid>/duplicate/', EvaluationDuplicateView.as_view(), name='public-evaluation-duplicate'),
    # Asistencia de IA (Paso 9; límite GUIOS_AI_RATE)
    path('public/ai/status/', AIStatusView.as_view(), name='public-ai-status'),
    path('public/evaluations/<uuid:evaluation_uuid>/ai/importance/', AIImportanceView.as_view(), name='public-ai-importance'),
    path('public/evaluations/<uuid:evaluation_uuid>/ai/factors/<int:factor_id>/ratings/', AIRatingsView.as_view(), name='public-ai-ratings'),
    path('public/evaluations/<uuid:evaluation_uuid>/ai/report/', AIReportView.as_view(), name='public-ai-report'),
    # Panel administrativo (autenticado, HasModulePermission)
    path('admin/catalog/tree/', CatalogTreeView.as_view(), name='admin-catalog-tree'),
    path('admin/metrics/', MetricsView.as_view(), name='admin-metrics'),
    path('admin/', include(admin_router.urls)),
]
