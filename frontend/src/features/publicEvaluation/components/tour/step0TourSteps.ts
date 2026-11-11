/**
 * features/publicEvaluation/components/tour/step0TourSteps.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Definición de los pasos del Tour Guiado Interactivo para la Fase Inicial (Paso 0:
 * Registro del Software Candidato FLOSS e Historial de Evaluaciones).
 */

import type { TourStep } from './step1TourSteps';

export const STEP_0_TOUR_STEPS: TourStep[] = [
    {
        id: 'software-org',
        targetSelector: '[data-tour="step0-software-org"]',
        actionSelector: '[data-tour-action="step0-tab-form"]',
        badge: 'Paso 1 de 6 · Identificación del Caso',
        title: 'Software Candidato (FLOSS) y Organización',
        description:
            'Registre el nombre del software libre que desea evaluar (ej. PostgreSQL, Odoo, Nextcloud), su versión, categoría funcional, la institución evaluadora y opcionalmente la URL oficial o repositorio de código (GitHub / GitLab).',
        placement: 'bottom',
    },
    {
        id: 'descriptions',
        targetSelector: '[data-tour="step0-descriptions"]',
        actionSelector: '[data-tour-action="step0-tab-form"]',
        badge: 'Paso 2 de 6 · Contexto Técnico e Institucional',
        title: 'Arquitectura del Software y Necesidades Operativas',
        description:
            'Describa brevemente la arquitectura técnica del software y las necesidades o restricciones de su institución. Esta información contextualiza la búsqueda automática de artículos científicos en OpenAlex y habilita el asistente de IA.',
        placement: 'top',
    },
    {
        id: 'complementary',
        targetSelector: '[data-tour="step0-complementary"]',
        actionSelector: '[data-tour-action="step0-tab-form"]',
        badge: 'Paso 3 de 6 · Perfil Institucional (Opcional)',
        title: 'Información Complementaria de Adopción',
        description:
            'Puede detallar opcionalmente el tamaño de su organización, personal de TI disponible, software propietario a reemplazar y plazo previsto. Estos datos enriquecen el informe PDF/Excel sin alterar las fórmulas matemáticas del dictamen.',
        placement: 'top',
    },
    {
        id: 'consent',
        targetSelector: '[data-tour="step0-consent"]',
        actionSelector: '[data-tour-action="step0-tab-form"]',
        badge: 'Paso 4 de 6 · Privacidad y Ética de Datos',
        title: 'Política Cero Datos Personales y Consentimiento',
        description:
            'GUIOS opera bajo una política estricta de cero datos personales (cero PII). Aquí autoriza el uso estadístico anónimo de la evaluación y, si activó el asistente de IA, el procesamiento contextual sin retención de datos.',
        placement: 'top',
    },
    {
        id: 'submit-bar',
        targetSelector: '[data-tour="step0-submit-bar"]',
        actionSelector: '[data-tour-action="step0-tab-form"]',
        badge: 'Paso 5 de 6 · Asistencia IA e Inicialización',
        title: 'Asistente IA y Comenzar Evaluación',
        description:
            'Elija si desea contar con sugerencias orientativas de Inteligencia Artificial durante la evaluación y presione "Comenzar Evaluación" para inicializar los factores y subfactores del catálogo GUIOS.',
        placement: 'top',
    },
    {
        id: 'history-panel',
        targetSelector: '[data-tour="step0-history-panel"]',
        actionSelector: '[data-tour-action="step0-tab-history"]',
        badge: 'Paso 6 de 6 · Gestión de Sesiones y Comparador',
        title: 'Historial Local, Comparación y Re-evaluación',
        description:
            'Sus evaluaciones se guardan automáticamente en este panel. Desde aquí puede reanudar sesiones en curso, filtrar por estado, compartir enlaces directos, clonar datos para evaluar una nueva versión o comparar 2 softwares lado a lado.',
        placement: 'left',
    },
];
