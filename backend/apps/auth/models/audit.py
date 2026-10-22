import hashlib
import json
import uuid

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('CREATE', _('Crear')),
        ('UPDATE', _('Editar')),
        ('DELETE', _('Eliminar')),
        ('RESTORE', _('Restaurar')),   # ← nuevo: para soft-deletes
        ('EXPORT', _('Exportar')),     # ← nuevo: para auditoría de acceso
    ]

    SOURCE_CHOICES = [
        ('web',    _('Web')),
        ('api',    _('API')),
        ('admin',  _('Admin Django')),
        ('cli',    _('Management command')),
        ('signal', _('Signal automático')),
        ('import', _('Importación masiva')),
    ]

    # ── Qué ocurrió ──────────────────────────────────────────────
    action     = models.CharField(_('acción'), max_length=10, choices=ACTION_CHOICES, db_index=True)
    source     = models.CharField(_('origen'), max_length=20, choices=SOURCE_CHOICES, default='web')
    reason     = models.TextField(_('motivo'), blank=True)          # ej: "Ticket #4521"

    # ── Sobre qué objeto ─────────────────────────────────────────
    # Usamos ContentType en lugar de model_name: es más robusto y
    # evita colisiones si dos apps tienen modelos con el mismo nombre.
    content_type  = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True)
    object_id     = models.CharField(_('ID objeto'), max_length=255, db_index=True)
    content_object = GenericForeignKey('content_type', 'object_id')  # acceso directo al objeto

    # ── Quién lo hizo ────────────────────────────────────────────
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name=_('usuario'),
        related_name='audit_logs',
    )
    # Cuando un admin actúa en nombre de otro usuario (impersonation)
    impersonated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='impersonation_audit_logs',
        verbose_name=_('actuó como'),
    )

    # ── Los cambios ──────────────────────────────────────────────
    # Estructura fija: before/after en vez de un JSONField libre.
    before          = models.JSONField(_('antes'), null=True, blank=True)
    after           = models.JSONField(_('después'), null=True, blank=True)
    changed_fields  = models.JSONField(_('campos modificados'), default=list)
    # Snapshot completo del objeto al momento del DELETE
    deleted_snapshot = models.JSONField(_('snapshot al eliminar'), null=True, blank=True)

    # ── Contexto de la solicitud ─────────────────────────────────
    ip_address  = models.GenericIPAddressField(_('IP'), null=True, blank=True)
    user_agent  = models.TextField(_('user agent'), blank=True)
    session_key = models.CharField(_('sesión'), max_length=40, blank=True)
    # UUID que agrupa todos los logs de una misma request HTTP
    request_id  = models.UUIDField(_('ID de request'), null=True, blank=True, db_index=True)
    # Para agrupar logs de una operación masiva (ej: importación CSV)
    batch_id    = models.UUIDField(_('ID de lote'), null=True, blank=True, db_index=True)
    # Campo libre para datos extra sin romper el esquema
    extra       = models.JSONField(_('extra'), default=dict, blank=True)

    # ── Integridad ───────────────────────────────────────────────
    # SHA-256 del contenido del registro; permite detectar si alguien
    # alteró la tabla directamente en la base de datos.
    checksum    = models.CharField(_('checksum'), max_length=64, blank=True)

    # ── Cuándo ───────────────────────────────────────────────────
    # default (no auto_now_add): auto_now_add pisaría al insertar la hora usada en el checksum.
    timestamp   = models.DateTimeField(_('fecha y hora'), default=timezone.now, editable=False, db_index=True)

    class Meta:
        verbose_name        = _('registro de auditoría')
        verbose_name_plural = _('registros de auditoría')
        ordering            = ['-timestamp']
        indexes = [
            models.Index(fields=['content_type', 'object_id'], name='audit_ct_object_idx'),
            models.Index(fields=['user', 'timestamp'],          name='audit_user_ts_idx'),
            models.Index(fields=['batch_id'],                   name='audit_batch_idx'),
            models.Index(fields=['request_id'],                 name='audit_request_idx'),
            models.Index(fields=['action', 'timestamp'],        name='audit_action_ts_idx'),
        ]

    # ── Helpers ──────────────────────────────────────────────────

    def compute_checksum(self) -> str:
        """SHA-256 sobre los campos críticos del registro."""
        payload = json.dumps({
            'action':    self.action,
            'object_id': self.object_id,
            'user_id':   self.user_id,
            'before':    self.before,
            'after':     self.after,
            'timestamp': str(self.timestamp),
        }, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(payload.encode()).hexdigest()

    def verify_integrity(self) -> bool:
        """Devuelve True si el registro no fue alterado desde su creación."""
        return self.checksum == self.compute_checksum()

    @property
    def model_name(self) -> str:
        """Compatibilidad con código que usaba el campo model_name anterior."""
        return self.content_type.model if self.content_type else ''

    def save(self, *args, **kwargs):
        # El checksum se calcula sólo en la creación, con la misma hora que se
        # guarda en timestamp (default=timezone.now, asignado al instanciar).
        if not self.pk and not self.checksum:
            self.timestamp = self.timestamp or timezone.now()
            self.checksum = self.compute_checksum()
        super().save(*args, **kwargs)

    def __str__(self):
        user_repr = str(self.user_id or 'anónimo')
        return f"{self.action} · {self.model_name}({self.object_id}) · {user_repr}"