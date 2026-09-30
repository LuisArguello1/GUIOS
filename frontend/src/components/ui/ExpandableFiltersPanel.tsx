import { memo, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter, X } from 'lucide-react';
import Button from './Button';

interface ExpandableFiltersPanelProps {
    sectionTitle?: string;
    panelTitle?: string;
    activeAppliedFilters?: number;
    hasDraftChanges?: boolean;
    showFilters: boolean;
    onToggle: () => void;
    onClear: () => void;
    onApply: () => void;
    applyDisabled?: boolean;
    clearDisabled?: boolean;
    contentClassName?: string;
    panelClassName?: string;
    activeFiltersText?: string;
    pendingChangesLabel?: string;
    showFiltersLabel?: string;
    hideFiltersLabel?: string;
    clearLabel?: string;
    applyLabel?: string;
    children: ReactNode;
}

const ExpandableFiltersPanel = ({
    sectionTitle,
    panelTitle = 'Panel de filtros',
    activeAppliedFilters = 0,
    hasDraftChanges = false,
    showFilters,
    onToggle,
    onClear,
    onApply,
    applyDisabled = false,
    clearDisabled = false,
    contentClassName,
    panelClassName,
    activeFiltersText,
    pendingChangesLabel = 'Cambios sin aplicar',
    showFiltersLabel = 'Mostrar',
    hideFiltersLabel = 'Ocultar',
    clearLabel = 'Limpiar',
    applyLabel = 'Aplicar filtros',
    children,
}: ExpandableFiltersPanelProps) => {
    const computedActiveFiltersText =
        activeFiltersText ??
        (activeAppliedFilters > 0
            ? `${activeAppliedFilters} filtro${activeAppliedFilters > 1 ? 's' : ''} activo${activeAppliedFilters > 1 ? 's' : ''}`
            : 'Sin filtros activos');

    return (
        <section className="select-none">
            {sectionTitle && (
                <p className="text-[12px] font-bold text-[var(--color-text-secondary)] px-1 mb-1.5">
                    {sectionTitle}
                </p>
            )}

            <div
                className={clsx(
                    'rounded-[8px] border border-[var(--color-border-subtle)] overflow-hidden',
                    'bg-[var(--color-bg-elevated)]',
                    'transition-shadow duration-150',
                    showFilters && 'shadow-sm',
                    panelClassName,
                )}
            >
                {/* ── Header bar ── */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/40">
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Icono con badge */}
                        <div className="relative w-6 h-6 rounded-[4px] bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                            <Filter size={12} className="text-[var(--color-text-secondary)]" />
                            {activeAppliedFilters > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--color-primary)] text-[var(--color-text-on-primary)] text-[9px] font-bold grid place-items-center leading-none">
                                    {activeAppliedFilters}
                                </span>
                            )}
                        </div>

                        <span className="text-[12px] font-bold text-[var(--color-text-primary)] tracking-tight">
                            {panelTitle}
                        </span>

                        {hasDraftChanges && (
                            <span className="hidden sm:inline text-[10px] font-semibold text-[var(--color-warning-text)] bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 px-1.5 py-0.5 rounded-[4px]">
                                {pendingChangesLabel}
                            </span>
                        )}
                    </div>

                    <Button
                        variant={showFilters ? 'primary' : 'secondary'}
                        size="sm"
                        icon={Filter}
                        onClick={onToggle}
                        className="h-[28px] rounded-[4px] px-2.5 text-[11px] font-bold"
                    >
                        {showFilters ? hideFiltersLabel : showFiltersLabel}
                    </Button>
                </div>

                {/* ── Panel expandible ── */}
                <AnimatePresence initial={false}>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="overflow-hidden"
                        >
                            <div
                                className={clsx(
                                    'bg-[var(--color-bg-secondary)]/20 p-3',
                                    contentClassName,
                                )}
                            >
                                {children}
                            </div>

                            {/* ── Footer de acciones ── */}
                            <div className="px-3.5 py-2 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2 bg-[var(--color-bg-secondary)]/30">
                                <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">
                                    {computedActiveFiltersText}
                                </span>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={X}
                                        onClick={onClear}
                                        disabled={clearDisabled}
                                        className="h-[28px] rounded-[4px] px-2.5 text-[11px] font-bold"
                                    >
                                        {clearLabel}
                                    </Button>

                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={onApply}
                                        disabled={applyDisabled}
                                        className="h-[28px] rounded-[4px] px-3.5 text-[11px] font-bold"
                                    >
                                        {applyLabel}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
};

export default memo(ExpandableFiltersPanel);