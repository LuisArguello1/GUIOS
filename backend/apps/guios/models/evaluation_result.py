from django.db import models
from .evaluation import Evaluation
from .factor import Factor


class EvaluationResult(models.Model):
    """
    Resultados calculados por el motor matemático para cada factor relevante:
    Ponderación Media (PM) y clasificación FODA.
    """
    FODA_STRENGTH = 'strength'
    FODA_WEAKNESS = 'weakness'
    FODA_OPPORTUNITY = 'opportunity'
    FODA_THREAT = 'threat'

    FODA_CHOICES = (
        (FODA_STRENGTH, 'Fortaleza'),
        (FODA_WEAKNESS, 'Debilidad'),
        (FODA_OPPORTUNITY, 'Oportunidad'),
        (FODA_THREAT, 'Amenaza'),
    )

    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name='evaluation_results',
        verbose_name="Evaluación"
    )
    factor = models.ForeignKey(
        Factor,
        on_delete=models.PROTECT,
        related_name='evaluation_results',
        verbose_name="Factor evaluado"
    )
    weighted_average = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Ponderación Media (PM)",
        help_text="PM = suma(calificaciones) / cantidad de subfactores. Umbral metodológico: >= 3.0."
    )
    meets_threshold = models.BooleanField(
        verbose_name="Cumple umbral metodológico",
        help_text="True si PM >= 3.0."
    )
    foda_classification = models.CharField(
        max_length=12,
        choices=FODA_CHOICES,
        verbose_name="Clasificación FODA"
    )
    calculated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Fecha y hora de cálculo"
    )

    class Meta:
        db_table = "guios_evaluationresult"
        unique_together = [("evaluation", "factor")]
        verbose_name = "Resultado de Evaluación"
        verbose_name_plural = "Resultados de Evaluación"

    def __str__(self):
        return f"Eval #{self.evaluation_id} - {self.factor.name}: {self.get_foda_classification_display()} (PM: {self.weighted_average})"
