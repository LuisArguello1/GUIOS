from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from .evaluation import Evaluation
from .subfactor import Subfactor


class EvaluationSubfactor(models.Model):
    """
    Calificación asignada a cada subfactor en el Paso 3-4.
    Incluye snapshot del texto del subfactor para proteger el historial (RN-08).
    """
    RATING_CHOICES = (
        (1, 'No cumple el requisito'),
        (2, 'Desconozco si cumple el requisito'),
        (3, 'Cumple parcialmente el requisito'),
        (4, 'Cumple el requisito'),
    )

    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name='evaluation_subfactors',
        verbose_name="Evaluación"
    )
    subfactor = models.ForeignKey(
        Subfactor,
        on_delete=models.PROTECT,
        related_name='evaluation_subfactors',
        verbose_name="Subfactor"
    )
    description_snapshot = models.TextField(
        verbose_name="Snapshot de descripción del criterio",
        help_text="Copia inmutable del texto del subfactor al momento de la evaluación (RN-08)."
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        choices=RATING_CHOICES,
        verbose_name="Calificación del evaluador",
        help_text="1: No cumple, 2: Desconozco, 3: Cumple parcialmente, 4: Cumple."
    )
    ai_suggested_rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Calificación sugerida por IA"
    )
    ai_rating_justification = models.TextField(
        blank=True,
        default="",
        verbose_name="Justificación de la calificación sugerida por IA"
    )
    rating_was_ai_accepted = models.BooleanField(
        default=False,
        verbose_name="Calificación de IA aceptada sin cambios"
    )
    saved_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Fecha y hora de guardado"
    )

    class Meta:
        db_table = "guios_evaluationsubfactor"
        unique_together = [("evaluation", "subfactor")]
        verbose_name = "Subfactor de Evaluación"
        verbose_name_plural = "Subfactores de Evaluación"

    def __str__(self):
        return f"Eval #{self.evaluation_id} - Subfactor #{self.subfactor_id} (Calificación: {self.rating})"
