from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from .evaluation import Evaluation
from .factor import Factor


class EvaluationFactor(models.Model):
    """
    Configuración asignada por el evaluador a cada factor en el Paso 1-2.
    Incluye snapshots de la IS y del nombre del factor para proteger el historial si el catálogo cambia (RN-08).
    """
    SCOPE_INTERNAL = 'internal'
    SCOPE_EXTERNAL = 'external'

    SCOPE_CHOICES = (
        (SCOPE_INTERNAL, 'Interno'),
        (SCOPE_EXTERNAL, 'Externo'),
    )

    IMPORTANCE_CHOICES = (
        (1, 'Irrelevante'),
        (2, 'Opcional'),
        (3, 'Importante'),
        (4, 'Fundamental'),
    )

    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name='evaluation_factors',
        verbose_name="Evaluación"
    )
    factor = models.ForeignKey(
        Factor,
        on_delete=models.PROTECT,
        related_name='evaluation_factors',
        verbose_name="Factor"
    )
    suggested_importance_snapshot = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Snapshot de Importancia Sugerida (IS)",
        help_text="Copia inmutable del IS del factor al momento de la evaluación (RN-08)."
    )
    factor_name_snapshot = models.CharField(
        max_length=200,
        verbose_name="Snapshot del nombre del factor",
        help_text="Copia inmutable del nombre del factor al momento de la evaluación (RN-08)."
    )
    decisor_importance = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia del Decisor (ID)",
        help_text="Valoración asignada por la organización evaluadora (1 a 4). Nulo = sin calificar (RN-12)."
    )
    relative_importance = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia Relativa (IR)",
        help_text="Calculada por el motor: floor((IS_idx + ID_idx) / 2) mapeada a [1-4]. Nula mientras la ID esté sin calificar."
    )
    is_relevant = models.BooleanField(
        null=True,
        blank=True,
        verbose_name="Es relevante",
        help_text="True si IR > Irrelevante (1). Determina si pasa al Paso 3-4 (RN-01). Nulo mientras la ID esté sin calificar."
    )
    scope_used = models.CharField(
        max_length=10,
        choices=SCOPE_CHOICES,
        blank=True,
        default="",
        verbose_name="Ámbito FODA efectivo",
        help_text="Interno o Externo. Configurable por el usuario solo para 'Soporte'; vacío mientras no lo elija (RN-06, RN-12)."
    )
    ai_suggested_id = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="ID sugerido por IA"
    )
    ai_id_justification = models.TextField(
        blank=True,
        default="",
        verbose_name="Justificación de la sugerencia de IA"
    )
    id_was_ai_accepted = models.BooleanField(
        default=False,
        verbose_name="Sugerencia de IA aceptada sin cambios"
    )

    class Meta:
        db_table = "guios_evaluationfactor"
        unique_together = [("evaluation", "factor")]
        verbose_name = "Factor de Evaluación"
        verbose_name_plural = "Factores de Evaluación"

    def __str__(self):
        return f"Eval #{self.evaluation_id} - {self.factor.name} (IR: {self.relative_importance})"
