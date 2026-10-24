/**
 * api/dimensionService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa HTTP para el CRUD de Dimensiones de la metodología GUIOS.
 * Se comunica exclusivamente con /api/v1/guios/dimensions/ vía ENDPOINTS.
 */

import api from './axios';
import { ENDPOINTS } from './endpoints';

export interface DimensionFactorSummary {
    id: number;
    name: string;
    scope: 'internal' | 'external';
    scope_configurable: boolean;
    systemic_importance: number;
    expert_importance: number;
    literature_importance_base: number;
    order: number;
    is_active: boolean;
}

export interface Dimension {
    id: number;
    name: string;
    description: string;
    order: number;
    is_base: boolean;
    factors_count: number;
    created_at: string;
    updated_at: string;
}

export interface DimensionDetail extends Dimension {
    factors: DimensionFactorSummary[];
}

export interface DimensionInput {
    name: string;
    description?: string;
    order?: number;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface DimensionQueryParams {
    search?: string;
    is_base?: boolean;
    page?: number;
    page_size?: number;
}

const dimensionService = {
    /**
     * Obtiene el listado de dimensiones ordenadas con conteo de factores.
     * Soporta tanto respuesta paginada de DRF como array directo.
     */
    getAll: async (params: DimensionQueryParams = {}): Promise<PaginatedResponse<Dimension>> => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
        const response = await api.get<PaginatedResponse<Dimension> | Dimension[]>(ENDPOINTS.GUIOS.DIMENSIONS, {
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
     * Obtiene el detalle de una dimensión incluyendo la lista de sus factores asociados.
     */
    getById: async (id: number | string): Promise<DimensionDetail> => {
        const response = await api.get<DimensionDetail>(ENDPOINTS.GUIOS.DIMENSION_DETAIL(id));
        return response.data;
    },

    /**
     * Registra una nueva dimensión en el catálogo.
     */
    create: async (data: DimensionInput): Promise<DimensionDetail> => {
        const response = await api.post<DimensionDetail>(ENDPOINTS.GUIOS.DIMENSIONS, data);
        return response.data;
    },

    /**
     * Actualización total (PUT).
     */
    update: async (id: number | string, data: DimensionInput): Promise<DimensionDetail> => {
        const response = await api.put<DimensionDetail>(ENDPOINTS.GUIOS.DIMENSION_DETAIL(id), data);
        return response.data;
    },

    /**
     * Actualización parcial (PATCH).
     */
    partialUpdate: async (id: number | string, data: Partial<DimensionInput>): Promise<DimensionDetail> => {
        const response = await api.patch<DimensionDetail>(ENDPOINTS.GUIOS.DIMENSION_DETAIL(id), data);
        return response.data;
    },

    /**
     * Elimina una dimensión personalizada que no contenga factores asociados.
     */
    delete: async (id: number | string): Promise<void> => {
        await api.delete(ENDPOINTS.GUIOS.DIMENSION_DETAIL(id));
    },
};

export default dimensionService;
