/**
 * features/publicEvaluation/components/tour/step3TourSteps.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pasos estructurados para el tutorial guiado interactivo de la Fase 3
 * (Matriz FODA Consolidada, Dictamen Final A/B/C y Exportación Oficial).
 */

import type { TourStep } from './step1TourSteps';

export const STEP_3_TOUR_STEPS: TourStep[] = [
    {
        id: 'phase3-header',
        targetSelector: '[data-tour="phase3-header"]',
        title: 'Fase 3: Matriz FODA y Dictamen Final',
        description: 'Aquí culmina la metodología GUIOS. Esta barra consolida el software evaluado, la cantidad de factores procesados, el balance cuantitativo de cuadrantes y las acciones rápidas de emisión.',
        placement: 'bottom',
        badge: 'Paso 1 de 7 • Control de Fase 3',
    },
    {
        id: 'verdict-card',
        targetSelector: '[data-tour="verdict-card"]',
        title: 'Recomendación Institucional Oficial',
        description: 'Dictamen algorítmico determinista: Recomendación A (Adopción recomendada sin restricciones), B (Adopción condicionada a plan de mitigación) o C (Adopción no recomendada por incumplir factores críticos). Muestra la fecha de emisión y la justificación formal.',
        placement: 'bottom',
        badge: 'Paso 2 de 7 • Dictamen Oficial',
    },
    {
        id: 'executive-summary',
        targetSelector: '[data-tour="tabs-section"]',
        actionSelector: '[data-tour="executive-tab-btn"]',
        title: 'Resumen Ejecutivo para la Alta Dirección',
        description: 'Síntesis orientada a directores y comités de toma de decisiones, explicando los hallazgos técnicos en lenguaje gerencial y de gestión pública o privada para facilitar la deliberación y el sustento normativo.',
        placement: 'bottom',
        badge: 'Paso 3 de 7 • Resumen Ejecutivo',
    },
    {
        id: 'mitigation-plan',
        targetSelector: '[data-tour="tabs-section"]',
        actionSelector: '[data-tour="mitigation-tab-btn"]',
        title: 'Plan de Mitigación de Brechas y Riesgos',
        description: 'Estructura tabular que atiende cada debilidad y amenaza detectada: riesgo metodológico, acción correctiva sugerida, área responsable (TI u Organizacional) y meta cuantitativa de verificación antes del despliegue.',
        placement: 'top',
        badge: 'Paso 4 de 7 • Plan de Mitigación',
    },
    {
        id: 'foda-matrix-section',
        targetSelector: '[data-tour="foda-matrix-section"]',
        title: 'Matriz FODA Consolidada (2×2)',
        description: 'Organiza todos los factores evaluados en 4 cuadrantes según su ámbito y Ponderación Media (PM sobre 4.0): Fortalezas (internos ≥ 3.0), Oportunidades (externos ≥ 3.0), Debilidades (internos < 3.0) y Amenazas (externos < 3.0).',
        placement: 'top',
        badge: 'Paso 5 de 7 • Matriz FODA 2×2',
    },
    {
        id: 'foda-view-toggle',
        targetSelector: '[data-tour="foda-view-toggle"]',
        title: 'Alternador de Vista: Matriz 2×2 / Vista Tabla',
        description: 'Permite alternar entre la visión ejecutiva de cuadrantes 2×2 y la tabla técnica detallada de auditoría, donde puedes inspeccionar cada factor con su Ponderación Media exacta y verificación de umbral crítico.',
        placement: 'top',
        badge: 'Paso 6 de 7 • Vistas Comparativas',
    },
    {
        id: 'export-actions',
        targetSelector: '[data-tour="export-actions"]',
        title: 'Exportación Oficial en PDF y Excel',
        description: 'Descarga el informe completo en PDF con membrete institucional para comités directivos o la hoja de cálculo Excel con todas las matrices para auditoría metodológica. También puedes iniciar una nueva evaluación cuando lo desees.',
        placement: 'top',
        badge: 'Paso 7 de 7 • Exportación Oficial',
    },
];
