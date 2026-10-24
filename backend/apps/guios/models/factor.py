from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from .dimension import Dimension


class Factor(models.Model):
    """
    Criterio de evaluación de segundo nivel.
    Cada factor tiene una Importancia Sugerida (IS) definida por la metodología (Tabla 5.3).
    """
    SCOPE_INTERNAL = 'internal'
    SCOPE_EXTERNAL = 'external'
    SCOPE_BOTH = 'both'

    SCOPE_CHOICES = (
        (SCOPE_INTERNAL, 'Interno'),
        (SCOPE_EXTERNAL, 'Externo'),
        (SCOPE_BOTH, 'Ambos'),
    )

    code = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        verbose_name="Código",
        help_text="Clave estable del catálogo base (docs/catalogo_guios.json, p. ej. ORG-SOP). Nulo en registros creados desde la interfaz."
    )
    dimension = models.ForeignKey(
        Dimension,
        on_delete=models.PROTECT,
        related_name='factors',
        verbose_name="Dimensión"
    )
    name = models.CharField(
        max_length=200,
        verbose_name="Nombre del factor"
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción",
        help_text="Descripción del factor (Tabla 5.1 de la tesis)."
    )
    suggested_importance = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia Sugerida / Sistémica (IS)",
        help_text="Valor fijo definido por la metodología (1: Irrelevante, 2: Opcional, 3: Importante, 4: Fundamental) o cruzando (IL_base x IE)."
    )
    expert_importance = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia del Experto (IE)",
        help_text="Importancia del Experto (IE: 1 a 4) obtenida de encuestas empíricas."
    )
    literature_importance_base = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        verbose_name="Importancia de la Literatura Base (IL)",
        help_text="Importancia de la Literatura base (IL: 1 a 4) calculada por cuartiles en el catálogo."
    )

    @property
    def systemic_importance(self) -> int:
        return self.suggested_importance

    @systemic_importance.setter
    def systemic_importance(self, value: int):
        self.suggested_importance = value

    scope = models.CharField(
        max_length=10,
        choices=SCOPE_CHOICES,
        default=SCOPE_INTERNAL,
        verbose_name="Ámbito FODA predeterminado"
    )
    scope_configurable = models.BooleanField(
        default=False,
        verbose_name="Ámbito configurable por el decisor",
        help_text="True únicamente para el factor 'Soporte' (RF-PUB-02, RN-06)."
    )
    order = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="Orden dentro de la dimensión"
    )
    is_base = models.BooleanField(
        default=False,
        verbose_name="Pertenece al catálogo base",
        help_text="Pertenece al catálogo base de la tesis. No eliminable si True."
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Activo",
        help_text="Factor activo. Inactivo = no aparece en nuevas evaluaciones."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Fecha de modificación"
    )

    class Meta:
        db_table = "guios_factor"
        ordering = ["dimension__order", "order", "id"]
        verbose_name = "Factor"
        verbose_name_plural = "Factores"

    def __str__(self):
        return f"{self.dimension.name} - {self.name}"
