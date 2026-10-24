import logging
from django.db.models.signals import post_save, post_delete, pre_save
from django.apps import apps
from django.contrib.contenttypes.models import ContentType
from .models.audit import AuditLog
from .middleware.audit import get_audit_context

logger = logging.getLogger(__name__)

# Modelos que no deben generar registros de auditoría para evitar recursión
IGNORED_MODELS = frozenset([
    'AuditLog',
    'Session',
    'LogEntry',
    'Permission',
    'ContentType',
    'TokenBlacklist',
    'OutstandingToken',
    'BlacklistedToken',
    # Modelos de evaluación de GUIOS: el guardado automático llenaría la auditoría.
    # El dictamen se registra explícitamente (RF-ADM-37); el catálogo sí se audita.
    'Evaluation',
    'EvaluationFactor',
    'EvaluationSubfactor',
    'EvaluationResult',
    'EvaluationVerdict',
    'AIAssistanceLog',
])


def _serialize_instance(instance):
    """Serializa una instancia de modelo a dict de forma segura."""
    data = {}
    if not instance:
        return data
        
    for key, value in instance.__dict__.items():
        if key.startswith('_'):
            continue
        try:
            if isinstance(value, (str, int, float, bool, type(None))):
                data[key] = value
            else:
                data[key] = str(value)
        except Exception:
            data[key] = '<error al serializar>'
    return data


def audit_pre_save(sender, instance, **kwargs):
    """Captura el estado anterior del objeto antes de guardarlo."""
    if sender.__name__ in IGNORED_MODELS:
        return

    if instance.pk:
        try:
            # Obtener la versión actual de la base de datos (antes del cambio)
            old_instance = sender.objects.get(pk=instance.pk)
            instance._audit_before = _serialize_instance(old_instance)
        except sender.DoesNotExist:
            instance._audit_before = None
    else:
        instance._audit_before = None


def audit_post_save(sender, instance, created, **kwargs):
    """Registra la creación o modificación de un objeto con diff detallado."""
    if sender.__name__ in IGNORED_MODELS:
        return

    ctx = get_audit_context()
    action = 'CREATE' if created else 'UPDATE'
    
    after_state = _serialize_instance(instance)
    before_state = getattr(instance, '_audit_before', None)
    
    # Calcular campos modificados si es edición
    changed_fields = []
    if action == 'UPDATE' and before_state:
        for key, val in after_state.items():
            if before_state.get(key) != val:
                changed_fields.append(key)
        
        # Si no hubo cambios reales, no registramos nada (opcional)
        if not changed_fields:
            return

    try:
        content_type = ContentType.objects.get_for_model(sender)
        AuditLog.objects.create(
            action=action,
            source='signal',
            content_type=content_type,
            object_id=str(instance.pk),
            user=ctx['user'],
            ip_address=ctx['ip_address'],
            user_agent=ctx['user_agent'],
            session_key=ctx['session_key'],
            request_id=ctx['request_id'],
            before=before_state,
            after=after_state,
            changed_fields=changed_fields
        )
    except Exception as e:
        logger.error("AuditLog Post-Save error for %s: %s", sender.__name__, e)


def audit_post_delete(sender, instance, **kwargs):
    """Registra la eliminación de un objeto con snapshot completo."""
    if sender.__name__ in IGNORED_MODELS:
        return

    ctx = get_audit_context()
    snapshot = _serialize_instance(instance)

    try:
        content_type = ContentType.objects.get_for_model(sender)
        AuditLog.objects.create(
            action='DELETE',
            source='signal',
            content_type=content_type,
            object_id=str(instance.pk),
            user=ctx['user'],
            ip_address=ctx['ip_address'],
            user_agent=ctx['user_agent'],
            session_key=ctx['session_key'],
            request_id=ctx['request_id'],
            before=snapshot,
            after=None,
            deleted_snapshot=snapshot
        )
    except Exception as e:
        logger.error("AuditLog Post-Delete error for %s: %s", sender.__name__, e)


def register_audit_signals():
    """Registra las señales de auditoría para todos los modelos."""
    for model in apps.get_models():
        if model.__name__ not in IGNORED_MODELS:
            pre_save.connect(audit_pre_save, sender=model, weak=False)
            post_save.connect(audit_post_save, sender=model, weak=False)
            post_delete.connect(audit_post_delete, sender=model, weak=False)

