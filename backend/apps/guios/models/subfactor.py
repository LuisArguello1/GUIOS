from django.db import models
from .factor import Factor


class Subfactor(models.Model):
    """
    Criterio de tercer nivel que el evaluador califica individualmente.
    Texto redactado como afirmación verificable.
    """
    factor = models.ForeignKey(
        Factor,
        on_delete=models.PROTECT,
        related_name='subfactors',
        verbose_name="Factor"
    )
    description = models.TextField(
        verbose_name="Descripción del criterio",
        help_text="Texto redactado como afirmación verificable."
    )
    order = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="Orden dentro del factor"
    )
    is_base = models.BooleanField(
        default=False,
        verbose_name="Pertenece al catálogo base",
        help_text="Pertenece al catálogo base de la tesis."
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Activo",
        help_text="Subfactor activo."
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
        db_table = "guios_subfactor"
        ordering = ["factor__order", "order", "id"]
        verbose_name = "Subfactor"
        verbose_name_plural = "Subfactores"

    def __str__(self):
        return f"{self.factor.name} - {self.description[:60]}"
