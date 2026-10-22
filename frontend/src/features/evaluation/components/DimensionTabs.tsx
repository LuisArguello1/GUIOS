import { memo } from 'react';
import { clsx } from 'clsx';

export interface DimensionTab {
    name: string;
    total: number;
    pending: number;
}

interface DimensionTabsProps {
    tabs: DimensionTab[];
    active: string;
    onChange: (name: string) => void;
}

/** Pestañas por dimensión con el número de pendientes (texto, no solo color). */
const DimensionTabs = ({ tabs, active, onChange }: DimensionTabsProps) => (
    <div role="tablist" aria-label="Dimensiones" className="flex flex-wrap gap-1 border-b border-[var(--color-border-subtle)]">
        {tabs.map((tab) => {
            const selected = tab.name === active;
            return (
                <button
                    key={tab.name}
                    type="button"
                    role="tab"
                    id={`tab-${tab.name}`}
                    aria-selected={selected}
                    aria-controls="dimension-panel"
                    onClick={() => onChange(tab.name)}
                    className={clsx(
                        '-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
                        selected
                            ? 'border-[var(--color-primary)] text-[var(--color-text-primary)]'
                            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                    )}
                >
                    {tab.name}
                    <span className="ml-1.5 text-xs font-medium text-[var(--color-text-tertiary)]">
                        ({tab.total} factores{tab.pending > 0 ? ` · ${tab.pending} pendientes` : ' · completa'})
                    </span>
                </button>
            );
        })}
    </div>
);

export default memo(DimensionTabs);
