from django.db import models
from .evaluation import Evaluation


class EvaluationVerdict(models.Model):
    """
    Dictamen final emitido por el motor matemático.
    Relación OneToOne con Evaluation.
    Almacena opcionalmente el resumen ejecutivo y plan de mitigación de la IA.
    """
    RECOMMENDATION_A = 'A'
    RECOMMENDATION_B = 'B'
    RECOMMENDATION_C = 'C'

    RECOMMENDATION_CHOICES = (
        (RECOMMENDATION_A, 'Recomendación A (Adoptar sin observaciones)'),
        (RECOMMENDATION_B, 'Recomendación B (Es posible adoptar con matices)'),
        (RECOMMENDATION_C, 'Recomendación C (Analizar y posponer la adopción)'),
    )

    evaluation = models.OneToOneField(
        Evaluation,
        on_delete=models.CASCADE,
        related_name='verdict',
        verbose_name="Evaluación"
    )
    recommendation = models.CharField(
        max_length=1,
        choices=RECOMMENDATION_CHOICES,
        verbose_name="Tipo de recomendación"
    )
    explanation_text = models.TextField(
        verbose_name="Texto explicativo del dictamen",
        help_text="Texto explicativo determinista generado por el motor metodológico GUIOS."
    )
    ai_executive_summary = models.TextField(
        blank=True,
        default="",
        verbose_name="Resumen ejecutivo generado por IA",
        help_text="Resumen ejecutivo para la Alta Dirección. Vacío si la IA no fue invocada."
    )
    ai_mitigation_plan = models.TextField(
        blank=True,
        default="",
        verbose_name="Plan de mitigación generado por IA",
        help_text="Plan de acciones correctivas para factores negativos (Recomendación B o C). Vacío si no aplica."
    )
    calculated_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha y hora de emisión del dictamen"
    )

    class Meta:
        db_table = "guios_evaluationverdict"
        verbose_name = "Dictamen de Evaluación"
        verbose_name_plural = "Dictámenes de Evaluación"

    def __str__(self):
        return f"Eval #{self.evaluation_id} - Dictamen: {self.get_recommendation_display()}"
