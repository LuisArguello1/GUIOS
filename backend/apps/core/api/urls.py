from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.menu_views import MenuViewSet
from .views.organization_views import OrganizationViewSet
from .views.group_views import GroupViewSet
from .views.menu_management_views import MenuCategoryManagementViewSet, MenuModuleManagementViewSet
from .views.permission_tree_views import PermissionTreeViewSet
from .views.dashboard_views import DashboardView, DashboardExportView, DashboardExportStatusView

# Usamos SimpleRouter para evitar la duplicación de rutas innecesarias
router = DefaultRouter()

# Registro de rutas de configuración global y navegación
router.register(r'menu', MenuViewSet, basename='menu')
router.register(r'organization', OrganizationViewSet, basename='organization')
router.register(r'groups', GroupViewSet, basename='group')

# Administración avanzada de estructura
router.register(r'menu-categories', MenuCategoryManagementViewSet, basename='menu-category-mgmt')
router.register(r'menu-modules', MenuModuleManagementViewSet, basename='menu-module-mgmt')
router.register(r'permission-tree', PermissionTreeViewSet, basename='permission-tree')

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('dashboard/export/', DashboardExportView.as_view(), name='dashboard-export'),
    path('dashboard/export/status/', DashboardExportStatusView.as_view(), name='dashboard-export-status'),
    path('', include(router.urls)),
]
