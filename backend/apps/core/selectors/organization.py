import logging
from django.db import transaction
from ..models.organization import Organization

logger = logging.getLogger(__name__)


def get_organization_with_preferences():
    """
    Obtiene la instancia única de organización.
    Si no existe (instalación inicial), crea un placeholder vacío.
    """
    organization = Organization.objects.first()

    if organization:
        return organization

    # Primera ejecución: crear todo en una transacción
    logger.info("No existe organización. Creando instancia inicial.")
    with transaction.atomic():
        organization = Organization.objects.create(
            name="Mi Organización",  # Placeholder neutral, sin RUC real
        )

    return organization
