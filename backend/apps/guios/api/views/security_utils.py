"""
apps/guios/api/views/security_utils.py
─────────────────────────────────────────────────────────────────────────────
Utilidades de seguridad, privacidad y auditoría para controladores REST GUIOS.
"""

import hashlib
from django.conf import settings


def get_client_ip_hash(request) -> str:
    """
    Calcula un hash SHA-256 anonimizado de la dirección IP del cliente con salt.
    Permite auditoría de no repudio del consentimiento sin almacenar direcciones
    IP en texto plano (cumplimiento GDPR / Habeas Data).
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '')

    salt = getattr(settings, 'SECRET_KEY', 'guios_audit_salt')
    return hashlib.sha256(f"{ip}:{salt}".encode('utf-8')).hexdigest()

