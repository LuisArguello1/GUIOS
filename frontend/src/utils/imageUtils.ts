/**
 * Utilidades para el manejo de imágenes y rutas de medios.
 * Centraliza la construcción y normalización de URLs para archivos multimedia.
 */

/**
 * Convierte una ruta de imagen en una URL normalizada y segura (evitando Mixed Content en HTTPS).
 */
export const getImageUrl = (path: string | null | undefined): string => {
    if (!path) return '';
    
    let normalized = path.trim();
    if (!normalized) return '';

    // Si la URL viene como absoluta con http:// y la página está en HTTPS o en el mismo dominio
    if (normalized.startsWith('http')) {
        try {
            const urlObj = new URL(normalized);
            const isLocalHost = 
                urlObj.hostname === 'localhost' || 
                urlObj.hostname === '127.0.0.1' || 
                urlObj.hostname.startsWith('192.168.') ||
                urlObj.hostname.startsWith('10.') ||
                urlObj.hostname.startsWith('172.') ||
                urlObj.hostname.endsWith('.local') ||
                ['8000', '8001', '8040', '8050', '8082', '5173'].includes(urlObj.port);

            // Si es el mismo host o un host local, extraemos la ruta relativa para evitar Mixed Content
            if (isLocalHost || (typeof window !== 'undefined' && urlObj.hostname === window.location.hostname)) {
                normalized = urlObj.pathname + urlObj.search;
            } else if (typeof window !== 'undefined' && window.location.protocol === 'https:' && normalized.startsWith('http://')) {
                // Forzar https para dominios externos
                normalized = normalized.replace(/^http:\/\//i, 'https://');
            }
        } catch {
            // Error al parsear, continuar con la ruta original
        }
    }

    if (/^https?:\/\//i.test(normalized) || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
        return normalized;
    }

    normalized = normalized.startsWith('/') ? normalized : `/${normalized}`;

    if (!normalized.startsWith('/media/')) {
        normalized = `/media${normalized}`;
    }

    return normalized;
};

export default getImageUrl;
