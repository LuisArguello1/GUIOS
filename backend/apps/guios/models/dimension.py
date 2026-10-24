from django.db import models


class Dimension(models.Model):
    """
    Agrupador de primer nivel del catálogo GUIOS: Tecnológica, Organizacional, Económica.
    El catálogo base proviene de la tesis doctoral.
    """
    name = models.CharField(
        max_length=150,
        unique=True,
        verbose_name="Nombre de la dimensión"
    )
    description = models.TextField(
        blank=True,
        default="",
        verbose_name="Descripción"
    )
    order = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="Orden de presentación"
    )
    is_base = models.BooleanField(
        default=False,
        verbose_name="Pertenece al catálogo base",
        help_text="Indica si pertenece al catálogo base de la tesis (no eliminable si True)."
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
        db_table = "guios_dimension"
        ordering = ["order", "id"]
        verbose_name = "Dimensión"
        verbose_name_plural = "Dimensiones"

    def __str__(self):
        return self.name
