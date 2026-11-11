/**
 * features/publicEvaluation/components/tour/step1TourSteps.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pasos estructurados para el tutorial guiado interactivo de la Fase 1.
 * Explica la jerarquía metodológica: Dimensiones, Relevancia RN-01, Selección
 * de ID y continuación a Fase 2.
 */

export interface TourStep {
    id: string;
    targetSelector: string;
    title: string;
    description: string;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
    badge?: string;
    actionSelector?: string;
}

export const STEP_1_TOUR_STEPS: TourStep[] = [
    {
        id: 'dimension-tabs',
        targetSelector: '[data-tour="dimension-tabs"]',
        title: 'Dimensiones Metodológicas',
        description: 'El modelo GUIOS organiza los factores en 3 dimensiones: Tecnológica, Organizacional y Económica. Haz clic en cada pestaña para configurar sus factores específicos.',
        placement: 'bottom',
        badge: 'Paso 1 de 7 • Navegación',
    },
    {
        id: 'metrics-summary',
        targetSelector: '[data-tour="metrics-summary"]',
        title: 'Balance de Relevancia',
        description: 'Monitorea en tiempo real cuántos factores resultan Relevantes (IR > 1) y pasarán a la Fase 2, y cuántos son descartados como Irrelevantes (IR = 1).',
        placement: 'bottom',
        badge: 'Paso 2 de 7 • Métricas',
    },
    {
        id: 'factors-list',
        targetSelector: '[data-tour="factors-list"]',
        title: 'Selector de Factores',
        description: 'Explora y selecciona cualquier factor de la dimensión activa. Cada tarjeta resume su Importancia Sugerida (IS), Decisor (ID), Relativa (IR) y Ámbito.',
        placement: 'right',
        badge: 'Paso 3 de 7 • Catálogo',
    },
    {
        id: 'factor-header',
        targetSelector: '[data-tour="factor-header"]',
        title: 'Factor Seleccionado e IR Resultante',
        description: 'Muestra el factor activo y el cálculo instantáneo de su Importancia Relativa (IR). La combinación de literatura y tu prioridad determina si pasa o no a la siguiente fase.',
        placement: 'bottom',
        badge: 'Paso 4 de 7 • Cálculo',
    },
    {
        id: 'decisor-selector',
        targetSelector: '[data-tour="decisor-selector"]',
        title: 'Tu Prioridad: Importancia del Decisor (ID)',
        description: 'Define qué tan crítico es este factor para tu organización (del 1 al 4). Cada opción cuenta con su descripción metodológica y actualiza el IR de inmediato.',
        placement: 'right',
        badge: 'Paso 5 de 7 • Decisión',
    },
    {
        id: 'factor-info',
        targetSelector: '[data-tour="factor-info"]',
        title: 'Información Metodológica del Factor',
        description: 'Consulta los parámetros clave del factor: citas de literatura técnica, tu selección, el IR resultante, el alcance (interno/externo) y el número de subfactores en catálogo.',
        placement: 'left',
        badge: 'Paso 6 de 7 • Parámetros',
    },
    {
        id: 'step1-actions',
        targetSelector: '[data-tour="step1-actions"]',
        title: 'Guardar y Continuar a Fase 2',
        description: 'Cuando hayas configurado la prioridad de tus factores, presiona este botón para guardar las decisiones y avanzar a la Fase 2 (Calificación de Subfactores).',
        placement: 'top',
        badge: 'Paso 7 de 7 • Guardar',
    },
];
