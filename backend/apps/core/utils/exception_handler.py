from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Handler personalizado que traduce errores de modelos de Django 
    a respuestas de API de DRF (400 Bad Request).
    """
    
    # 1. Dejar que DRF intente manejarlo primero
    response = exception_handler(exc, context)

    # 2. Si DRF no lo manejó y es un error de validación de Django (Models)
    if response is None and isinstance(exc, DjangoValidationError):
        request = context.get('request')
        request_id = getattr(request, 'request_id', 'N/A')
        
        # Formatear errores
        errors = exc.message_dict if hasattr(exc, 'message_dict') else {'detail': exc.messages}
        
        # ── LÓGICA DE EXTRACCIÓN DE MENSAJE AMIGABLE ──
        detail_msg = "Error de validación en los datos."
        
        if isinstance(errors, dict):
            # Caso especial: Violaciones de Stock del POS
            if 'violations' in errors:
                v = errors['violations']
                if isinstance(v, list) and len(v) > 0:
                    first = v[0]
                    # Si es un dict (formato de checkout_inventory.py)
                    if isinstance(first, dict):
                        nombre = first.get('variant_name', 'Producto')
                        disponible = first.get('available_stock', '0')
                        requerido = first.get('required_stock', '0')
                        detail_msg = f"Stock insuficiente: {nombre} (Disponible: {disponible}, Requerido: {requerido})"
                    else:
                        detail_msg = f"Stock insuficiente: {v[0]}"
            else:
                # Caso general: extraer el primer mensaje del primer campo
                first_field = next(iter(errors))
                first_msg = errors[first_field]
                if isinstance(first_msg, list) and len(first_msg) > 0:
                    # Evitar mostrar el nombre del campo si es 'detail'
                    prefix = f"{first_field}: " if first_field != 'detail' else ""
                    detail_msg = f"{prefix}{first_msg[0]}"

        logger.warning(f"DRF VALIDATION ERROR | ReqID: {request_id} | Errores: {errors}")
        
        return Response(
            {
                'detail': detail_msg,
                'errors': errors,
                'code': 'validation_error',
                'request_id': request_id
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3. Retornar la respuesta original de DRF (o None si no se manejó)
    return response
