"""
Runner de pruebas del proyecto.

Permite ejecutar `python backend/manage.py test` desde la raíz del repositorio:
sin etiquetas, el DiscoverRunner de Django buscaría en el directorio actual
(la raíz) y no encontraría los paquetes `apps.*`. Aquí la búsqueda parte
siempre de `backend/` (settings.BASE_DIR).
"""
from django.conf import settings
from django.test.runner import DiscoverRunner


class BackendDiscoverRunner(DiscoverRunner):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.top_level is None:
            self.top_level = str(settings.BASE_DIR)

    def build_suite(self, test_labels=None, **kwargs):
        if not test_labels:
            test_labels = [str(settings.BASE_DIR)]
        return super().build_suite(test_labels, **kwargs)
