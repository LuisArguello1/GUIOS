import { memo } from 'react';
import { Sparkles } from 'lucide-react';

interface AiReportProps {
    summary: string;
    mitigation: string;
    actions?: React.ReactNode;
}

const Block = ({ title, text }: { title: string; text: string }) => (
    <div>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h3>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-primary)]">{text}</p>
    </div>
);

/**
 * Resumen ejecutivo y plan de mitigación de la IA (RF-IA-04), separados del
 * dictamen matemático y marcados como orientativos.
 */
const AiReport = ({ summary, mitigation, actions }: AiReportProps) => (
    <section aria-labelledby="ai-report-title"
        className="rounded-[6px] border border-dashed border-[var(--color-info)] bg-[var(--color-bg-primary)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className="inline-flex items-center gap-1.5 rounded-[4px] bg-[var(--color-info-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-info-text)]">
                    <Sparkles size={12} aria-hidden /> Generado por IA · orientativo
                </p>
                <h2 id="ai-report-title" className="mt-2 text-base font-bold text-[var(--color-text-primary)]">
                    Informe complementario de la IA
                </h2>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                    No cambia el dictamen: este lo calcula solo el motor de GUIOS.
                </p>
            </div>
            {actions}
        </div>
        {summary && (
            <div className="mt-4 space-y-4">
                <Block title="Resumen ejecutivo" text={summary} />
                {mitigation && <Block title="Plan de mitigación" text={mitigation} />}
            </div>
        )}
    </section>
);

export default memo(AiReport);
