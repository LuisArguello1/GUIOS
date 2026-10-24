import { memo } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertTriangle, PauseCircle } from 'lucide-react';
import type { Verdict } from '../../../api/guiosPublicService';
import { RECOMMENDATION_TITLES } from '../labels';

const TONE = {
    A: { icon: CheckCircle2, box: 'border-[var(--color-success)]/40 bg-[var(--color-success-bg)]', text: 'text-[var(--color-success-text)]' },
    B: { icon: AlertTriangle, box: 'border-[var(--color-warning)]/40 bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning-text)]' },
    C: { icon: PauseCircle, box: 'border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)]', text: 'text-[var(--color-danger-text)]' },
};

/** Dictamen del motor matemático con su texto personalizado (no lo decide la IA). */
const VerdictCard = ({ verdict }: { verdict: Verdict }) => {
    const tone = TONE[verdict.recommendation];
    const Icon = tone.icon;
    return (
        <section aria-labelledby="verdict-title" className={clsx('rounded-[6px] border p-5', tone.box)}>
            <div className="flex items-start gap-3">
                <Icon size={28} className={tone.text} aria-hidden />
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Dictamen</p>
                    <h2 id="verdict-title" className={clsx('text-xl font-bold', tone.text)}>
                        Recomendación {verdict.recommendation}: {RECOMMENDATION_TITLES[verdict.recommendation]}
                    </h2>
                </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-primary)]">
                {verdict.explanation_text}
            </p>
        </section>
    );
};

export default memo(VerdictCard);
