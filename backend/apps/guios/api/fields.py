import html

from rest_framework import serializers


class PlainTextField(serializers.CharField):
    """
    Texto plano para los serializers de GUIOS (docs/ANALISIS_GUIOS_ORIGINAL.md §8.2).

    XSSSanitizationMiddleware (apps/core) quita las etiquetas HTML de todo JSON y
    además escapa &, < y > ("B&R" llega como "B&amp;R"). Este campo deshace ese
    escape para guardar el texto que escribió el usuario; las etiquetas ya fueron
    eliminadas por el middleware. React escapa al mostrar; otras salidas (PDF, CSV,
    prompts de IA) deben tratar el valor como texto, no como HTML.
    """

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        return html.unescape(value)
