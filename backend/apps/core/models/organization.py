from django.db import models
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from apps.core.utils.file_validation import validate_image_file_integrity
from apps.core.utils.document_validation import valida_ruc, valida_telefono_ecuador, normalizar_telefono_ecuador


class Organization(models.Model):
    name = models.CharField(max_length=150, verbose_name=_("Nombre del Bar/Negocio"))
    ruc = models.CharField(
        max_length=13, 
        verbose_name=_("RUC"), 
        null=True, 
        blank=True,
        validators=[valida_ruc]
    )
    address = models.TextField(verbose_name=_("Dirección"), null=True, blank=True)
    phone = models.CharField(
        max_length=50, 
        verbose_name=_("Teléfono"), 
        null=True, 
        blank=True,
        validators=[valida_telefono_ecuador]
    )
    email = models.EmailField(verbose_name=_("Correo"), null=True, blank=True)
    logo = models.ImageField(
        upload_to='organization/logos/', 
        null=True, 
        blank=True,
        validators=[validate_image_file_integrity]
    )
    slogan = models.CharField(max_length=255, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Organización")
        verbose_name_plural = _("Organización")

    def __str__(self):
        return self.name

    def clean(self):
        """
        Validación pre-save que Django Admin y los ModelForms respetan.
        No usar save() para esto — ValidationError ahí puede producir HTTP 500 en DRF.
        """
        if not self.pk and Organization.objects.exists():
            raise ValidationError(
                _("Ya existe una organización registrada. Edite la existente.")
            )

    def save(self, *args, **kwargs):
        # ── NORMALIZACIÓN AUTOMÁTICA ──
        if self.phone:
            self.phone = normalizar_telefono_ecuador(self.phone)

        # Llamar clean() explícitamente para que la restricción aplique
        # también fuera del ciclo de formularios (ej: código de consola).
        self.full_clean()
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        return cls.objects.first()