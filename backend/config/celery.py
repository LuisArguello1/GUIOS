"""
config/celery.py
───────────────────────────────────────────────────────────────────────────────
Entry point de Celery para procesamiento asíncrono de tareas.

Se usa junto con Redis como broker y result backend.

Ejecución del worker:
    celery -A config worker --pool=eventlet -l info

"""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('guios')

# Usa namespace CELERY_ para todas las configuraciones relacionadas
app.config_from_object('django.conf:settings', namespace='CELERY')

# Descubre automáticamente las tasks en todas las apps instaladas
app.autodiscover_tasks()