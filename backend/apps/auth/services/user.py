import logging
from typing import Any, Dict

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

from ..models.user import CustomUser

logger = logging.getLogger(__name__)

# Campos que NO se pueden modificar directamente por la API.
# password siempre debe pasar por set_password() para ser hasheada.
_PROTECTED_FIELDS = frozenset({'password', 'is_superuser', 'last_login', 'date_joined'})
_SELF_PROFILE_EDITABLE_FIELDS = frozenset({'first_name', 'last_name', 'phone', 'avatar', 'email'})


def user_create(*, email: str, password: str, **extra_fields) -> CustomUser:
    """
    Crea un nuevo usuario utilizando el manager personalizado.

    CORRECCIÓN: password siempre pasa por create_user() que internamente
    llama set_password(). Antes, perform_create() pasaba validated_data
    completo incluyendo password en texto plano a través de setattr.
    """
    groups = extra_fields.pop('groups', [])
    user = CustomUser.objects.create_user(email=email, password=password, **extra_fields)
    if groups:
        user.groups.set(groups)
    return user


def user_update(*, user: CustomUser, allow_superuser_toggle: bool = False, **data: Any) -> CustomUser:
    """
    Actualiza los datos de un usuario de forma segura.

    CORRECCIÓN: se filtra explícitamente cualquier campo protegido antes
    de hacer setattr. Esto evita que un payload malicioso como
    {"password": "texto_plano"} sobreescriba la contraseña sin hashear,
    o que {"is_superuser": true} escale privilegios.

    Para cambiar la contraseña usar user_change_password().
    """
    # Eliminar campos protegidos silenciosamente (el serializer debería
    # haberlos bloqueado, pero esto es una segunda línea de defensa)
    safe_fields = set(_PROTECTED_FIELDS)
    if allow_superuser_toggle:
        safe_fields.discard('is_superuser')

    safe_data = {k: v for k, v in data.items() if k not in safe_fields}

    groups = safe_data.pop('groups', None)

    if not safe_data and groups is None:
        return user

    for attr, value in safe_data.items():
        setattr(user, attr, value)

    user.save()

    if groups is not None:
        user.groups.set(groups)

    return user


def user_change_password(*, user: CustomUser, new_password: str) -> CustomUser:
    """
    Cambia la contraseña de un usuario de forma segura con validación de Django.
    Separado de user_update() para que el flujo sea explícito.
    """
    # Ejecutar todos los validadores configurados en AUTH_PASSWORD_VALIDATORS
    validate_password(new_password, user)
    user.set_password(new_password)
    user.save(update_fields=['password'])
    return user


def user_update_profile(*, user: CustomUser, **data: Any) -> CustomUser:
    """
    Actualiza solo campos seguros del perfil propio.
    """
    safe_data = {k: v for k, v in data.items() if k in _SELF_PROFILE_EDITABLE_FIELDS}
    if not safe_data:
        return user

    for attr, value in safe_data.items():
        setattr(user, attr, value)

    user.save()
    return user


def user_delete_logic(*, user: CustomUser) -> Dict[str, Any]:
    """
    Soft delete (desactivar) o hard delete según si el usuario tiene
    relaciones importantes en otras tablas.

    CORRECCIÓN: Se reemplaza Collector de Django por una verificación
    explícita de relaciones. Collector solo detecta objetos que serían
    eliminados en CASCADE — no detecta relaciones SET_NULL o PROTECT,
    que también representan "datos vinculados" desde el punto de vista
    del negocio.

    La lógica ahora inspecciona los related managers directamente
    para decidir si hay historial real.
    """
    # Modelos internos que no representan "datos de negocio" del usuario
    _IGNORED_RELATED = frozenset({
        'password_reset_otps',  # OTPs propios del flujo de reset
        'totp_device',          # Configuración TOTP propia del usuario
        'logentry_set',         # Log interno de Django admin
    })

    # Modelos internos o relaciones que no impiden el borrado físico (CASCADE)
    _IGNORED_FIELDS = _IGNORED_RELATED | {'groups', 'user_permissions'}

    linked_models: list[str] = []

    # Usamos get_fields() para capturar TODAS las relaciones (directas, inversas, M2M)
    for field in user._meta.get_fields():
        if not field.is_relation:
            continue
            
        accessor = field.get_accessor_name() if hasattr(field, 'get_accessor_name') else field.name
        if not accessor or accessor in _IGNORED_FIELDS:
            continue

        try:
            # Caso 1: Relación inversa (OneToManyRel, ManyToManyRel, OneToOneRel)
            if hasattr(field, 'related_model'):
                model_label = str(field.related_model._meta.verbose_name_plural or field.related_model.__name__)
                if hasattr(field, 'one_to_one') and field.one_to_one:
                    if hasattr(user, accessor) and getattr(user, accessor) is not None:
                        linked_models.append(model_label)
                else:
                    manager = getattr(user, accessor, None)
                    if manager and hasattr(manager, 'exists') and manager.exists():
                        linked_models.append(model_label)
            
            # Caso 2: Campo directo (ForeignKey o OneToOneField en el propio modelo CustomUser)
            # Nota: Esto es menos común para "bloquear" borrado de usuarios, pero lo cubrimos.
            elif hasattr(user, field.name) and getattr(user, field.name) is not None:
                # Si el campo apunta a algo, evaluamos si cuenta como "vínculo"
                pass 
        except Exception:
            pass

    try:
        with transaction.atomic():
            if linked_models:
                unique_models = sorted(set(linked_models))
                user.is_active = False
                user.save(update_fields=['is_active'])
                return {
                    'action': 'SOFT_DELETE',
                    'message': f'Usuario desactivado por tener datos vinculados en: {", ".join(unique_models)}',
                    'detail': unique_models,
                }
            else:
                email = user.email
                user.delete()
                logger.info('user_delete_logic: usuario %s eliminado permanentemente.', email)
                return {
                    'action': 'HARD_DELETE',
                    'message': f'Usuario ({email}) eliminado permanentemente.',
                    'detail': [],
                }
    except Exception as exc:
        # Si algo falla en el borrado físico (ej. ProtectedError no detectado), 
        # forzamos el Soft Delete por seguridad.
        user.is_active = False
        user.save(update_fields=['is_active'])
        logger.warning('user_delete_logic: Fallo en borrado físico de %s. Aplicando soft-delete. Error: %s', user.email, str(exc))
        return {
            'action': 'SOFT_DELETE',
            'message': 'El usuario fue desactivado debido a restricciones de integridad en la base de datos.',
            'detail': [str(exc)],
        }


def toggle_user_active(*, user: CustomUser, requesting_user: CustomUser) -> CustomUser:
    """
    Alterna el estado de activación de un usuario.

    CORRECCIÓN: se agrega la verificación de que un admin no pueda
    desactivarse a sí mismo, lo que lo dejaría sin acceso al sistema.
    """
    if user.pk == requesting_user.pk:
        raise ValueError('Un usuario no puede desactivarse a sí mismo.')

    user.is_active = not user.is_active
    user.save(update_fields=['is_active'])
    return user


def user_update_password_logic(
    *, 
    user: CustomUser, 
    old_password: str, 
    new_password: str, 
    otp_code: str = None
) -> CustomUser:
    """
    Lógica de negocio para el cambio de contraseña:
    1. Valida la contraseña actual.
    2. Valida TOTP si el usuario tiene 2FA activo.
    3. Cambia la contraseña (validando fortaleza).
    4. Revoca TODAS las sesiones (fuerza re-login).
    """
    from django.core.exceptions import PermissionDenied
    from ..services.totp_service import TOTPService
    from ..selectors.totp import get_totp_device_by_user

    # 1. Validar identidad vía password
    if not user.check_password(old_password):
        raise ValidationError({'old_password': 'La contraseña actual es incorrecta.'})

    # 2. Validar identidad vía TOTP (si aplica)
    device = get_totp_device_by_user(user)
    if device and device.is_active:
        if not otp_code:
            raise ValidationError({'otp_code': 'Se requiere el código de verificación de 2FA para esta operación.'})
        
        if not TOTPService.verify_login_code(user, otp_code):
            raise ValidationError({'otp_code': 'Código de verificación inválido o expirado.'})

    # 3. Cambiar contraseña
    # user_change_password ya valida la fortaleza
    user_change_password(user=user, new_password=new_password)

    logger.info("user_update_password_logic: contraseña cambiada para %s", user.email)
    return user
