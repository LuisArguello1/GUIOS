"""
apps/guios/api/views/security_utils.py
─────────────────────────────────────────────────────────────────────────────
Utilidades de seguridad, privacidad y auditoría para controladores REST GUIOS.
"""

import hashlib
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response


def require_ai_consent_response(evaluation):
    """
    Verifica que la evaluación tenga habilitada la asistencia por IA y cuente
    con consentimiento explícito de procesamiento (D-13). Retorna HTTP 403 si
    no se cumplen ambas condiciones, o None cuando la solicitud es válida.
    """
    if not evaluation.ai_enabled or not evaluation.ai_processing_consent:
        return Response(
            {
                'error': (
                    'La asistencia de IA no está habilitada o no cuenta con '
                    'consentimiento de procesamiento para esta evaluación.'
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


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

