import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown } from 'lucide-react';
import AccessDenied from '../../components/ui/AccessDenied';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import PermissionGuard from '../../components/ui/PermissionGuard';
import Skeleton from '../../components/ui/Skeleton';
import { useEvaluationDetail } from '../../hooks/useEvaluationsAdmin';
import usePermissions from '../../hooks/usePermissions';
import AiReport from '../evaluation/components/AiReport';
import FactorsTable from '../evaluation/components/FactorsTable';
import FodaMatrix from '../evaluation/components/FodaMatrix';
import VerdictCard from '../evaluation/components/VerdictCard';
import { toFactorSummary, toVerdict } from './adapters';
import AiSuggestionsSummary from './components/AiSuggestionsSummary';
import SubfactorRatings from './components/SubfactorRatings';
import { StatusBadge } from './components/StatusBadges';

const MISSING_TEXT: Record<string, string> = {
    decisor_importance: 'falta la ID',
    scope: 'falta elegir el ámbito',
    subfactor_rating: 'faltan subfactores por calificar',
};

const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : '—';

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5 border-b border-[var(--color-border-subtle)] py-1.5 text-xs sm:flex-row sm:justify-between">
        <dt className="text-[var(--color-text-tertiary)]">{label}</dt>
        <dd className="font-medium text-[var(--color-text-primary)] sm:text-right">{value || '—'}</dd>
    </div>
);

/** Detalle de solo lectura de una evaluación (RF-ADM-35) con exportación a PDF. */
const EvaluationDetailPage = () => {
    const { uuid } = useParams();
    const { has } = usePermissions();
    const { detail, error, exportPdf, isExporting } = useEvaluationDetail(has('evaluations.view') ? uuid : undefined);

    if (!has('evaluations.view')) {
        return <AccessDenied message="No tiene permiso para ver las evaluaciones de GUIOS (evaluations.view)." />;
    }

    const back = (
        <Link to="/dashboard/evaluaciones" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
            <ArrowLeft size={14} aria-hidden /> Volver al historial
        </Link>
    );

    if (error) return <div className="space-y-3 p-3 md:p-5">{back}<Alert type="error" message={error} /></div>;
    if (!detail) return <div className="space-y-3 p-3 md:p-5">{back}<Skeleton height={420} /></div>;

    const { evaluation, verdict } = detail;
    const factors = detail.factors.map(toFactorSummary);
    const missingFactors = new Map<number, Set<string>>();
    detail.missing.forEach((m) => missingFactors.set(m.factor_id, (missingFactors.get(m.factor_id) ?? new Set()).add(m.kind)));

    return (
        <div className="space-y-5 p-3 md:p-5">
            {back}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Detalle de evaluación</p>
                    <h1 className="truncate text-xl font-bold text-[var(--color-text-primary)]">
                        {evaluation.software_name}
                        {evaluation.software_version && <span className="font-medium text-[var(--color-text-secondary)]"> {evaluation.software_version}</span>}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">{evaluation.org_name}</p>
                </div>
                <div className="flex items-center gap-2">
                    <StatusBadge status={evaluation.status} />
                    <PermissionGuard require="evaluations.export">
                        <Button variant="outline" icon={FileDown} isLoading={isExporting} onClick={exportPdf}>PDF</Button>
                    </PermissionGuard>
                </div>
            </div>

            <Alert
                type="info"
                title="Solo lectura"
                message={detail.results_source === 'stored'
                    ? 'Resultados y dictamen guardados al emitir el dictamen. Los nombres y textos son los del momento de la evaluación.'
                    : 'Evaluación en progreso: los valores se calculan con el motor a partir de lo guardado hasta ahora. Todavía no hay dictamen.'}
            />

            <section aria-labelledby="data-title" className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4">
                <h2 id="data-title" className="mb-2 text-base font-bold text-[var(--color-text-primary)]">Software y organización</h2>
                <dl>
                    <Field label="Repositorio" value={evaluation.software_repo_url} />
                    <Field label="Sector" value={evaluation.org_sector} />
                    <Field label="Descripción" value={evaluation.org_description} />
<Field label="Asistencia de IA" value={evaluation.ai_enabled ? 'Activada' : 'No activada'} />
                    <Field label="Inicio" value={formatDate(evaluation.started_at)} />
                    <Field label="Dictamen emitido" value={formatDate(evaluation.completed_at)} />
                    <Field label="Identificador" value={<span className="font-mono">{evaluation.uuid}</span>} />
                </dl>
            </section>

            {verdict ? (
                <>
                    <VerdictCard verdict={toVerdict(verdict)} />
                    {verdict.ai_executive_summary && (
                        <AiReport summary={verdict.ai_executive_summary} mitigation={verdict.ai_mitigation_plan} />
                    )}
                </>
            ) : (
                <Alert type="warning" title={`Pendientes (${detail.missing.length})`}
                    message={detail.missing.length === 0
                        ? 'No falta nada: el evaluador puede generar el dictamen.'
                        : [...missingFactors.entries()].map(([id, kinds]) => {
                            const name = detail.missing.find((m) => m.factor_id === id)?.factor_name;
                            return `${name}: ${[...kinds].map((k) => MISSING_TEXT[k] ?? k).join(', ')}`;
                        }).join(' · ')} />
            )}

            <FodaMatrix factors={factors} />
            <FactorsTable factors={factors} />
            <SubfactorRatings factors={detail.factors} />
            <AiSuggestionsSummary factors={detail.factors} />
        </div>
    );
};

export default EvaluationDetailPage;
