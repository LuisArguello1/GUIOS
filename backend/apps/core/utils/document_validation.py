import re
import logging
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════
#  PASAPORTE
# ══════════════════════════════════════════════════════════════

# ICAO Doc 9303: alfanumérico, 6–9 caracteres
_PASSPORT_PATTERN = re.compile(r'^[A-Z0-9]{6,9}$')
# Formato específico Ecuador: 2 letras + 6 dígitos (ej: AA123456)
_EC_PASSPORT_PATTERN = re.compile(r'^[A-Z]{2}[0-9]{6}$')

def validate_passport(value, strict_ecuador=False):
    """
    Valida un número de pasaporte según ICAO Doc 9303.
    """
    if not value:
        raise ValidationError(_("El número de pasaporte no puede estar vacío."))

    passport = str(value).strip().upper()

    if not _PASSPORT_PATTERN.match(passport):
        logger.warning(f"Pasaporte inválido: {len(passport)} chars")
        raise ValidationError(
            _("El pasaporte debe tener entre 6 y 9 caracteres alfanuméricos.")
        )

    if strict_ecuador and not _EC_PASSPORT_PATTERN.match(passport):
        raise ValidationError(
            _("El pasaporte ecuatoriano debe tener el formato: 2 letras y 6 dígitos (ej: AA123456).")
        )

# ══════════════════════════════════════════════════════════════
#  CÉDULA ECUATORIANA
# ══════════════════════════════════════════════════════════════

_PROVINCIAS_VALIDAS = set(range(1, 25)) | {30}

def _cedula_es_valida(cedula: str) -> bool:
    if len(cedula) != 10 or not cedula.isdigit():
        return False
    provincia = int(cedula[:2])
    if provincia not in _PROVINCIAS_VALIDAS:
        return False
    coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = 0
    for i in range(9):
        mult = int(cedula[i]) * coeficientes[i]
        total += (mult - 9) if mult > 9 else mult
    verificador = (10 - total % 10) % 10
    return verificador == int(cedula[9])

def valida_cedula(value):
    cedula = str(value).strip()
    if not cedula.isdigit():
        raise ValidationError(_("La cédula debe contener solo dígitos."))
    if len(cedula) != 10:
        raise ValidationError(_("La cédula debe tener exactamente 10 dígitos."))
    if not _cedula_es_valida(cedula):
        raise ValidationError(_("El número de cédula ingresado no es válido."))

# ══════════════════════════════════════════════════════════════
#  RUC ECUATORIANO
# ══════════════════════════════════════════════════════════════

def _ruc_persona_natural_es_valido(ruc: str) -> bool:
    return _cedula_es_valida(ruc[:10]) and int(ruc[10:]) >= 1

def _ruc_sociedad_privada_es_valido(ruc: str) -> bool:
    coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(ruc[i]) * coeficientes[i] for i in range(9))
    residuo = total % 11
    verificador = 0 if residuo == 0 else (11 - residuo)
    return verificador == int(ruc[9]) and int(ruc[10:]) >= 1

def _ruc_sociedad_publica_es_valido(ruc: str) -> bool:
    coeficientes = [3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(ruc[i]) * coeficientes[i] for i in range(8))
    residuo = total % 11
    verificador = 0 if residuo == 0 else (11 - residuo)
    return verificador == int(ruc[8]) and int(ruc[9:]) >= 1

def valida_ruc(value):
    ruc = str(value).strip()
    if not ruc.isdigit() or len(ruc) != 13:
        raise ValidationError(_("El RUC debe tener exactamente 13 dígitos numéricos."))
    
    tp = int(ruc[2])
    if 0 <= tp <= 5:   isValid = _ruc_persona_natural_es_valido(ruc)
    elif tp == 9:     isValid = _ruc_sociedad_privada_es_valido(ruc)
    elif tp == 6:     isValid = _ruc_sociedad_publica_es_valido(ruc)
    else:             isValid = False

    if not isValid:
        raise ValidationError(_("El RUC ingresado no es válido."))

# ══════════════════════════════════════════════════════════════
#  TELÉFONO ECUADOR
# ══════════════════════════════════════════════════════════════

# Patrones compilados a nivel de módulo — no recompilan en cada llamada
_CEL_PATTERN  = re.compile(r'^09\d{8}$')    # Celular: 09XXXXXXXX (10 dígitos)
_FIJO_PATTERN = re.compile(r'^0[2-7]\d{7}$') # Fijo: 0[2-7]XXXXXXX (9 dígitos)
#
# Códigos de área fijos Ecuador:
# 02 Pichincha/Quito · 03 Sierra centro · 04 Guayas
# 05 Costa centro   · 06 Sierra/Oriente norte · 07 Sur/Oriente sur

_PREFIJO_INTERNACIONAL = re.compile(r'^(\+593|593)')


def normalizar_telefono_ecuador(value: str) -> str:
    """
    Limpia separadores comunes y convierte prefijo internacional al formato local.
    +593991234567 → 0991234567
      593991234567 → 0991234567
    """
    if not value:
        return ""
    
    tel = re.sub(r'[\s\-()+.]', '', str(value))

    # Convertir prefijo internacional ecuatoriano a formato local
    if tel.startswith('593') and len(tel) > 3:
        tel = '0' + tel[3:]

    return tel


def valida_telefono_ecuador(value):
    """
    Valida números de teléfono ecuatorianos.

    Formatos aceptados (antes de normalizar):
      Celular : 0991234567 · +593991234567 · 099 123 4567
      Fijo    : 022345678  · +5022345678   · 02 234-5678

    La lógica de campo opcional (blank=True) va en el modelo o serializer,
    este validador solo actúa si hay información.
    """
    if not value:
        return

    tel = normalizar_telefono_ecuador(value)

    if not tel.isdigit():
        raise ValidationError(
            _("El teléfono solo puede contener dígitos, espacios, guiones o paréntesis.")
        )

    if _CEL_PATTERN.match(tel):
        return  # Celular válido

    if _FIJO_PATTERN.match(tel):
        return  # Fijo válido

    # Dar un mensaje útil según la longitud detectada
    if len(tel) == 10 and not tel.startswith('09'):
        logger.warning("Teléfono celular inválido | Prefijo: %s", tel[:2])
        raise ValidationError(_("Los celulares ecuatorianos deben empezar con 09."))

    if len(tel) == 9 and tel[1] not in '234567':
        logger.warning("Teléfono fijo inválido | Código de área: %s", tel[:2])
        raise ValidationError(
            _("El código de área del teléfono fijo no es válido (02–07).")
        )

    logger.warning("Teléfono inválido | Longitud: %d | Prefijo: %s", len(tel), tel[:2])
    raise ValidationError(
        _("Número inválido. Celular: 10 dígitos empezando con 09. Fijo: 9 dígitos empezando con 02–07.")
    )
