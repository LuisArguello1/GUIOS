/**
 * features/publicEvaluation/PublicEvaluationPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página principal del Módulo de Evaluación Pública (GUIOS PRO).
 * Orquesta el Wizard de 6 pasos en 3 fases para evaluadores institucionales.
 */

import React, { memo, useState, useMemo } from 'react';
import { Lock } from 'lucide-react';
import Loading from '../../components/ui/Loading';
import ConfirmModal from '../../components/ui/ConfirmModal';
import usePublicEvaluation from './hooks/usePublicEvaluation';
import PublicNavbar from './components/PublicNavbar';
import StepIndicator from './components/StepIndicator';
import Step0SoftwareRegistration from './components/steps/Step0SoftwareRegistration';
import HelpModal from './components/HelpModal';
import Step1FactorsConfig from './components/steps/Step1FactorsConfig';
import Step2SubfactorRating from './components/steps/Step2SubfactorRating';
import Step3VerdictSWOT from './components/steps/Step3VerdictSWOT';
import GuidedTour from './components/tour/GuidedTour';
import AiThinkingOverlay from './components/AiThinkingOverlay';
import { STEP_0_TOUR_STEPS } from './components/tour/step0TourSteps';
import { STEP_1_TOUR_STEPS } from './components/tour/step1TourSteps';
import { STEP_2_TOUR_STEPS } from './components/tour/step2TourSteps';
import { STEP_3_TOUR_STEPS } from './components/tour/step3TourSteps';

export const PublicEvaluationPage: React.FC = () => {
    const {
        evaluation,
        currentStep,
        setCurrentStep,
        handleSelectStep,
        loading,
        isComputing,
        downloadingFormat,

        // Historial de localStorage
        savedEvaluations,
        clonedDraft,
        handleResumeEvaluation,
        handleCloneEvaluation,
        handleDeleteSavedEvaluation,
        handleClearAllHistory,

        // Modales y bloqueo de Fases 1 y 2
        isHelpModalOpen,
        setIsHelpModalOpen,
        helpStep,
        openHelp,
        isConfirmStep3ModalOpen,
        setIsConfirmStep3ModalOpen,
        isStep1And2Locked,
        handleRequestAdvanceToStep3,
        handleConfirmAdvanceToStep3,

        // Estado por paso
        activeFactorId,
        setActiveFactorId,
        relevantFactors,
        activeSubfactors,
        decisorMap,
        subfactorRatingsMap,

        // Handlers reactivos
        getCalculatedIR,
        handleDecisorChange,
        handleScopeChange,
        handleSubfactorRatingChange,
        getFactorLocalPM,
        hasUnsavedSubfactorRatings,
        unsavedSubfactorRatingsCount,

        // IA y repositorio
        aiLoadingFactors,
        aiLoadingSubfactors,
        aiSuggesting,
        syncingRepoHealth,
        handleAISuggestImportance,
        handleAISuggestFactorRatings,
        handleSyncRepoHealth,

        // Operaciones de negocio
        handleStartEvaluation,
        handleSaveDecisor,
        handleSaveSubfactorRatings,
        handleEmitVerdict,
        handleDownloadPdf,
        handleDownloadExcel,
        handleResetEvaluation,
        handleShareEvaluation,
        handleSkipAiThinking,
    } = usePublicEvaluation();

    const [isTourOpen, setIsTourOpen] = useState(false);
    const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);

    const hasUnsavedChangesInActiveStep = useMemo(() => {
        if (currentStep === 0 || isStep1And2Locked) return false;
        const hasUnsavedStep1 = Object.values(decisorMap).some((d) => d.is_modified);
        return hasUnsavedStep1 || (currentStep === 2 && hasUnsavedSubfactorRatings);
    }, [currentStep, isStep1And2Locked, decisorMap, hasUnsavedSubfactorRatings]);

    const handleRequestReset = () => {
        if (hasUnsavedChangesInActiveStep) {
            setIsResetConfirmModalOpen(true);
            return;
        }
        handleResetEvaluation();
    };
    const currentTourSteps = useMemo(() => {
        if (currentStep === 0 || !evaluation) return STEP_0_TOUR_STEPS;
        if (currentStep === 3) return STEP_3_TOUR_STEPS;
        if (currentStep === 2) return STEP_2_TOUR_STEPS;
        return STEP_1_TOUR_STEPS;
    }, [currentStep, evaluation]);

    if (loading && !evaluation) {
        return <Loading fullPage label="Sincronizando sesión de evaluación GUIOS..." />;
    }

    return (
        <div className="min-h-screen lg:h-screen lg:max-h-screen overflow-y-auto lg:overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
            {/* ── Barra de Navegación Pública Superior ── */}
            <PublicNavbar
                evaluation={evaluation}
                onOpenHelp={() => openHelp(currentStep === 0 || !evaluation ? 0 : currentStep)}
                onResetEvaluation={handleRequestReset}
                onStartTour={() => setIsTourOpen(true)}
                showTourButton={currentStep >= 0 && currentStep <= 3}
            />

            {/* ── Contenido Principal del Wizard (Fijo en pantalla completa en desktop, fluido en móvil) ── */}
            <main className="flex-1 min-h-0 w-full p-2 sm:p-2.5 lg:p-3 flex flex-col overflow-y-auto lg:overflow-hidden">
                {currentStep === 0 || !evaluation ? (
                    /* ── Paso 0 (Pantalla Completa): Registro de Software FLOSS e Historial ── */
                    <Step0SoftwareRegistration
                        onSubmit={handleStartEvaluation}
                        isSubmitting={isComputing}
                        savedEvaluations={savedEvaluations}
                        initialDraft={clonedDraft}
                        onResumeEvaluation={handleResumeEvaluation}
                        onCloneEvaluation={handleCloneEvaluation}
                        onDeleteSavedEvaluation={handleDeleteSavedEvaluation}
                        onClearAllHistory={handleClearAllHistory}
                        onShareEvaluation={handleShareEvaluation}
                    />
                ) : (
                    <div className="w-full flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                        {/* Stepper de las 3 fases metodológicas */}
                        <div className="shrink-0">
                            <StepIndicator
                                currentStep={currentStep}
                                onSelectStep={handleSelectStep}
                                isLocked={isStep1And2Locked}
                                completedSteps={
                                    isStep1And2Locked || evaluation.verdict
                                        ? [1, 2, 3]
                                        : evaluation.results && evaluation.results.length > 0
                                        ? [1, 2]
                                        : [1]
                                }
                            />
                        </div>

                        {/* Vista del Paso 1: Configuración de Factores e IR */}
                        {currentStep === 1 && (
                            <Step1FactorsConfig
                                evaluation={evaluation}
                                decisorMap={decisorMap}
                                getCalculatedIR={getCalculatedIR}
                                onDecisorChange={handleDecisorChange}
                                onScopeChange={handleScopeChange}
                                onAISuggestImportance={handleAISuggestImportance}
                                aiLoadingFactors={aiLoadingFactors}
                                onSaveDecisor={handleSaveDecisor}
                                isComputing={isComputing}
                                onOpenHelp={() => openHelp(1)}
                                onBackToStep0={() => setCurrentStep(0)}
                                isReadOnly={isStep1And2Locked}
                                onContinueToStep2={() => handleSelectStep(2)}
                            />
                        )}

                        {/* Vista del Paso 2: Calificación de Subfactores y PM */}
                        {currentStep === 2 && (
                            <Step2SubfactorRating
                                evaluation={evaluation}
                                relevantFactors={relevantFactors}
                                activeFactorId={activeFactorId}
                                onSelectActiveFactor={setActiveFactorId}
                                activeSubfactors={activeSubfactors}
                                subfactorRatingsMap={subfactorRatingsMap}
                                onRatingChange={handleSubfactorRatingChange}
                                getFactorLocalPM={getFactorLocalPM}
                                onAISuggestFactorRatings={handleAISuggestFactorRatings}
                                aiLoadingSubfactors={aiLoadingSubfactors}
                                onSaveRatings={() => handleSaveSubfactorRatings()}
                                isComputing={isComputing}
                                hasUnsavedChanges={hasUnsavedSubfactorRatings}
                                unsavedChangesCount={unsavedSubfactorRatingsCount}
                                onBackToStep1={() => handleSelectStep(1)}
                                onContinueToStep3={handleRequestAdvanceToStep3}
                                onOpenHelp={() => openHelp(2)}
                                isReadOnly={isStep1And2Locked}
                                onSyncRepoHealth={(url) => handleSyncRepoHealth(url, false)}
                                syncingRepoHealth={syncingRepoHealth}
                            />
                        )}

                        {/* Vista del Paso 3: Veredicto Institucional y Matriz FODA */}
                        {currentStep === 3 && (
                            <Step3VerdictSWOT
                                evaluation={evaluation}
                                onEmitVerdict={handleEmitVerdict}
                                isComputing={isComputing}
                                onDownloadPdf={handleDownloadPdf}
                                onDownloadExcel={handleDownloadExcel}
                                downloadingFormat={downloadingFormat}
                                onBackToStep2={() => handleSelectStep(2)}
                                onInspectFactor={(factorId) => {
                                    setActiveFactorId(factorId);
                                    handleSelectStep(2);
                                }}
                                onShareEvaluation={() => handleShareEvaluation()}
                                onCloneEvaluation={() => handleCloneEvaluation()}
                                onResetEvaluation={handleResetEvaluation}
                                onOpenHelp={() => openHelp(3)}
                                onSyncRepoHealth={(url) => handleSyncRepoHealth(url, false)}
                                syncingRepoHealth={syncingRepoHealth}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* ── Modal de Confirmación antes de pasar al Paso 3 (Bloqueo de Pasos 1 y 2) ── */}
            <ConfirmModal
                isOpen={isConfirmStep3ModalOpen}
                onClose={() => setIsConfirmStep3ModalOpen(false)}
                onConfirm={handleConfirmAdvanceToStep3}
                variant="warning"
                title="Confirmar Avance a Fase 3 (Dictamen Final)"
                message="¿Está seguro de que desea consolidar las calificaciones actuales y avanzar a la Fase 3 (Matriz FODA y Dictamen Institucional)?"
                cancelText="Volver y Revisar"
                confirmText="Sí, Confirmar y Pasar a Fase 3"
            >
                <div className="mt-3 space-y-2.5">
                    {evaluation && (
                        <div className="p-2.5 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[var(--color-text-tertiary)]">Software evaluado:</span>
                                <strong className="text-[var(--color-text-primary)] font-mono truncate">
                                    {evaluation.software_name}
                                </strong>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[var(--color-text-tertiary)]">Factores relevantes calificados:</span>
                                <strong className="text-[var(--color-primary)] font-mono">
                                    {relevantFactors.length} de {relevantFactors.length}
                                </strong>
                            </div>
                        </div>
                    )}

                    <div className="flex items-start gap-2.5 p-2.5 rounded-[6px] bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/25">
                        <Lock size={15} className="text-[var(--color-warning-text)] shrink-0 mt-0.5" />
                        <p className="text-[11px] sm:text-xs font-semibold text-[var(--color-warning-text)] leading-relaxed">
                            Importante: Una vez que pase a la Fase 3, ya no se podrán cambiar los datos del Paso 1 (Ponderación del Decisor e Importancia Relativa) ni del Paso 2 (Calificaciones de Subfactores).
                        </p>
                    </div>
                </div>
            </ConfirmModal>

            {/* ── Modal de Confirmación al pulsar "Nueva" con cambios sin guardar ── */}
            <ConfirmModal
                isOpen={isResetConfirmModalOpen}
                onClose={() => setIsResetConfirmModalOpen(false)}
                onConfirm={() => {
                    setIsResetConfirmModalOpen(false);
                    handleResetEvaluation();
                }}
                variant="warning"
                title="Salir a la pantalla de inicio con cambios sin guardar"
                message="Tienes ajustes recientes sin guardar en esta fase. Si sales ahora hacia una nueva evaluación, los cambios no guardados de este paso se descartarán (el resto de la sesión seguirá disponible en tu historial local)."
                cancelText="Permanecer y Guardar"
                confirmText="Salir sin Guardar"
            />

            {/* ── Modal de Ayuda Metodológica ── */}
            <HelpModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                step={helpStep}
            />

            {/* ── Tutorial Guiado Interactivo (Fase 1 y 2) ── */}
            <GuidedTour
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                steps={currentTourSteps}
            />

            {(evaluation?.ai_status === 'searching' || aiSuggesting || (currentStep === 3 && isComputing)) && (
                <AiThinkingOverlay
                    phase={
                        evaluation?.ai_status === 'searching'
                            ? 'literature'
                            : aiSuggesting === 'importance'
                            ? 'importance'
                            : aiSuggesting === 'ratings'
                            ? 'ratings'
                            : 'verdict'
                    }
                    onSkip={
                        evaluation?.ai_status === 'searching' || Boolean(aiSuggesting)
                            ? handleSkipAiThinking
                            : undefined
                    }
                />
            )}
        </div>
    );
};

export default memo(PublicEvaluationPage);
