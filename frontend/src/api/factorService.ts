/**
 * api/factorService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa HTTP para el CRUD de Factores de la metodología GUIOS.
 * Se comunica exclusivamente con /api/v1/guios/factors/ vía ENDPOINTS.
 */

import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { PaginatedResponse } from './dimensionService';

export type FactorScope = 'internal' | 'external' | 'both';

export interface DimensionBrief {
    id: number;
    name: string;
    order: number;
    is_base: boolean;
}

export interface SubfactorItem {
    id: number;
    description: string;
    base_citations_count: number;
    keywords_ia: string;
    order: number;
    is_base: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Factor {
    id: number;
    dimension: DimensionBrief;
    name: string;
    scope: FactorScope;
    scope_display: string;
    scope_configurable: boolean;
    expert_importance: number;
    literature_importance_base: number;
    systemic_importance: number;
    order: number;
    is_base: boolean;
    is_active: boolean;
    subfactors_count: number;
    created_at: string;
    updated_at: string;
}

export interface FactorDetail extends Factor {
    subfactors: SubfactorItem[];
}

export interface FactorInput {
    dimension_id: number;
    name: string;
    scope?: FactorScope;
    scope_configurable?: boolean;
    expert_importance?: number;
    literature_importance_base?: number;
    systemic_importance?: number | null;
    order?: number;
    is_active?: boolean;
}

export interface FactorQueryParams {
    dimension?: number | string;
    dimension_id?: number | string;
    scope?: string;
    is_base?: boolean;
    is_active?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
}

const factorService = {
    /**
     * Obtiene el listado de factores filtrados por dimensión, alcance, catálogo o búsqueda.
     * Soporta tanto respuesta paginada como array directo.
     */
    getAll: async (params: FactorQueryParams = {}): Promise<PaginatedResponse<Factor>> => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
        const response = await api.get<PaginatedResponse<Factor> | Factor[]>(ENDPOINTS.GUIOS.FACTORS, {
            params: cleanParams,
        });

        if (Array.isArray(response.data)) {
            return {
                count: response.data.length,
                next: null,
                previous: null,
                results: response.data,
            };
        }
        return response.data;
    },

    /**
     * Obtiene el detalle de un factor con sus subfactores pre-cargados.
     */
    getById: async (id: number | string): Promise<FactorDetail> => {
        const response = await api.get<FactorDetail>(ENDPOINTS.GUIOS.FACTOR_DETAIL(id));
        return response.data;
    },

    /**
     * Crea un nuevo factor en el catálogo.
     */
    create: async (data: FactorInput): Promise<FactorDetail> => {
        const response = await api.post<FactorDetail>(ENDPOINTS.GUIOS.FACTORS, data);
        return response.data;
    },

    /**
     * Actualización total (PUT).
     */
    update: async (id: number | string, data: FactorInput): Promise<FactorDetail> => {
        const response = await api.put<FactorDetail>(ENDPOINTS.GUIOS.FACTOR_DETAIL(id), data);
        return response.data;
    },

    /**
     * Actualización parcial (PATCH).
     */
    partialUpdate: async (id: number | string, data: Partial<FactorInput>): Promise<FactorDetail> => {
        const response = await api.patch<FactorDetail>(ENDPOINTS.GUIOS.FACTOR_DETAIL(id), data);
        return response.data;
    },

    /**
     * Elimina un factor personalizado sin subfactores ni evaluaciones.
     */
    delete: async (id: number | string): Promise<void> => {
        await api.delete(ENDPOINTS.GUIOS.FACTOR_DETAIL(id));
    },
};

export default factorService;
