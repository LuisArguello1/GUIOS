import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

# Extensiones de video servidas directamente vía <video> HTML5
_DIRECT_VIDEO_EXTENSIONS = re.compile(r'\.(mp4|webm)(\?.*)?$', re.IGNORECASE)

# Enlaces de YouTube (watch, embed, shorts, youtu.be)
_YOUTUBE_PATTERN = re.compile(r'(youtube\.com|youtu\.be)', re.IGNORECASE)


def is_youtube_url(url: str) -> bool:
    return bool(_YOUTUBE_PATTERN.search(url or ''))


def is_direct_video_url(url: str) -> bool:
    return bool(_DIRECT_VIDEO_EXTENSIONS.search(url or ''))


def validate_display_video_url(value: str) -> None:
    """
    Solo acepta enlaces de YouTube o archivos de video directos (.mp4/.webm).
    El reproductor del Display no soporta otros formatos (no se suben archivos
    al servidor, solo enlaces externos).
    """
    if not (is_youtube_url(value) or is_direct_video_url(value)):
        raise ValidationError(
            _("La URL debe ser un enlace de YouTube o un archivo de video directo (.mp4 / .webm).")
        )
