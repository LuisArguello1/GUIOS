import { AxiosError } from 'axios';
import { getErrorData, getErrorStatus } from '../../api/publicAxios';

const MANUAL = 'Puede continuar la evaluación en modo manual.';

/**
 * Mensaje claro para un error de la asistencia de IA (RF-IA-05). La evaluación
 * nunca se detiene: los valores siguen siendo los que elige el evaluador.
 */
export const aiErrorMessage = (error: unknown): string => {
    const status = getErrorStatus(error);
    const data = getErrorData<{ code?: string; detail?: string }>(error);
    if (status === null) {
        return error instanceof AxiosError && error.code === 'ECONNABORTED'
            ? `La IA tardó demasiado en responder. ${MANUAL}`
            : `No se pudo conectar con la asistencia de IA. ${MANUAL}`;
    }
    if (status === 503) return `La asistencia de IA no está disponible en este momento. ${MANUAL}`;
    if (status === 504) return `La IA tardó demasiado en responder. ${MANUAL}`;
    if (status === 429) return `Se alcanzó el límite de solicitudes a la IA desde esta red. Intente más tarde. ${MANUAL}`;
    if (status === 502) {
        return data?.code === 'ai_invalid_response'
            ? `La IA devolvió una respuesta no válida y se descartó. ${MANUAL}`
            : `El servicio de IA falló. ${MANUAL}`;
    }
    if (data?.detail) return `${data.detail} ${MANUAL}`;
    return `No se pudo obtener la sugerencia de la IA. ${MANUAL}`;
};
