from django.db import transaction
from ..models.organization import Organization

@transaction.atomic
def update_organization_data(organization, **data):
    """
    Actualiza la información comercial básica (nombre, RUC, logo, etc.)
    de la instancia única de organización.
    """
    for field, value in data.items():
        setattr(organization, field, value)
    organization.save()
    return organization
