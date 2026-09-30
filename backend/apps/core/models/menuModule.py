from django.db import models
from django.utils.translation import gettext_lazy as _
from .menuGroup import MenuGroup

class MenuModule(models.Model):
    """
    Representa un botón individual dentro de una categoría del menú.
    Este modelo define a qué grupos (Roles) se le muestra el botón.
    """
    group = models.ForeignKey(MenuGroup, on_delete=models.CASCADE, related_name='modules', verbose_name=_('Categoría Padre'))
    label = models.CharField(max_length=100, verbose_name=_('Etiqueta (Botón)'))
    icon = models.CharField(max_length=50, verbose_name=_('Nombre del Ícono (React)'))
    path = models.CharField(max_length=255, verbose_name=_('Ruta Relativa (/dashboard/...)'))
    order = models.PositiveIntegerField(default=0, verbose_name=_('Orden de Aparición'))
    is_active = models.BooleanField(default=True, verbose_name=_('Visible / Activo'))
    
    # RELACIÓN N:M con los Grupos (Roles de la aplicación)
    roles = models.ManyToManyField('auth.Group', blank=True, related_name='menu_modules', verbose_name=_('Roles con Acceso'))

    class Meta:
        verbose_name = _('Módulo del Menú')
        verbose_name_plural = _('Módulos de Menús')
        ordering = ['group__order', 'order']
        indexes = [
            models.Index(fields=['group', 'order'], name='menumodule_group_order_idx'),
        ]

    def __str__(self):
        return f"[{self.group.name}] {self.label}"