/**
 * features/publicEvaluation/components/HelpModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de ayuda metodológica para el evaluador (RF-PUB-07).
 * Presenta con claridad ejecutiva, sobriedad y minimalismo el objetivo
 * de cada fase, los criterios de decisión y las reglas metodológicas de GUIOS.
 */

import React, { memo } from 'react';
import { HelpCircle } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    step?: number;
}

export const HelpModal: React.FC<HelpModalProps> = ({
    isOpen,
    onClose,
    step = 1,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                        <HelpCircle size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                            {step === 0 ? 'Guía Metodológica — Fase Inicial (Registro)' : `Guía Metodológica — Fase ${step}`}
                        </h2>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                            Objetivos, parámetros y criterios de decisión del marco GUIOS
                        </p>
                    </div>
                </div>
            }
        >
            <div className="space-y-4 text-xs leading-relaxed text-[var(--color-text-secondary)] py-1">
                {step === 0 && (
                    <div className="space-y-4">
                        {/* 1. Propósito General */}
                        <div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                ¿Qué es el Sistema GUIOS?
                            </span>
                            <p className="text-xs text-[var(--color-text-primary)] font-medium">
                                GUIOS es un marco metodológico multicriterio diseñado para evaluar objetivamente la viabilidad de adopción de Software Libre y de Código Abierto (FLOSS) en instituciones públicas y privadas mediante 18 factores técnicos/estratégicos y 96 subfactores verificables.
                            </p>
                        </div>

                        {/* 2. Flujo de las 3 Fases */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3 space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                                Recorrido de Evaluación en 3 Fases
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[10px] font-mono font-bold text-[var(--color-primary)] uppercase block mb-0.5">
                                        Fase 1 · Factores
                                    </span>
                                    <p className="text-[11px]">
                                        Pondere la Importancia del Decisor (ID 1 a 4) frente a la literatura científica (OpenAlex) para calcular la Importancia Relativa (IR).
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[10px] font-mono font-bold text-[var(--color-primary)] uppercase block mb-0.5">
                                        Fase 2 · Subfactores
                                    </span>
                                    <p className="text-[11px]">
                                        Califique de 1 a 4 los criterios técnicos verificables de cada factor aplicable para obtener su Ponderación Media (PM).
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <span className="text-[10px] font-mono font-bold text-[var(--color-primary)] uppercase block mb-0.5">
                                        Fase 3 · Dictamen FODA
                                    </span>
                                    <p className="text-[11px]">
                                        Obtenga la Matriz FODA automática, el Veredicto de Adopción (A, B o C), el Plan de Mitigación y los reportes PDF/Excel.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Funcionalidades de la Pantalla Inicial */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3 space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                                Herramientas en esta Pantalla
                            </span>
                            <ul className="space-y-1.5 list-disc pl-4">
                                <li>
                                    <strong className="text-[var(--color-text-primary)]">Búsqueda Científica y Asistencia IA:</strong> Al ingresar la descripción técnica o URL del repositorio, GUIOS consulta artículos indexados en OpenAlex y habilita sugerencias orientativas de IA (el motor matemático de GUIOS siempre calcula el dictamen de forma determinista).
                                </li>
                                <li>
                                    <strong className="text-[var(--color-text-primary)]">Historial Local y Enlaces Compartibles:</strong> Sus sesiones se guardan automáticamente en este navegador y pueden compartirse con colegas mediante URL única.
                                </li>
                                <li>
                                    <strong className="text-[var(--color-text-primary)]">Comparador y Re-evaluación:</strong> Compare dos softwares lado a lado desde el historial o clone los datos de una evaluación previa para evaluar una nueva versión.
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-4">
                        {/* 1. Objetivo */}
                        <div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Objetivo de la Fase 1
                            </span>
                            <p className="text-xs text-[var(--color-text-primary)] font-medium">
                                Identificar cuáles de los 18 factores del catálogo son prioritarios para su institución y descartar aquellos que no correspondan a sus necesidades operativas.
                            </p>
                        </div>

                        {/* 2. Parámetros */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3 space-y-2.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                                Indicadores y Variables
                            </span>

                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <span className="font-mono font-bold text-[11px] text-[var(--color-text-primary)] shrink-0 w-8">
                                        IS:
                                    </span>
                                    <div>
                                        <strong className="text-[var(--color-text-primary)]">Importancia Sugerida</strong> (solo lectura).
                                        Valor (1 a 4) que combina la Importancia del Experto con la Importancia de la Literatura (según la frecuencia de citación del factor frente al resto de factores de la evaluación).
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <span className="font-mono font-bold text-[11px] text-[var(--color-text-primary)] shrink-0 w-8">
                                        ID:
                                    </span>
                                    <div>
                                        <strong className="text-[var(--color-text-primary)]">Importancia del Decisor</strong> (configurable).
                                        Ponderación asignada por su equipo según las prioridades institucionales:
                                        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
                                            <div className="px-2 py-1 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                                <span className="text-[var(--color-text-primary)] font-bold">1:</span> Irrelevante
                                            </div>
                                            <div className="px-2 py-1 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                                <span className="text-[var(--color-text-primary)] font-bold">2:</span> Opcional
                                            </div>
                                            <div className="px-2 py-1 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                                <span className="text-[var(--color-text-primary)] font-bold">3:</span> Importante
                                            </div>
                                            <div className="px-2 py-1 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                                <span className="text-[var(--color-text-primary)] font-bold">4:</span> Fundamental
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <span className="font-mono font-bold text-[11px] text-[var(--color-text-primary)] shrink-0 w-8">
                                        IR:
                                    </span>
                                    <div>
                                        <strong className="text-[var(--color-text-primary)]">Importancia Relativa</strong> (cálculo matricial).
                                        Resultado del cruce entre la Importancia Sugerida y la Importancia del Decisor.
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <span className="font-mono font-bold text-[11px] text-[var(--color-text-primary)] shrink-0 w-8">
                                        Ámbito:
                                    </span>
                                    <div>
                                        <strong className="text-[var(--color-text-primary)]">Interno vs. Externo</strong>.
                                        Define si el factor clasifica hacia Fortalezas/Debilidades (interno) o hacia Oportunidades/Amenazas (externo). El factor <em>Soporte</em> es configurable según la fuente del servicio.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Regla Metodológica */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Regla de Relevancia
                            </span>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                                Si un factor resulta con <strong>IR = 1 (Irrelevante)</strong>, se excluye de la siguiente fase y <strong>no penaliza</strong> la decisión final. Únicamente los factores con <strong>IR ≥ 2</strong> avanzan a la Fase 2 como factores relevantes. Como el IR cruza su prioridad con la Importancia Sugerida, un factor que usted marque como Irrelevante puede avanzar como Opcional (IR = 2) si la evidencia lo respalda con importancia Importante o Fundamental.
                            </p>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        {/* 1. Objetivo */}
                        <div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Objetivo de la Fase 2
                            </span>
                            <p className="text-xs text-[var(--color-text-primary)] font-medium">
                                Evaluar objetivamente el cumplimiento del software candidato frente a las afirmaciones técnicas verificables de los factores que resultaron relevantes en la Fase 1.
                            </p>
                        </div>

                        {/* 2. Escala de Calificación */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3 space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Escala de Cumplimiento Técnico
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 mb-0.5">
                                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">1</span>
                                        <span>No cumple</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        El software carece del requerimiento o no alcanza el estándar mínimo exigido.
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 mb-0.5">
                                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">2</span>
                                        <span>Desconozco</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        Incertidumbre o falta de evidencia técnica en la documentación oficial.
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 mb-0.5">
                                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">3</span>
                                        <span>Parcial</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        Cumplimiento condicionado, limitado o dependiente de componentes de terceros.
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 mb-0.5">
                                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">4</span>
                                        <span>Satisfactorio</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        Cumple plenamente de forma nativa conforme a las mejores prácticas de la industria.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Ponderación Media */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Ponderación Media (PM) y Umbral de Calidad (3.0)
                            </span>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                                La PM es el promedio simple de las calificaciones de los subfactores del factor, en escala 1.0 a 4.0 y redondeado a un decimal. Si la <strong>PM ≥ 3.0</strong>, el factor califica favorablemente en la matriz FODA. Si la <strong>PM &lt; 3.0</strong>, se registra como punto de riesgo que requerirá mitigación.
                            </p>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        {/* 1. Objetivo */}
                        <div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Objetivo de la Fase 3
                            </span>
                            <p className="text-xs text-[var(--color-text-primary)] font-medium">
                                Sintetizar el diagnóstico técnico en una matriz FODA consolidada y emitir la recomendación institucional con su plan de mitigación.
                            </p>
                        </div>

                        {/* 2. Clasificación FODA */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3 space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Cuadrantes de la Matriz FODA
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <div className="font-semibold text-[var(--color-text-primary)] mb-0.5">
                                        Ámbito Interno (Capacidades propias)
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        • PM ≥ 3.0: <strong>Fortaleza</strong> (activo organizacional).<br />
                                        • PM &lt; 3.0: <strong>Debilidad</strong> (brecha interna).
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <div className="font-semibold text-[var(--color-text-primary)] mb-0.5">
                                        Ámbito Externo (Software y mercado)
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        • PM ≥ 3.0: <strong>Oportunidad</strong> (ventaja tecnológica).<br />
                                        • PM &lt; 3.0: <strong>Amenaza</strong> (riesgo externo).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Dictámenes */}
                        <div className="border-t border-[var(--color-border-subtle)] pt-3 space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                                Recomendaciones Institucionales
                            </span>

                            <div className="space-y-1.5 text-xs">
                                <div className="p-2 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <strong className="text-[var(--color-text-primary)]">Recomendación A (Favorable):</strong>{' '}
                                    <span className="text-[var(--color-text-secondary)] text-[11px]">
                                        No hay factores relevantes con debilidades o amenazas: todos superaron el umbral (PM ≥ 3.0). Se recomienda adoptar sin observaciones.
                                    </span>
                                </div>

                                <div className="p-2 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <strong className="text-[var(--color-text-primary)]">Recomendación B (Favorable con Mitigación):</strong>{' '}
                                    <span className="text-[var(--color-text-secondary)] text-[11px]">
                                        Hay debilidades o amenazas, pero solo en factores opcionales (IR = 2) y no superan en número a las fortalezas y oportunidades. La adopción es viable implementando el plan de mitigación.
                                    </span>
                                </div>

                                <div className="p-2 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                    <strong className="text-[var(--color-text-primary)]">Recomendación C (No Favorable):</strong>{' '}
                                    <span className="text-[var(--color-text-secondary)] text-[11px]">
                                        Hay debilidades o amenazas en factores Importantes o Fundamentales (IR ≥ 3), o bien estas superan en número a las fortalezas y oportunidades. Se sugiere analizar la adopción y posponerla hasta mitigar los riesgos.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-3 border-t border-[var(--color-border-subtle)] flex justify-end">
                    <Button variant="secondary" size="sm" onClick={onClose} className="h-8 px-4 text-xs font-semibold">
                        Cerrar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default memo(HelpModal);
