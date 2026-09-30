from django.db import models
from .evaluation import Evaluation
from .factor import Factor


class AIAssistanceLog(models.Model):
    """
    Registro inmutable de cada llamada al servicio de IA durante una evaluación.
    Permite trazabilidad completa de las interacciones con el servicio externo.
    """
    REQ_FACTOR_IMPORTANCE = 'factor_importance'
    REQ_SUBFACTOR_RATING = 'subfactor_rating'
    REQ_EXECUTIVE_SUMMARY = 'executive_summary'

    REQUEST_TYPE_CHOICES = (
        (REQ_FACTOR_IMPORTANCE, 'Importancia de Factores (Paso 1-2)'),
        (REQ_SUBFACTOR_RATING, 'Calificación de Subfactores (Paso 3-4)'),
        (REQ_EXECUTIVE_SUMMARY, 'Resumen Ejecutivo y Mitigación (Paso 5-6)'),
    )

    STATUS_SUCCESS = 'success'
    STATUS_ERROR = 'error'
    STATUS_TIMEOUT = 'timeout'

    STATUS_CHOICES = (
        (STATUS_SUCCESS, 'Éxito'),
        (STATUS_ERROR, 'Error'),
        (STATUS_TIMEOUT, 'Timeout'),
    )

    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name='ai_logs',
        verbose_name="Evaluación"
    )
    request_type = models.CharField(
        max_length=30,
        choices=REQUEST_TYPE_CHOICES,
        verbose_name="Tipo de solicitud de IA"
    )
    factor = models.ForeignKey(
        Factor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_logs',
        verbose_name="Factor involucrado",
        help_text="Aplica para solicitudes de importancia o subfactores específicos."
    )
    request_payload = models.JSONField(
        verbose_name="Payload enviado",
        help_text="Cuerpo de la solicitud enviada al servicio (sin credenciales de API)."
    )
    response_payload = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Payload recibido",
        help_text="Cuerpo de la respuesta retornada por el servicio de IA."
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_SUCCESS,
        verbose_name="Estado de la respuesta"
    )
    error_message = models.TextField(
        blank=True,
        default="",
        verbose_name="Mensaje de error"
    )
    response_time_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Tiempo de respuesta (ms)",
        help_text="Duración en milisegundos de la solicitud (timeout predeterminado: 30000 ms)."
    )
    requested_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha y hora de la solicitud"
    )

    class Meta:
        db_table = "guios_aiassistancelog"
        ordering = ["-requested_at"]
        verbose_name = "Log de Asistencia IA"
        verbose_name_plural = "Logs de Asistencia IA"

    def __str__(self):
        return f"AI Log #{self.id} (Eval #{self.evaluation_id}) - {self.get_request_type_display()} [{self.status}]"
