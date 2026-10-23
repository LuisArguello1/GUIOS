import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { FileCheck2, HelpCircle, Sparkles } from 'lucide-react';
import Alert from '../../../components/ui/Alert';
import Button from '../../../components/ui/Button';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import GenericHelpModal from '../../../components/ui/GenericHelpModal';
import Loading from '../../../components/ui/Loading';
import useEvaluation from '../../../hooks/useEvaluation';
import DimensionTabs from '../components/DimensionTabs';
import EvaluationUnavailable from '../components/EvaluationUnavailable';
import FactorCard from '../components/FactorCard';
import ProgressPanel from '../components/ProgressPanel';
import SaveIndicator from '../components/SaveIndicator';
import { HELP, type HelpTopic } from '../components/helpContent';

/** Estación de evaluación (Pasos 1 a 4) con guardado automático. */
const StationPage = () => {
    const { uuid } = useParams();
    const navigate = useNavigate();
    const {
        evaluation, summary, loadStatus, saveStatus, isGenerating, readOnly,
        setDecisorImportance, setScope, setRating, retryFailed, generateVerdict,
        aiAvailable, aiBusy, aiError, dismissedSuggestions,
        suggestImportance, suggestRatings, acceptAllRatings, dismissSuggestion, clearAiError,
    } = useEvaluation(uuid);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [help, setHelp] = useState<HelpTopic | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const factors = useMemo(() => evaluation?.factors ?? [], [evaluation]);
    const summaryById = useMemo(
        () => new Map((summary?.factors ?? []).map((factor) => [factor.factor_id, factor])),
        [summary],
    );
    const dimensions = useMemo(() => {
        const names: string[] = [];
        factors.forEach((factor) => { if (!names.includes(factor.dimension)) names.push(factor.dimension); });
        const missingByFactor = new Set((summary?.missing ?? []).map((item) => item.factor_id));
        return names.map((name) => {
            const inDimension = factors.filter((factor) => factor.dimension === name);
            return {
                name,
                total: inDimension.length,
                pending: inDimension.filter((factor) => missingByFactor.has(factor.factor_id)).length,
            };
        });
    }, [factors, summary]);
    const currentTab = activeTab ?? dimensions[0]?.name ?? '';

    const goToFactor = (factorId: number) => {
        const factor = factors.find((item) => item.factor_id === factorId);
        if (!factor) return;
        setActiveTab(factor.dimension);
        window.setTimeout(() => {
            document.getElementById(`factor-${factorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    };

    useEffect(() => {
        if (evaluation) document.title = `${evaluation.software_name} · Evaluación GUIOS`;
    }, [evaluation]);

    if (loadStatus === 'no_access') return <EvaluationUnavailable />;
    if (loadStatus === 'error') return <EvaluationUnavailable error />;
    if (!evaluation || evaluation.uuid !== uuid || loadStatus !== 'ready') return <Loading label="Cargando evaluación..." />;
    if (readOnly) return <Navigate to={`/evaluacion/${uuid}/resultados`} replace />;

    const handleGenerate = async () => {
        const outcome = await generateVerdict();
        setConfirmOpen(false);
        if (outcome === 'ok' || outcome === 'locked') navigate(`/evaluacion/${uuid}/resultados`);
    };

    const canGenerate = Boolean(summary?.is_complete) && saveStatus !== 'saving' && saveStatus !== 'error';
    // Asistencia de IA: solo si el servidor la tiene y la evaluación se registró con ella (RF-IA-01).
    const aiOn = aiAvailable && evaluation.ai_enabled;
    const aiFor = (factorId: number) => (aiOn ? {
        dismissed: dismissedSuggestions,
        busyRatings: aiBusy.includes(`ratings:${factorId}`),
        onDismiss: dismissSuggestion,
        onSuggestRatings: suggestRatings,
        onAcceptAll: acceptAllRatings,
    } : undefined);
    const busyImportance = aiBusy.includes('importance');

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Estación de evaluación</p>
                    <h1 className="truncate text-xl font-bold">
                        {evaluation.software_name}
                        {evaluation.software_version && <span className="font-medium text-[var(--color-text-secondary)]"> {evaluation.software_version}</span>}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">{evaluation.org_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <SaveIndicator status={saveStatus} onRetry={retryFailed} />
                    <button type="button" onClick={() => setHelp('importance')} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                        <HelpCircle size={14} aria-hidden /> Importancia
                    </button>
                    <button type="button" onClick={() => setHelp('rating')} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                        <HelpCircle size={14} aria-hidden /> Calificación
                    </button>
                </div>
            </div>

            {aiError && <Alert type="warning" title="Asistencia de IA" message={aiError} onClose={clearAiError} />}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                    {aiOn && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-dashed border-[var(--color-info)] bg-[var(--color-info-bg)] p-3">
                            <p className="text-xs text-[var(--color-info-text)]">
                                La IA puede sugerir la importancia de cada factor. Las sugerencias son orientativas:
                                nada se guarda hasta que usted las acepta o elige otro valor.
                            </p>
                            <Button size="sm" variant="info" icon={Sparkles} isLoading={busyImportance} onClick={() => suggestImportance()}>
                                {busyImportance ? 'La IA está sugiriendo…' : 'Sugerir con IA'}
                            </Button>
                        </div>
                    )}
                    <DimensionTabs tabs={dimensions} active={currentTab} onChange={setActiveTab} />
                    <div id="dimension-panel" role="tabpanel" aria-labelledby={`tab-${currentTab}`} className="space-y-4">
                        {factors.filter((factor) => factor.dimension === currentTab).map((factor) => (
                            <FactorCard
                                key={factor.factor_id}
                                factor={factor}
                                summary={summaryById.get(factor.factor_id)}
                                readOnly={readOnly}
                                onDecisorImportance={setDecisorImportance}
                                onScope={setScope}
                                onRating={setRating}
                                ai={aiFor(factor.factor_id)}
                            />
                        ))}
                    </div>
                </div>
                <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
                    <ProgressPanel factors={factors} summary={summary} onGoTo={goToFactor} />
                    <Button
                        className="w-full"
                        icon={FileCheck2}
                        disabled={!canGenerate}
                        onClick={() => setConfirmOpen(true)}
                        title={canGenerate ? undefined : 'Complete los pendientes para generar el dictamen'}
                    >
                        Generar dictamen
                    </Button>
                    {!summary?.is_complete && (
                        <p className="text-center text-xs text-[var(--color-text-tertiary)]">
                            Se habilita cuando no falte nada por evaluar.
                        </p>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleGenerate}
                isLoading={isGenerating}
                variant="info"
                title="Generar el dictamen"
                message="Al generar el dictamen, la evaluación se cierra y ya no se puede modificar. Para corregirla después tendrá que duplicarla."
                confirmText="Generar dictamen"
                cancelText="Seguir revisando"
            />
            {help && (
                <GenericHelpModal isOpen onClose={() => setHelp(null)} footerText="Ayuda metodológica GUIOS" {...HELP[help]} />
            )}
        </div>
    );
};

export default StationPage;
