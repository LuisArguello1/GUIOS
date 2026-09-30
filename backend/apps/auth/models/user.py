from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.utils.file_validation import validate_image_file_integrity
from apps.core.utils.document_validation import valida_telefono_ecuador, normalizar_telefono_ecuador


class CustomUserManager(BaseUserManager):
    """
    Manager personalizado donde el email es el identificador único,
    en lugar del username de Django por defecto.
    """

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('El email es obligatorio'))
        email = self.normalize_email(email)
        # Generar un username único a partir del email si no se proporciona,
        # ya que AbstractUser lo requiere a nivel de base de datos.
        extra_fields.setdefault('username', email.split('@')[0])
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser debe tener is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser debe tener is_superuser=True.'))

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    """
    Modelo de usuario que usa el email para autenticación.
    El campo username se mantiene por compatibilidad con AbstractUser
    pero no se usa como identificador.
    """

    email = models.EmailField(_('email address'), unique=True)

    # username heredado de AbstractUser; se hace opcional en formularios
    # pero Django lo sigue requiriendo a nivel DB — se auto-genera en el manager.
    username = models.CharField(
        _('username'),
        max_length=150,
        unique=True,
        blank=True,  # No requerido en formularios/API
        help_text=_('Se genera automáticamente si no se proporciona.'),
    )

    phone = models.CharField(
        _('teléfono'), 
        max_length=20, 
        blank=True, 
        null=True,
        validators=[valida_telefono_ecuador]
    )
    avatar = models.ImageField(
        _('imagen de usuario'),
        upload_to='users/avatars/',
        blank=True,
        null=True,
        validators=[validate_image_file_integrity],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    class Meta:
        verbose_name = _('usuario')
        verbose_name_plural = _('usuarios')
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    @property
    def permissions(self) -> list[str]:
        """
        Retorna una lista de codenames de permisos granulares (RBAC) 
        asociados a los grupos del usuario.
        """
        if self.is_superuser:
            return ['*']
        
        # Obtenemos los codenames únicos de ModulePermission a través de los grupos
        return list(
            self.groups.values_list('module_permissions__codename', flat=True)
            .exclude(module_permissions__codename__isnull=True)
            .distinct()
        )

    def save(self, *args, **kwargs):
        # ── NORMALIZACIÓN AUTOMÁTICA ──
        if self.phone:
            self.phone = normalizar_telefono_ecuador(self.phone)

        # Garantizar que username nunca quede vacío en la DB
        if not self.username:
            base = self.email.split('@')[0]
            self.username = base
            # Si ya existe ese username, agregar el id para garantizar unicidad
            if CustomUser.objects.filter(username=self.username).exclude(pk=self.pk).exists():
                self.username = f"{base}_{self.pk or 'new'}"
        super().save(*args, **kwargs)