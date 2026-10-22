from django.urls import path

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

urlpatterns = [
    path('public/catalog/', PublicCatalogView.as_view(), name='public-catalog'),
    path('public/evaluations/', EvaluationCreateView.as_view(), name='public-evaluation-create'),
    path('public/evaluations/<uuid:evaluation_uuid>/', EvaluationDetailView.as_view(), name='public-evaluation-detail'),
    path('public/evaluations/<uuid:evaluation_uuid>/summary/', EvaluationSummaryView.as_view(), name='public-evaluation-summary'),
    path('public/evaluations/<uuid:evaluation_uuid>/factors/<int:factor_id>/', EvaluationFactorView.as_view(), name='public-evaluation-factor'),
    path('public/evaluations/<uuid:evaluation_uuid>/subfactors/<int:subfactor_id>/', EvaluationSubfactorView.as_view(), name='public-evaluation-subfactor'),
    path('public/evaluations/<uuid:evaluation_uuid>/verdict/', EvaluationVerdictView.as_view(), name='public-evaluation-verdict'),
    path('public/evaluations/<uuid:evaluation_uuid>/duplicate/', EvaluationDuplicateView.as_view(), name='public-evaluation-duplicate'),
]
