from typing import Optional
from django.contrib.auth import get_user_model
from ..models.totp import TOTPDevice

User = get_user_model()


def get_totp_device_by_user(user) -> Optional[TOTPDevice]:
    """
    Obtiene el dispositivo TOTP de un usuario.
    """
    return TOTPDevice.objects.filter(user=user).first()


def get_totp_device_for_update(user) -> Optional[TOTPDevice]:
    """
    Obtiene el dispositivo TOTP de un usuario bloqueándolo para actualización.
    """
    return TOTPDevice.objects.select_for_update().filter(user=user).first()


def get_active_totp_device_for_update(user) -> Optional[TOTPDevice]:
    """
    Obtiene el dispositivo TOTP activo de un usuario bloqueándolo para actualización.
    """
    return TOTPDevice.objects.select_for_update().filter(user=user, is_active=True).first()
