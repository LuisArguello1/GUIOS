/**
 * features/publicEvaluation/components/ui/PrivacyPolicyModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal informativo sobre Seguridad, Privacidad de Datos y Uso Ético de IA en GUIOS.
 * Cumple con principios de transparencia, GDPR / Habeas Data y Zero Data Retention.
 */

import React, { memo } from 'react';
import { ShieldCheck, Lock, Cpu, Database, EyeOff, CheckCircle2 } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
    isOpen,
    onClose,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-[6px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                            Política de Privacidad, Tratamiento de Datos y Uso de IA
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                            GUIOS PRO — Sistema de Evaluación de Adopción de Software Libre
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-1 font-mono">
                        <Lock size={12} className="text-emerald-500" />
                        <span>Versión 1.0 (Vigente Octubre 2026)</span>
                    </span>
                    <Button variant="primary" size="sm" onClick={onClose}>
                        Entendido y Aceptar
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 text-xs text-[var(--color-text-secondary)] leading-relaxed pr-1">
                {/* ── Introducción ── */}
                <div className="p-3 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] space-y-1.5">
                    <p className="font-medium text-[var(--color-text-primary)]">
                        La plataforma <span className="font-bold text-[var(--color-primary)]">GUIOS PRO</span> opera bajo un estricto compromiso de transparencia, confidencialidad y respeto a la privacidad de los evaluadores institucionales.
                    </p>
                    <p className="text-[11px]">
                        A continuación se detallan los principios que rigen la recolección, almacenamiento y análisis de la información ingresada en las sesiones de evaluación.
                    </p>
                </div>

                {/* ── 1. Cero Datos Personales Identificables (PII) ── */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
                        <EyeOff size={15} className="text-emerald-500" />
                        <span>1. Cero Recolección de Datos Personales Identificables (PII)</span>
                    </div>
                    <div className="pl-6 space-y-1 text-[11px]">
                        <p>
                            • Las evaluaciones públicas no requieren registro, cédulas, números telefónicos, nombres de personas naturales ni correos electrónicos personales.
                        </p>
                        <p>
                            • Solo se procesan metadatos puramente técnicos del software (nombre, versión, arquitectura) y del contexto institucional general (sector de TI, necesidades técnicas).
                        </p>
                        <p>
                            • La dirección IP del cliente nunca se almacena en texto plano; únicamente se genera un hash criptográfico unidireccional (SHA-256) para auditoría de consentimiento de no repudio.
                        </p>
                    </div>
                </div>

                {/* ── 2. Fines Estadísticos e Investigación Científica ── */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
                        <Database size={15} className="text-[var(--color-primary)]" />
                        <span>2. Finalidad del Almacenamiento y Uso Estadístico</span>
                    </div>
                    <div className="pl-6 space-y-1 text-[11px]">
                        <p>
                            • <strong>Estadísticas Agregadas:</strong> Los datos de evaluaciones se recopilan de forma agregada para generar benchmarks sectoriales (adopción FLOSS en educación, salud, gobierno).
                        </p>
                        <p>
                            • <strong>Investigación y Mejora Continua:</strong> La información permite calibrar los modelos empíricos y la precisión metodológica del sistema GUIOS en la evaluación de tecnologías abiertas.
                        </p>
                        <p>
                            • <strong>No Comercialización:</strong> Los datos nunca serán vendidos, cedidos ni compartidos con fines comerciales o publicitarios con terceros.
                        </p>
                    </div>
                </div>

                {/* ── 3. Uso Ético de Inteligencia Artificial (Zero Data Retention) ── */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
                        <Cpu size={15} className="text-violet-500" />
                        <span>3. Procesamiento Asistido por Inteligencia Artificial</span>
                    </div>
                    <div className="pl-6 space-y-1 text-[11px]">
                        <p>
                            • <strong>Búsqueda Bibliográfica Abierta:</strong> Se utiliza el índice académico global <em>OpenAlex</em> para extraer publicaciones científicas verificables con DOI formal.
                        </p>
                        <p>
                            • <strong>Privacidad en Modelos LLM:</strong> Las solicitudes a modelos de lenguaje (Azure OpenAI / Groq) utilizan endpoints empresariales bajo acuerdos de <em>Zero Data Retention</em> (los prompts y descripciones funcionales no se almacenan para entrenar modelos públicos).
                        </p>
                        <p>
                            • <strong>Sugerencias Orientativas:</strong> La IA actúa como un asistente cognitivo complementario; las decisiones finales y ponderaciones ($ID$, $PS$) son siempre potestad exclusiva del evaluador humano.
                        </p>
                    </div>
                </div>

                {/* ── 4. Control Local del Evaluador ── */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                        <span>4. Control y Eliminación del Historial en su Navegador</span>
                    </div>
                    <div className="pl-6 space-y-1 text-[11px]">
                        <p>
                            • Las sesiones iniciadas en este navegador se respaldan en el almacenamiento local (<em>localStorage</em>) para permitirle reanudar la evaluación cuando lo desee.
                        </p>
                        <p>
                            • Puede eliminar individualmente cualquier evaluación guardada o purgar el historial completo en cualquier momento utilizando el botón <strong>"Limpiar todo"</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default memo(PrivacyPolicyModal);

