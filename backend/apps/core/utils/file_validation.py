import logging
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)


# ── Configuración central ────────────────────────────────────────────────────

MAX_SIZE_MB = 5
MAX_SIZE_MB_FILE = 25


IMAGE_SIGNATURES = {
    b'\xff\xd8\xff'      : 'JPEG',
    b'\x89PNG\r\n\x1a\n' : 'PNG',
    b'GIF87a'            : 'GIF',
    b'GIF89a'            : 'GIF',
    b'BM'                : 'BMP',
    b'RIFF'              : 'WEBP',
}

PDF_SIGNATURE = b'%PDF-'


# ── Helpers privados ─────────────────────────────────────────────────────────

def _check_size(file):
    if hasattr(file, 'size') and file.size > MAX_SIZE_MB * 1024 * 1024:
        raise ValidationError(
            _("El archivo no puede superar %(max)sMB.") % {'max': MAX_SIZE_MB}
        )

def _check_size_file(file):
    if hasattr(file, 'size') and file.size > MAX_SIZE_MB_FILE * 1024 * 1024:
        raise ValidationError(
            _("El archivo no puede superar %(max)sMB.") % {'max': MAX_SIZE_MB_FILE}
        )


def _read_header(file):
    file.seek(0)
    header = file.read(12)
    file.seek(0)
    if not header:
        raise ValidationError(_("El archivo está vacío o es ilegible."))
    return header


def _detect_image_format(header):
    for signature, fmt in IMAGE_SIGNATURES.items():
        if header.startswith(signature):
            if fmt == 'WEBP':
                return 'WEBP' if header[8:12] == b'WEBP' else None
            return fmt
    return None


def _verify_image_with_pillow(file, detected_format):
    """Verificación profunda: previene archivos Polyglot."""
    try:
        from PIL import Image, UnidentifiedImageError
        file.seek(0)
        img = Image.open(file)
        img.verify()
        file.seek(0)
    except (IOError, UnidentifiedImageError, SyntaxError):
        logger.warning(
            "Archivo rechazado: Pillow no pudo verificarlo | Nombre: %s | Formato: %s",
            getattr(file, 'name', 'desconocido'),
            detected_format,
        )
        raise ValidationError(_("La imagen está corrupta o su contenido no es válido."))


def _verify_pdf_with_pypdf(file):
    """
    Verificación profunda de PDF con pypdf:
      - Confirma que el PDF es parseable (no solo que tiene la cabecera)
      - Detecta PDFs truncados o con estructura interna inválida
      - Requiere: pip install pypdf
    """
    try:
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError

        file.seek(0)
        reader = PdfReader(file, strict=False)

        # Forzar lectura real: un PDF vacío o corrupto puede abrir pero falla aquí
        _ = len(reader.pages)

        file.seek(0)

    except Exception as exc:  # PdfReadError, EmptyFileError, etc.
        logger.warning(
            "Archivo rechazado: pypdf no pudo leerlo | Nombre: %s | Error: %s",
            getattr(file, 'name', 'desconocido'),
            type(exc).__name__,
        )
        raise ValidationError(_("El PDF está corrupto o su estructura no es válida."))


# ── Validator principal ───────────────────────────────────────────────────────

def validate_file_integrity(file):
    """
    Valida la integridad de imágenes (JPEG, PNG, WEBP, GIF, BMP) y PDFs.

    Capas de validación:
      1. Tamaño máximo
      2. Magic bytes  — detección rápida de formato
      3. Verificación profunda:
           • Imágenes → Pillow verify()   (anti-Polyglot)
           • PDFs     → pypdf PdfReader   (estructura interna)

    Uso:
        # models.py
        file = models.FileField(validators=[validate_file_integrity])

        # serializers.py (DRF)
        file = serializers.FileField(validators=[validate_file_integrity])
    """
    try:
        _check_size(file)
        header = _read_header(file)

        # ── Rama PDF ────────────────────────────────────────────────────
        if header.startswith(PDF_SIGNATURE):
            _verify_pdf_with_pypdf(file)
            return  # ✅ PDF válido

        # ── Rama Imagen ─────────────────────────────────────────────────
        detected_format = _detect_image_format(header)

        if not detected_format:
            logger.warning(
                "Archivo rechazado: cabecera inválida | Nombre: %s | Cabecera: %s",
                getattr(file, 'name', 'desconocido'),
                header.hex(),
            )
            raise ValidationError(
                _("Formato no permitido. Solo se aceptan imágenes "
                  "(JPEG, PNG, WEBP, GIF, BMP) y PDFs.")
            )

        _verify_image_with_pillow(file, detected_format)  # ✅ Imagen válida

    except ValidationError:
        raise
    except Exception as exc:
        logger.error(
            "Error inesperado en validación de archivo | Tipo: %s",
            type(exc).__name__,
        )
        raise ValidationError(_("No se pudo verificar la integridad del archivo."))


# ── Alias para retrocompatibilidad ───────────────────────────────────────────
validate_image_file_integrity = validate_file_integrity


def validate_csv_file_integrity(file):
    """
    Valida la integridad de un archivo CSV:
      1. Tamaño máximo (máximo 5MB por defecto)
      2. Extensión .csv
      3. Ausencia de caracteres nulos (bytes binarios)
      4. Codificación válida de texto (UTF-8 o Latin-1)
    """
    _check_size_file(file)
    
    name = getattr(file, 'name', '')
    if not name.lower().endswith('.csv'):
        raise ValidationError(_("Solo se permiten archivos CSV."))
        
    header = _read_header(file)
    if b'\x00' in header:
        raise ValidationError(_("El archivo no es de tipo texto/CSV válido (contiene bytes nulos)."))
        
    try:
        header.decode('utf-8')
    except UnicodeDecodeError:
        try:
            header.decode('latin-1')
        except UnicodeDecodeError:
            raise ValidationError(_("El archivo no tiene una codificación de texto válida."))