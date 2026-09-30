from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Q

from .models.audit import AuditLog
from .models.user import CustomUser
from .models.otp import PasswordResetOTP
from .models.totp import TOTPDevice


# ---------------------------------------------------------------------------
# CustomUser Admin
# ---------------------------------------------------------------------------

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """
    Admin completo para CustomUser.
    Extiende UserAdmin para mantener el manejo seguro de contraseñas
    (hashing, formularios de cambio, etc.) que Django trae por defecto.
    """

    # Columnas visibles en el listado
    list_display = (
        'email',
        'username',
        'full_name',
        'phone',
        'user_roles',
        'is_active',
        'is_staff',
        'is_superuser',
        'created_at',
        'audit_link',
    )

    # Filtros del panel lateral derecho
    list_filter = (
        'is_active',
        'is_staff',
        'is_superuser',
        'groups',
        'created_at',
    )

    # Campos por los que se puede buscar
    search_fields = ('email', 'username', 'first_name', 'last_name', 'phone')

    # Campos de solo lectura (generados automáticamente)
    readonly_fields = ('created_at', 'updated_at', 'last_login', 'avatar_preview')

    # Orden por defecto
    ordering = ('-created_at',)

    # Habilitar acción de activar/desactivar en masa
    actions = ['activate_users', 'deactivate_users']

    # ---------------------------------------------------------------------------
    # Fieldsets: organización del formulario de edición
    # ---------------------------------------------------------------------------
    fieldsets = (
        (None, {
            'fields': ('email', 'password'),
        }),
        (_('Información personal'), {
            'fields': (
                'first_name',
                'last_name',
                'username',
                'phone',
                'avatar',
                'avatar_preview',
            ),
        }),
        (_('Roles y Acceso'), {
            'fields': (
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions',
            ),
            'classes': ('collapse',),
        }),
        (_('Fechas importantes'), {
            'fields': ('last_login', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    # Fieldsets para el formulario de CREACIÓN de usuario
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email',
                'username',
                'first_name',
                'last_name',
                'phone',
                'password1',
                'password2',
                'is_active',
                'is_staff',
                'groups',
            ),
        }),
    )

    @admin.display(description=_('Nombre completo'))
    def full_name(self, obj):
        name = obj.get_full_name()
        return name if name else '—'

    @admin.display(description=_('Roles'))
    def user_roles(self, obj):
        roles = list(obj.groups.values_list('name', flat=True))
        if not roles:
            return format_html('<em style="color:#999;">Sin roles</em>')
        badges = ''.join(
            f'<span style="background:#e8f0fe;color:#1a56db;padding:2px 8px;'
            f'border-radius:10px;font-size:11px;margin-right:3px;">{r}</span>'
            for r in roles
        )
        return format_html(badges)

    @admin.display(description=_('Vista previa avatar'))
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html(
                '<img src="{}" style="width:60px;height:60px;object-fit:cover;'
                'border-radius:50%;border:2px solid #e0e0e0;" />',
                obj.avatar.url,
            )
        return '—'

    @admin.display(description=_('Auditoría'))
    def audit_link(self, obj):
        url = (
            reverse('admin:authentication_auditlog_changelist')
            + f'?user__id__exact={obj.pk}'
        )
        return format_html('<a href="{}">Ver logs</a>', url)

    @admin.action(description=_('Activar usuarios seleccionados'))
    def activate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, _(f'{updated} usuario(s) activado(s) correctamente.'))

    @admin.action(description=_('Desactivar usuarios seleccionados'))
    def deactivate_users(self, request, queryset):
        queryset = queryset.exclude(pk=request.user.pk)
        updated = queryset.update(is_active=False)
        self.message_user(request, _(f'{updated} usuario(s) desactivado(s) correctamente.'))


# ---------------------------------------------------------------------------
# AuditLog Admin
# ---------------------------------------------------------------------------

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """
    Admin para AuditLog con soporte profesional para ContentTypes y Diffs.
    """

    list_display = (
        'timestamp',
        'action_badge',
        'source_badge',
        'content_type',
        'object_id',
        'user_link',
        'changes_summary',
    )

    list_filter = (
        'action',
        'source',
        'content_type',
        'timestamp',
    )

    search_fields = (
        'object_id',
        'user__email',
        'request_id',
        'ip_address',
    )

    ordering = ('-timestamp',)
    list_per_page = 50

    readonly_fields = (
        'action',
        'source',
        'content_type',
        'object_id',
        'user',
        'impersonated_by',
        'before',
        'after',
        'changed_fields',
        'deleted_snapshot',
        'ip_address',
        'user_agent',
        'request_id',
        'batch_id',
        'checksum',
        'timestamp',
        'formatted_diff',
    )

    fieldsets = (
        (_('Evento y Origen'), {
            'fields': ('timestamp', 'action', 'source', 'request_id', 'ip_address'),
        }),
        (_('Objeto Afectado'), {
            'fields': ('content_type', 'object_id', 'batch_id'),
        }),
        (_('Responsable'), {
            'fields': ('user', 'impersonated_by', 'session_key'),
        }),
        (_('Detalle de Cambios'), {
            'fields': ('changed_fields', 'formatted_diff'),
        }),
        (_('Seguridad e Integridad'), {
            'fields': ('checksum',),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.display(description=_('Acción'))
    def action_badge(self, obj):
        colors = {
            'CREATE': ('#e6f4ea', '#2d7a47', '✚'),
            'UPDATE': ('#e8f0fe', '#1a56db', '✎'),
            'DELETE': ('#fce8e8', '#c53030', '✖'),
            'RESTORE': ('#d1fae5', '#059669', '⟲'),
            'EXPORT': ('#f3e8ff', '#7e22ce', '⤓'),
        }
        bg, color, icon = colors.get(obj.action, ('#f5f5f5', '#555', '?'))
        return format_html(
            '<span style="background:{};color:{};padding:2px 10px;border-radius:12px;'
            'font-size:12px;font-weight:600;">{} {}</span>',
            bg, color, icon, obj.get_action_display(),
        )

    @admin.display(description=_('Origen'))
    def source_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-size:10px;color:#666;border:1px solid #ddd;'
            'padding:1px 4px;border-radius:4px;text-transform:uppercase;">{}</span>',
            obj.source
        )

    @admin.display(description=_('Usuario'), ordering='user__email')
    def user_link(self, obj):
        if obj.user:
            url = reverse('admin:authentication_customuser_change', args=[obj.user.pk])
            return format_html('<a href="{}">{}</a>', url, obj.user.email)
        return format_html('<em style="color:#999;">{}</em>', _('Sistema'))

    @admin.display(description=_('Resumen de cambios'))
    def changes_summary(self, obj):
        if not obj.changed_fields:
            if obj.action == 'CREATE': return _('Creación inicial')
            if obj.action == 'DELETE': return _('Eliminación')
            return '—'
        return ', '.join(obj.changed_fields[:5]) + ('...' if len(obj.changed_fields) > 5 else '')

    @admin.display(description=_('Comparativa de Cambios'))
    def formatted_diff(self, obj):
        if obj.action == 'CREATE':
            data = obj.after
        elif obj.action == 'DELETE':
            data = obj.before or obj.deleted_snapshot
        else:
            data = {}
            for field in obj.changed_fields:
                data[field] = {
                    'antes': obj.before.get(field) if obj.before else None,
                    'después': obj.after.get(field) if obj.after else None
                }
        
        if not data:
            return '—'
            
        import json
        formatted_json = json.dumps(data, indent=2, ensure_ascii=False)
        return format_html(
            '<pre style="background:#f8f9fa;padding:15px;border:1px solid #e9ecef;'
            'border-radius:4px;font-size:12px;max-height:400px;overflow:auto;">{}</pre>',
            formatted_json
        )


# ---------------------------------------------------------------------------
# PasswordResetOTP Admin
# ---------------------------------------------------------------------------

@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    """
    Admin para PasswordResetOTP.
    Muestra los códigos de restablecimiento de contraseña de un solo uso generados.
    """
    list_display = (
        'user_link',
        'code',
        'is_used',
        'is_verified',
        'is_expired_status',
        'created_at',
    )
    list_filter = (
        'is_used',
        'is_verified',
        'created_at',
    )
    search_fields = (
        'user__email',
        'user__username',
        'code',
    )
    readonly_fields = (
        'user',
        'code',
        'is_used',
        'is_verified',
        'created_at',
    )
    ordering = ('-created_at',)
    list_per_page = 50

    @admin.display(description=_('Usuario'), ordering='user__email')
    def user_link(self, obj):
        url = reverse('admin:authentication_customuser_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description=_('Expirado'), boolean=True)
    def is_expired_status(self, obj):
        return obj.is_expired


# ---------------------------------------------------------------------------
# TOTPDevice Admin
# ---------------------------------------------------------------------------

@admin.register(TOTPDevice)
class TOTPDeviceAdmin(admin.ModelAdmin):
    """
    Admin para TOTPDevice.
    Permite auditar el estado de la autenticación de dos factores (2FA).
    """
    list_display = (
        'user_link',
        'is_active',
        'recovery_codes_count',
        'created_at',
        'updated_at',
    )
    list_filter = (
        'is_active',
        'created_at',
        'updated_at',
    )
    search_fields = (
        'user__email',
        'user__username',
    )
    readonly_fields = (
        'user',
        'secret',
        'last_verified_counter',
        'recovery_codes_count',
        'created_at',
        'updated_at',
    )
    ordering = ('-created_at',)
    list_per_page = 50

    @admin.display(description=_('Usuario'), ordering='user__email')
    def user_link(self, obj):
        url = reverse('admin:authentication_customuser_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description=_('Códigos de recuperación restantes'))
    def recovery_codes_count(self, obj):
        count = len(obj.recovery_codes) if obj.recovery_codes else 0
        return f"{count} código(s)"
