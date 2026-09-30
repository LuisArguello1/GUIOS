import os
import io
import uuid
import logging
from PIL import Image, UnidentifiedImageError
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.translation import gettext_lazy as _
from .file_validation import validate_image_file_integrity

logger = logging.getLogger(__name__)

# Límite explícito contra decompression bomb (~20 megapíxeles)
Image.MAX_IMAGE_PIXELS = 20_000_000


def process_image_to_webp(image_file, quality=80, max_size=(1024, 1024)):
    """
    Valida, redimensiona y convierte una imagen a WebP.

    - Valida integridad real (magic bytes + Pillow verify)
    - Protege contra decompression bombs
    - Preserva transparencia (canal alpha) si existe
    - Sanitiza el nombre del archivo contra path traversal
    - Retorna un ContentFile listo para guardar en un FileField/ImageField
    """
    if not image_file:
        return None

    # ── 1. Validación de integridad (magic bytes + Pillow verify) ────────
    validate_image_file_integrity(image_file)

    try:
        # ── 2. Abrir imagen ──────────────────────────────────────────────
        image_file.seek(0)
        img = Image.open(image_file)

        # Cargar pixels en memoria ahora para detectar errores de corrupción
        # antes de continuar con el procesamiento
        img.load()

        # ── 3. Normalizar modo de color preservando alpha ────────────────
        if img.mode == 'P':
            # Modo paleta: preservar transparencia si existe
            img = img.convert('RGBA' if 'transparency' in img.info else 'RGB')
        elif img.mode == 'LA':
            img = img.convert('RGBA')
        elif img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
        # RGB y RGBA se quedan como están — WebP soporta ambos

        # ── 4. Redimensionar respetando el aspecto ───────────────────────
        img.thumbnail(max_size, Image.Resampling.LANCZOS)

        # ── 5. Serializar a WebP en memoria ──────────────────────────────
        buffer = io.BytesIO()
        img.save(buffer, format='WEBP', quality=quality, optimize=True)
        buffer.seek(0)

        # ── 6. Nombre seguro — basename + uuid para evitar colisiones ────
        original_stem = os.path.splitext(os.path.basename(image_file.name))[0]
        safe_name = f"{original_stem}_{uuid.uuid4().hex[:8]}.webp"

        logger.debug(
            "Imagen procesada a WebP | Original: %s | Nuevo: %s | Modo: %s | Tamaño: %s",
            image_file.name,
            safe_name,
            img.mode,
            img.size,
        )

        return ContentFile(buffer.read(), name=safe_name)

    except ValidationError:
        raise
    except (OSError, UnidentifiedImageError, SyntaxError) as exc:
        logger.warning(
            "Error al procesar imagen | Archivo: %s | Tipo: %s",
            getattr(image_file, 'name', 'desconocido'),
            type(exc).__name__,
        )
        raise ValidationError(
            _("No se pudo procesar la imagen. Verifica que el archivo no esté corrupto.")
        )
    except Exception as exc:
        logger.error(
            "Error inesperado al procesar imagen | Tipo: %s",
            type(exc).__name__,
        )
        raise ValidationError(_("Error interno al procesar la imagen."))