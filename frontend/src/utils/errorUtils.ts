/**
 * Extrae un mensaje de error legible de una respuesta de API (Axios).
 * Maneja tanto el campo 'detail' como diccionarios de validación.
 */
export const getErrorDetail = (error: unknown, fallback: string = 'Error inesperado'): string => {
    if (typeof error !== 'object' || error === null) return fallback;
    
    const response = (error as { response?: unknown }).response;
    if (typeof response !== 'object' || response === null) return fallback;
    
    const data = (response as { data?: unknown }).data;
    if (typeof data !== 'object' || data === null) return fallback;

    // 1. Caso estándar de Django/DRF: 'detail' (Permisos, Errores Globales)
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail;

    // 2. Errores de validación de campos: { "campo": ["mensaje"] }
    if (typeof data === 'object') {
        const errors = Object.entries(data)
            .filter(([key]) => key !== 'detail')
            .map(([key, value]) => {
                const msg = Array.isArray(value) ? value[0] : value;
                // Formatear el nombre del campo para que sea más legible (ej: first_name -> Nombre)
                const fieldName = key.replace('_', ' ');
                return `${fieldName}: ${msg}`;
            });
        
        if (errors.length > 0) return errors.join(' | ');
    }

    return fallback;
};
