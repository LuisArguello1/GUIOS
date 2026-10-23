import { memo } from 'react';
import { clsx } from 'clsx';
import { importanceLabel } from '../../evaluation/labels';

type Tone = 'neutral' | 'primary' | 'warning' | 'info';

export const Badge = memo(function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
    return (
        <span className={clsx(
            'inline-flex items-center whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold',
            tone === 'neutral' && 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
            tone === 'primary' && 'bg-[var(--color-primary-soft-bg)] text-[var(--color-tag-text)]',
            tone === 'warning' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
            tone === 'info' && 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
        )}>
            {children}
        </span>
    );
});

/** IS en la escala 1–4 (sin pesos). */
export const ImportanceBadge = ({ value }: { value: number }) => (
    <Badge tone="primary">IS {value} · {importanceLabel(value)}</Badge>
);
