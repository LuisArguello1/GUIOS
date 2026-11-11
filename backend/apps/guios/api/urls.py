"""
apps/guios/api/urls.py
─────────────────────────────────────────────────────────────────────────────
Enrutador de endpoints para la aplicación GUIOS.
Registra ViewSets para dimensiones, factores, subfactores y evaluaciones.
"""

from rest_framework.routers import DefaultRouter
from .views.dimension_views import DimensionViewSet
from .views.factor_views import FactorViewSet
from .views.subfactor_views import SubfactorViewSet
from .views.evaluation_views import EvaluationViewSet
from .views.ai_log_views import AILogViewSet
from .views.dashboard_views import DashboardViewSet
from .views.public_evaluation_views import PublicEvaluationViewSet

router = DefaultRouter()
router.register(r'dimensions', DimensionViewSet, basename='dimension')
router.register(r'factors', FactorViewSet, basename='factor')
router.register(r'subfactors', SubfactorViewSet, basename='subfactor')
router.register(r'evaluations', EvaluationViewSet, basename='evaluation')
router.register(r'public/evaluations', PublicEvaluationViewSet, basename='public-evaluation')
router.register(r'ai-logs', AILogViewSet, basename='ai-log')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

urlpatterns = router.urls

