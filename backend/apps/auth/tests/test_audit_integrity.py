from django.contrib.contenttypes.models import ContentType
from django.test import TestCase

from apps.auth.models.audit import AuditLog
from apps.auth.models.user import CustomUser


class AuditLogIntegrityTests(TestCase):
    """RF-ADM-38 / RN-11: el checksum debe verificarse con la hora guardada."""

    def test_new_log_verifies_after_reload(self):
        log = AuditLog.objects.create(
            action='CREATE',
            content_type=ContentType.objects.get_for_model(CustomUser),
            object_id='1',
            after={'email': 'a@b.ec', 'texto': 'Ñandú & Cía.'},
        )
        self.assertTrue(log.verify_integrity())
        log.refresh_from_db()
        self.assertTrue(log.verify_integrity())

    def test_signal_log_verifies(self):
        user = CustomUser.objects.create_user(email='integridad@unemi.edu.ec', password='Clave-segura-123')
        log = AuditLog.objects.filter(object_id=str(user.pk)).latest('pk')
        self.assertTrue(AuditLog.objects.get(pk=log.pk).verify_integrity())

    def test_tampering_is_detected(self):
        log = AuditLog.objects.create(action='UPDATE', object_id='7', after={'name': 'original'})
        AuditLog.objects.filter(pk=log.pk).update(after={'name': 'alterado'})
        log.refresh_from_db()
        self.assertFalse(log.verify_integrity())
