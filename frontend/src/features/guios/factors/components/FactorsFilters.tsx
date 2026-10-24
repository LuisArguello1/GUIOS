import React, { memo } from 'react';
import { Search, X, Layers, Compass } from 'lucide-react';
import { clsx } from 'clsx';
import type { FactorQueryParams } from '../../../../api/factorService';
import type { Dimension } from '../../../../api/dimensionService';

interface FactorsFiltersProps {
    filters: FactorQueryParams;
    dimensions: Dimension[];
    onChange: (filters: Partial<FactorQueryParams>) => void;
    onReset: () => void;
    totalCount: number;
}

export const FactorsFilters: React.FC<FactorsFiltersProps> = ({
    filters,
    dimensions,
    onChange,
    onReset,
    totalCount,
}) => {
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ search: e.target.value });
    };

    const handleDimensionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        onChange({ dimension: val ? Number(val) : undefined });
    };

    const handleScopeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        onChange({ scope: val || undefined });
    };

    const handleBaseFilterChange = (isBaseValue: boolean | undefined) => {
        onChange({ is_base: isBaseValue });
    };

    const hasActiveFilters =
        !!filters.search ||
        filters.dimension !== undefined ||
        filters.scope !== undefined ||
        filters.is_base !== undefined;

    return (
        <div className="flex flex-col gap-2.5 p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px]">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
                {/* Buscador de texto */}
                <div className="relative flex-1 min-w-[220px]">
                    <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"
                    />
                    <input
                        type="text"
                        value={filters.search || ''}
                        onChange={handleSearchChange}
                        placeholder="Buscar factor por nombre..."
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

                {/* Filtro por Dimensión */}
                <div className="flex items-center gap-1.5 min-w-[180px]">
                    <Layers size={14} className="text-[var(--color-text-secondary)] shrink-0 hidden sm:inline" />
                    <select
                        value={filters.dimension !== undefined ? String(filters.dimension) : ''}
                        onChange={handleDimensionChange}
                        className="w-full py-1.5 px-2 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                    >
                        <option value="">Todas las dimensiones</option>
                        {dimensions.map((dim) => (
                            <option key={dim.id} value={dim.id}>
                                #{dim.order} {dim.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Filtro por Ámbito / Alcance */}
                <div className="flex items-center gap-1.5 min-w-[150px]">
                    <Compass size={14} className="text-[var(--color-text-secondary)] shrink-0 hidden sm:inline" />
                    <select
                        value={filters.scope || ''}
                        onChange={handleScopeChange}
                        className="w-full py-1.5 px-2 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                    >
                        <option value="">Todos los alcances</option>
                        <option value="external">Externo (Software)</option>
                        <option value="internal">Interno (Org)</option>
                        <option value="both">Ambos</option>
                    </select>
                </div>

                {/* Segmented pill para tipo de catálogo */}
                <div className="inline-flex rounded-[2px] p-0.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-xs self-start lg:self-auto">
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
                        Todos
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
                        Base Oficial
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
                        Personalizados
                    </button>
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="px-2 py-1 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] cursor-pointer flex items-center gap-1 transition-colors self-center"
                        title="Restablecer filtros"
                    >
                        <X size={12} />
                        <span>Limpiar</span>
                    </button>
                )}

                <div className="pl-2 border-l border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap hidden sm:block">
                    <span className="font-mono font-bold text-[var(--color-text-primary)]">{totalCount}</span> {totalCount === 1 ? 'factor' : 'factores'}
                </div>
            </div>
        </div>
    );
};

export default memo(FactorsFilters);
