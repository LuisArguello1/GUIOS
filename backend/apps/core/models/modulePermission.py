from django.db import models
from django.utils.translation import gettext_lazy as _
from .menuModule import MenuModule


class ModulePermission(models.Model):
    """
    Permiso granular con ámbito de módulo.

    Cada módulo del menú posee un conjunto de acciones semánticas.
    Los Roles (auth.Group) se asignan a un subconjunto de estas acciones.

    Formato del codename: '{modulo}.{accion}'
    Ejemplos:
        catalog.create_factor
        evaluations.export
    """
    module = models.ForeignKey(
        MenuModule,
        on_delete=models.CASCADE,
        related_name='permissions',
        verbose_name=_('Módulo'),
    )
    codename = models.CharField(
        max_length=120,
        unique=True,
        verbose_name=_('Codename'),
        help_text=_("Identificador único. Formato: 'modulo.accion'. Ej: catalog.create_factor"),
    )
    label = models.CharField(
        max_length=150,
        verbose_name=_('Etiqueta'),
        help_text=_('Nombre legible para mostrar en UI. Ej: Crear factores'),
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Descripción'),
        help_text=_('Explicación de qué permite hacer este permiso.'),
    )
    order = models.PositiveSmallIntegerField(
        default=0,
        verbose_name=_('Orden'),
    )

    # Relación N:M con roles (Groups de Django)
    groups = models.ManyToManyField(
        'auth.Group',
        blank=True,
        related_name='module_permissions',
        verbose_name=_('Roles con este permiso'),
    )

    class Meta:
        verbose_name = _('Permiso de Módulo')
        verbose_name_plural = _('Permisos de Módulos')
        ordering = ['module__group__order', 'module__order', 'order']
        indexes = [
            models.Index(fields=['codename'], name='modperm_codename_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.codename} — {self.label}"
