import { clsx } from 'clsx';
import type { EvaluationStatus, Recommendation } from '../../../api/guiosPublicService';

export const StatusBadge = ({ status }: { status: EvaluationStatus }) => (
    <span className={clsx(
        'inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold',
        status === 'completed'
            ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
            : 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
    )}>
        {status === 'completed' ? 'Con dictamen' : 'En progreso'}
    </span>
);

const LETTER_TONE: Record<Recommendation, string> = {
    A: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
    B: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
    C: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
};

export const RecommendationBadge = ({ value }: { value: Recommendation | null }) => (
    value
        ? <span className={clsx('inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold', LETTER_TONE[value])}>Dictamen {value}</span>
        : <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
);
