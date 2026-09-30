import uuid
from django.conf import settings
from django.db import models


class Evaluation(models.Model):
    """
    Registro principal de una sesión de evaluación.
    Actúa como cabecera de todos los registros de detalle.
    """
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_COMPLETED = 'completed'

    STATUS_CHOICES = (
        (STATUS_IN_PROGRESS, 'En progreso'),
        (STATUS_COMPLETED, 'Completada'),
    )

    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
        verbose_name="UUID público"
    )
    software_name = models.CharField(
        max_length=200,
        verbose_name="Nombre del software candidato"
    )
    software_version = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Versión del software"
    )
    software_repo_url = models.URLField(
        blank=True,
        null=True,
        verbose_name="Enlace al repositorio del software"
    )
    org_name = models.CharField(
        max_length=200,
        verbose_name="Nombre de la organización evaluadora"
    )
    org_sector = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="Sector o rubro"
    )
    org_description = models.TextField(
        blank=True,
        default="",
        verbose_name="Descripción de necesidades y contexto TI"
    )
    ai_enabled = models.BooleanField(
        default=False,
        verbose_name="Asistencia de IA activada"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_IN_PROGRESS,
        verbose_name="Estado de la evaluación"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='evaluations',
        verbose_name="Usuario creador"
    )
    started_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha y hora de inicio"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha y hora de finalización"
    )
    session_token = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        unique=True,
        db_index=True,
        verbose_name="Token de sesión anónima"
    )

    class Meta:
        db_table = "guios_evaluation"
        ordering = ["-started_at"]
        verbose_name = "Evaluación"
        verbose_name_plural = "Evaluaciones"

    def __str__(self):
        return f"{self.software_name} ({self.org_name}) - {self.get_status_display()}"
