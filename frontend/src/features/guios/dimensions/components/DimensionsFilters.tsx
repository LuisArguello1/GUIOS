import React, { memo } from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { DimensionQueryParams } from '../../../../api/dimensionService';

interface DimensionsFiltersProps {
    filters: DimensionQueryParams;
    onChange: (filters: Partial<DimensionQueryParams>) => void;
    onReset: () => void;
    totalCount: number;
}

export const DimensionsFilters: React.FC<DimensionsFiltersProps> = ({
    filters,
    onChange,
    onReset,
    totalCount,
}) => {
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ search: e.target.value });
    };

    const handleBaseFilterChange = (isBaseValue: boolean | undefined) => {
        onChange({ is_base: isBaseValue });
    };

    const hasActiveFilters = !!filters.search || filters.is_base !== undefined;

    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px]">
            {/* Buscador de texto */}
            <div className="relative flex-1 min-w-[240px]">
                <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"
                />
                <input
                    type="text"
                    value={filters.search || ''}
                    onChange={handleSearchChange}
                    placeholder="Buscar por nombre o descripción..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors"
                />
                {filters.search && (
                    <button
                        type="button"
                        onClick={() => onChange({ search: '' })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                        title="Limpiar búsqueda"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Selector de tipo de dimensión */}
            <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] hidden md:inline">
                    Tipo:
                </span>
                <div className="inline-flex rounded-[2px] p-0.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-xs">
                    <button
                        type="button"
                        onClick={() => handleBaseFilterChange(undefined)}
                        className={clsx(
                            'px-2.5 py-1 text-[11px] font-medium rounded-[2px] transition-all cursor-pointer',
                            filters.is_base === undefined
                                ? 'bg-[var(--color-primary)] text-white shadow-xs font-semibold'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        )}
                    >
                        Todas
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBaseFilterChange(true)}
                        className={clsx(
                            'px-2.5 py-1 text-[11px] font-medium rounded-[2px] transition-all cursor-pointer',
                            filters.is_base === true
                                ? 'bg-[var(--color-primary)] text-white shadow-xs font-semibold'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        )}
                    >
                        Base Tesis
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBaseFilterChange(false)}
                        className={clsx(
                            'px-2.5 py-1 text-[11px] font-medium rounded-[2px] transition-all cursor-pointer',
                            filters.is_base === false
                                ? 'bg-[var(--color-primary)] text-white shadow-xs font-semibold'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        )}
                    >
                        Personalizadas
                    </button>
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="px-2 py-1 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] cursor-pointer flex items-center gap-1 transition-colors"
                        title="Restablecer filtros"
                    >
                        <X size={12} />
                        <span className="hidden sm:inline">Limpiar</span>
                    </button>
                )}

                <div className="ml-2 pl-2 border-l border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap">
                    <span className="font-mono font-bold text-[var(--color-text-primary)]">{totalCount}</span> {totalCount === 1 ? 'dimensión' : 'dimensiones'}
                </div>
            </div>
        </div>
    );
};

export default memo(DimensionsFilters);
