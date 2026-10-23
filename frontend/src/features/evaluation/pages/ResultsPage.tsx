import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Copy, HelpCircle, Sparkles } from 'lucide-react';
import Alert from '../../../components/ui/Alert';
import Button from '../../../components/ui/Button';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import GenericHelpModal from '../../../components/ui/GenericHelpModal';
import Loading from '../../../components/ui/Loading';
import useEvaluation from '../../../hooks/useEvaluation';
import AiReport from '../components/AiReport';
import EvaluationUnavailable from '../components/EvaluationUnavailable';
import FactorsTable from '../components/FactorsTable';
import FodaMatrix from '../components/FodaMatrix';
import VerdictCard from '../components/VerdictCard';
import { HELP } from '../components/helpContent';

/** Resultados (Pasos 5 y 6): dictamen, matriz FODA y tabla de factores. Solo lectura. */
const ResultsPage = () => {
    const { uuid } = useParams();
    const navigate = useNavigate();
    const {
        evaluation, summary, loadStatus, duplicate, aiAvailable, aiBusy, aiError, generateAiReport, clearAiError,
    } = useEvaluation(uuid);
    const [helpOpen, setHelpOpen] = useState(false);
    const [confirmRegenerate, setConfirmRegenerate] = useState(false);
    const [duplicating, setDuplicating] = useState(false);

    useEffect(() => {
        if (evaluation) document.title = `Resultados · ${evaluation.software_name}`;
    }, [evaluation]);

    if (loadStatus === 'no_access') return <EvaluationUnavailable />;
    if (loadStatus === 'error') return <EvaluationUnavailable error />;
    if (!evaluation || evaluation.uuid !== uuid || loadStatus !== 'ready' || !summary) {
        return <Loading label="Cargando resultados..." />;
    }
    if (evaluation.status !== 'completed' || !evaluation.verdict) {
        return <Navigate to={`/evaluacion/${uuid}`} replace />;
    }

    const aiOn = aiAvailable && evaluation.ai_enabled;
    const hasReport = Boolean(evaluation.verdict.ai_executive_summary);
    const reportBusy = aiBusy.includes('report');

    const handleRegenerate = async () => {
        await generateAiReport();
        setConfirmRegenerate(false);
    };

    const handleDuplicate = async () => {
        setDuplicating(true);
        const copyUuid = await duplicate();
        setDuplicating(false);
        if (copyUuid) navigate(`/evaluacion/${copyUuid}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Resultados</p>
                    <h1 className="truncate text-xl font-bold">
                        {evaluation.software_name}
                        {evaluation.software_version && <span className="font-medium text-[var(--color-text-secondary)]"> {evaluation.software_version}</span>}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        {evaluation.org_name}
                        {evaluation.completed_at && ` · ${new Date(evaluation.completed_at).toLocaleString('es-EC')}`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                        <HelpCircle size={14} aria-hidden /> ¿Cómo leer los resultados?
                    </button>
                    <Button variant="outline" icon={Copy} isLoading={duplicating} onClick={handleDuplicate}>
                        Duplicar
                    </Button>
                </div>
            </div>

            <Alert
                type="info"
                title="Evaluación cerrada (solo lectura)"
                message="El dictamen ya se emitió y no se puede modificar. Para corregir algo, use «Duplicar»: se crea una copia con todos sus valores que puede editar."
            />

            <VerdictCard verdict={evaluation.verdict} />
            {aiError && <Alert type="warning" title="Asistencia de IA" message={aiError} onClose={clearAiError} />}
            {(aiOn || hasReport) && (
                <AiReport
                    summary={evaluation.verdict.ai_executive_summary}
                    mitigation={evaluation.verdict.ai_mitigation_plan}
                    actions={aiOn && (
                        <Button
                            variant={hasReport ? 'outline' : 'info'}
                            size="sm"
                            icon={Sparkles}
                            isLoading={reportBusy && !confirmRegenerate}
                            onClick={() => (hasReport ? setConfirmRegenerate(true) : generateAiReport())}
                        >
                            {reportBusy ? 'La IA está redactando…' : hasReport ? 'Regenerar' : 'Generar resumen con IA'}
                        </Button>
                    )}
                />
            )}
            <FodaMatrix factors={summary.factors} />
            <FactorsTable factors={summary.factors} />

            <Link to="/" className="inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline">
                Volver al inicio
            </Link>
            <ConfirmModal
                isOpen={confirmRegenerate}
                onClose={() => setConfirmRegenerate(false)}
                onConfirm={handleRegenerate}
                isLoading={reportBusy}
                variant="info"
                title="Regenerar el informe de la IA"
                message="Se pedirá a la IA un nuevo resumen ejecutivo y plan de mitigación, que reemplazarán a los actuales. El dictamen no cambia."
                confirmText="Regenerar"
                cancelText="Cancelar"
            />
            <GenericHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} footerText="Ayuda metodológica GUIOS" {...HELP.results} />
        </div>
    );
};

export default ResultsPage;
