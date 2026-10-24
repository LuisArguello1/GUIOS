import React, { memo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import type { EvaluationQueryParams } from '../../../../api/evaluationService';

interface EvaluationsFiltersProps {
    filters: EvaluationQueryParams;
    onChange: (filters: Partial<EvaluationQueryParams>) => void;
    onReset: () => void;
    totalCount: number;
}

const CATEGORIES = [
    'Base de Datos',
    'Ofimática / Productividad',
    'ERP / Gestión Empresarial',
    'LMS / Educación',
    'Seguridad / Ciberseguridad',
    'Infraestructura / Servidores',
    'BI / Analítica de Datos',
    'Desarrollo / DevOps',
];

export const EvaluationsFilters: React.FC<EvaluationsFiltersProps> = ({
    filters,
    onChange,
    onReset,
    totalCount,
}) => {
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ search: e.target.value });
    };

    const hasActiveFilters = !!filters.search || !!filters.status || !!filters.category;

    return (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px]">
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
                    placeholder="Buscar por software, organización o categoría..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors"
                />
                {filters.search && (
                    <button
                        type="button"
                        onClick={() => onChange({ search: '' })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                        title="Limpiar búsqueda"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Selectores de estado y categoría */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Filtro por Estado */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] hidden sm:inline">
                        Estado:
                    </span>
                    <select
                        value={filters.status || ''}
                        onChange={(e) => onChange({ status: e.target.value || undefined })}
                        className="py-1.5 px-2 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                    >
                        <option value="">Todos los Estados</option>
                        <option value="in_progress">En Progreso</option>
                        <option value="completed">Completadas</option>
                    </select>
                </div>

                {/* Filtro por Categoría */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] hidden sm:inline">
                        Categoría:
                    </span>
                    <select
                        value={filters.category || ''}
                        onChange={(e) => onChange({ category: e.target.value || undefined })}
                        className="py-1.5 px-2 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer max-w-[170px]"
                    >
                        <option value="">Todas las Categorías</option>
                        {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Reset button */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] border border-transparent hover:border-[var(--color-danger-border)] rounded-[2px] transition-colors cursor-pointer"
                        title="Restablecer filtros"
                    >
                        <Filter size={12} />
                        <span>Limpiar</span>
                    </button>
                )}

                {/* Conteo total */}
                <div className="pl-2 border-l border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-tertiary)] font-mono whitespace-nowrap">
                    {totalCount} {totalCount === 1 ? 'evaluación' : 'evaluaciones'}
                </div>
            </div>
        </div>
    );
};

export default memo(EvaluationsFilters);
