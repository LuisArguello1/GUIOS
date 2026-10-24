from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from .evaluation import Evaluation
from .factor import Factor


class EvaluationFactor(models.Model):
    """
    Configuración asignada por el evaluador a cada factor en el Paso 1-2.
    Incluye snapshot del IS para proteger el historial si el catálogo cambia (RN-08).
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
    systemic_importance_snapshot = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Snapshot de Importancia Sistémica (IS)",
        help_text="Importancia Sugerida (IS) calculada cruzando (IL x IE) para este software (RN-08)."
    )
    subfactors_count_snapshot = models.PositiveSmallIntegerField(
        default=1,
        verbose_name="Conteo de subfactores (NS o n)",
        help_text="Número de subfactores activos del factor (NS o n) al momento de evaluar."
    )
    citations_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Citas detectadas por IA (TC o c_i)",
        help_text="Total de citas/evidencias encontradas por la IA para este software."
    )
    citation_ratio = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        default=0.0000,
        verbose_name="Razón r_i = TC / NS",
        help_text="Razón r_i = TC / NS (Ecuación 5.1 de la tesis)."
    )
    literature_importance_calculated = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia de la Literatura calculada (IL)",
        help_text="Importancia de la Literatura (IL: 1 a 4) según el cuartil de r_i (Ecuación 5.2)."
    )
    expert_importance_snapshot = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Snapshot Importancia del Experto (IE)",
        help_text="Copia inmutable de la Importancia del Experto (IE: 1 a 4)."
    )
    ai_literature_sources = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Fuentes encontradas por IA",
        help_text="Lista de fuentes/citas académicas encontradas por la IA [{title, url, snippet, subfactor_id}]."
    )
    decisor_importance = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia del Decisor (ID)",
        help_text="Valoración asignada por la organización evaluadora (1 a 4 en Paso 1)."
    )
    relative_importance = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia Relativa (IR)",
        help_text="Calculada por el motor cruzando IS x ID en la Matriz de la Fig. 5.10."
    )
    is_relevant = models.BooleanField(
        null=True,
        blank=True,
        verbose_name="Es relevante",
        help_text="True si IR > Irrelevante (1). Determina si pasa al Paso 3-4 (RN-01)."
    )
    scope_used = models.CharField(
        max_length=10,
        choices=SCOPE_CHOICES,
        default=SCOPE_INTERNAL,
        blank=True,
        verbose_name="Ámbito FODA efectivo",
        help_text="Interno o Externo. Configurable por el usuario solo para 'Soporte'."
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
