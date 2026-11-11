/**
 * features/publicEvaluation/components/tour/step2TourSteps.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pasos estructurados para el tutorial guiado interactivo de la Fase 2
 * (Calificación de Subfactores y Ponderación Media PM).
 */

import type { TourStep } from './step1TourSteps';

export const STEP_2_TOUR_STEPS: TourStep[] = [
    {
        id: 'phase2-header',
        targetSelector: '[data-tour="phase2-header"]',
        title: 'Fase 2: Calificación y Ponderación Media (PM)',
        description: 'En esta fase se evalúan exclusivamente los factores que resultaron Relevantes en la Fase 1. Cada factor debe calificar sus afirmaciones para determinar su Ponderación Media (umbral crítico: PM ≥ 3.0).',
        placement: 'bottom',
        badge: 'Paso 1 de 7 • Metodología',
    },
    {
        id: 'relevant-factors-list',
        targetSelector: '[data-tour="relevant-factors-list"]',
        title: 'Lista de Factores Relevantes',
        description: 'Explora y selecciona cualquier factor para evaluar sus afirmaciones técnicas. Cada tarjeta muestra el avance, la PM resultante y su diagnóstico preliminar.',
        placement: 'right',
        badge: 'Paso 2 de 7 • Selección',
    },
    {
        id: 'factor-active-header',
        targetSelector: '[data-tour="factor-active-header"]',
        title: 'Diagnóstico PM y Clasificación FODA en Vivo',
        description: 'Observa la Ponderación Media (PM) calculada al instante sobre 4.0. Según el ámbito (interno o externo) y el umbral de 3.0, el factor clasifica como Fortaleza, Debilidad, Oportunidad o Amenaza.',
        placement: 'bottom',
        badge: 'Paso 3 de 7 • Diagnóstico PM',
    },
    {
        id: 'criteria-list',
        targetSelector: '[data-tour="criteria-list"]',
        title: 'Afirmaciones Técnicas Verificables',
        description: 'Cada factor desglosa criterios técnicos objetivos del estándar GUIOS. Lee detenidamente cada postulado antes de emitir tu valoración técnica.',
        placement: 'left',
        badge: 'Paso 4 de 7 • Criterios',
    },
    {
        id: 'rating-selector',
        targetSelector: '[data-tour="rating-selector"]',
        title: 'Calificación con Selección Directa (1 a 4)',
        description: 'Califica de manera ágil con opciones directas: 1 (No cumple), 2 (Desconozco), 3 (Cumple parcialmente) o 4 (Cumple satisfactoriamente). Sin deslizadores para máxima rapidez.',
        placement: 'top',
        badge: 'Paso 5 de 7 • Calificación',
    },
    {
        id: 'save-ratings-action',
        targetSelector: '[data-tour="save-ratings-action"]',
        title: 'Botón Único de Guardado Manual',
        description: 'Guarda todas las calificaciones modificadas con un solo clic. El sistema validará si no tienes cambios pendientes o te advertirá si intentas avanzar sin guardar.',
        placement: 'top',
        badge: 'Paso 6 de 7 • Guardado Único',
    },
    {
        id: 'phase2-actions',
        targetSelector: '[data-tour="phase2-actions"]',
        title: 'Continuar a Matriz FODA y Dictamen (Fase 3)',
        description: 'Al completar la calificación de los factores requeridos, avanza a la Fase 3 donde el sistema consolidará la Matriz FODA y generará el veredicto institucional.',
        placement: 'top',
        badge: 'Paso 7 de 7 • Fase 3',
    },
];
