import React, { memo, useMemo } from 'react';
import { Search, X, Layers, Sliders, ListFilter } from 'lucide-react';
import { clsx } from 'clsx';
import type { SubfactorQueryParams } from '../../../../api/subfactorService';
import type { Dimension } from '../../../../api/dimensionService';
import type { Factor } from '../../../../api/factorService';

interface SubfactorsFiltersProps {
    filters: SubfactorQueryParams;
    dimensions: Dimension[];
    factors: Factor[];
    onChange: (filters: Partial<SubfactorQueryParams>) => void;
    onReset: () => void;
    totalCount: number;
}

export const SubfactorsFilters: React.FC<SubfactorsFiltersProps> = ({
    filters,
    dimensions,
    factors,
    onChange,
    onReset,
    totalCount,
}) => {
    // Si hay una dimensión seleccionada, filtrar la lista desplegable de factores
    const filteredFactorOptions = useMemo(() => {
        if (!filters.dimension) return factors;
        return factors.filter((f) => f.dimension?.id === Number(filters.dimension));
    }, [factors, filters.dimension]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ search: e.target.value });
    };

    const handleDimensionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        // Al cambiar de dimensión, resetear el filtro de factor si ya no pertenece
        onChange({
            dimension: val ? Number(val) : undefined,
            factor: undefined,
        });
    };

    const handleFactorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        onChange({ factor: val ? Number(val) : undefined });
    };

    const handleBaseFilterChange = (isBaseValue: boolean | undefined) => {
        onChange({ is_base: isBaseValue });
    };

    const handleActiveFilterChange = (isActiveValue: boolean | undefined) => {
        onChange({ is_active: isActiveValue });
    };

    const hasActiveFilters =
        !!filters.search ||
        filters.dimension !== undefined ||
        filters.factor !== undefined ||
        filters.is_base !== undefined ||
        filters.is_active !== undefined;

    return (
        <div className="flex flex-col gap-2.5 p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px]">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
                {/* Buscador de texto */}
                <div className="relative flex-1 min-w-[240px]">
                    <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"
                    />
                    <input
                        type="text"
                        value={filters.search || ''}
                        onChange={handleSearchChange}
                        placeholder="Buscar por afirmación, palabras clave o factor..."
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
                <div className="flex items-center gap-1.5 min-w-[170px]">
                    <Layers size={14} className="text-[var(--color-text-secondary)] shrink-0 hidden sm:inline" />
                    <select
                        value={filters.dimension !== undefined ? String(filters.dimension) : ''}
                        onChange={handleDimensionChange}
                        className="w-full py-1.5 px-2 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                    >
                        <option value="">Todas las Dimensiones</option>
                        {dimensions.map((d) => (
                            <option key={d.id} value={d.id}>
                                #{d.order} {d.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Filtro por Factor */}
                <div className="flex items-center gap-1.5 min-w-[180px]">
                    <Sliders size={14} className="text-[var(--color-text-secondary)] shrink-0 hidden sm:inline" />
                    <select
                        value={filters.factor !== undefined ? String(filters.factor) : ''}
                        onChange={handleFactorChange}
                        className="w-full py-1.5 px-2 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                    >
                        <option value="">Todos los Factores</option>
                        {filteredFactorOptions.map((f) => (
                            <option key={f.id} value={f.id}>
                                #{f.order} {f.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Reset button */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)] bg-[var(--color-bg-page)] border border-[var(--color-border-default)] hover:border-[var(--color-danger-border)] rounded-[2px] transition-colors shrink-0"
                    >
                        <X size={13} />
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* Fila secundaria: Catálogo, Estado y Resultados */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Botones de origen de catálogo */}
                    <div className="inline-flex items-center p-0.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[2px] text-xs">
                        <button
                            type="button"
                            onClick={() => handleBaseFilterChange(undefined)}
                            className={clsx(
                                'px-2 py-0.5 font-medium rounded-[2px] transition-colors',
                                filters.is_base === undefined
                                    ? 'bg-[var(--color-primary)] text-white font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => handleBaseFilterChange(true)}
                            className={clsx(
                                'px-2 py-0.5 font-medium rounded-[2px] transition-colors',
                                filters.is_base === true
                                    ? 'bg-[var(--color-primary)] text-white font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                        >
                            Base Oficial
                        </button>
                        <button
                            type="button"
                            onClick={() => handleBaseFilterChange(false)}
                            className={clsx(
                                'px-2 py-0.5 font-medium rounded-[2px] transition-colors',
                                filters.is_base === false
                                    ? 'bg-[var(--color-primary)] text-white font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                        >
                            Personalizados
                        </button>
                    </div>

                    {/* Filtro de Estado Activo/Inactivo */}
                    <div className="inline-flex items-center p-0.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[2px] text-xs">
                        <button
                            type="button"
                            onClick={() => handleActiveFilterChange(undefined)}
                            className={clsx(
                                'px-2 py-0.5 font-medium rounded-[2px] transition-colors',
                                filters.is_active === undefined
                                    ? 'bg-[var(--color-primary)] text-white font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                        >
                            Todos los estados
                        </button>
                        <button
                            type="button"
                            onClick={() => handleActiveFilterChange(true)}
                            className={clsx(
                                'px-2 py-0.5 font-medium rounded-[2px] transition-colors',
                                filters.is_active === true
                                    ? 'bg-[var(--color-primary)] text-white font-semibold'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                        >
                            Solo Activos
                        </button>
                    </div>
                </div>

                {/* Contador de resultados */}
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    <ListFilter size={13} className="text-[var(--color-primary)]" />
                    <span>
                        Mostrando <strong className="font-mono text-[var(--color-text-primary)]">{totalCount}</strong> subfactor(es)
                    </span>
                </div>
            </div>
        </div>
    );
};

export default memo(SubfactorsFilters);
