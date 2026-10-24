/**
 * api/subfactorService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa HTTP para el CRUD de Subfactores de la metodología GUIOS.
 * Se comunica exclusivamente con /api/v1/guios/subfactors/ vía ENDPOINTS.
 */

import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { PaginatedResponse } from './dimensionService';

export interface FactorBrief {
    id: number;
    name: string;
    dimension_id: number;
    dimension_name: string;
    scope: 'internal' | 'external' | 'both';
    scope_display: string;
    is_base: boolean;
}

export interface Subfactor {
    id: number;
    factor: FactorBrief;
    description: string;
    base_citations_count: number;
    keywords_ia: string;
    order: number;
    is_base: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SubfactorInput {
    factor_id: number;
    description: string;
    base_citations_count?: number;
    keywords_ia?: string;
    order?: number;
    is_active?: boolean;
}

export interface SubfactorQueryParams {
    factor?: number | string;
    factor_id?: number | string;
    dimension?: number | string;
    dimension_id?: number | string;
    is_base?: boolean;
    is_active?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
}

const subfactorService = {
    /**
     * Obtiene el listado de subfactores filtrados por factor, dimensión o búsqueda.
     * Soporta respuesta paginada y array directo.
     */
    getAll: async (params: SubfactorQueryParams = {}): Promise<PaginatedResponse<Subfactor>> => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
        const response = await api.get<PaginatedResponse<Subfactor> | Subfactor[]>(
            ENDPOINTS.GUIOS.SUBFACTORS,
            { params: cleanParams }
        );

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
     * Obtiene el detalle de un subfactor individual.
     */
    getById: async (id: number | string): Promise<Subfactor> => {
        const response = await api.get<Subfactor>(ENDPOINTS.GUIOS.SUBFACTOR_DETAIL(id));
        return response.data;
    },

    /**
     * Crea un nuevo subfactor (criterio evaluable) asociado a un factor.
     */
    create: async (data: SubfactorInput): Promise<Subfactor> => {
        const response = await api.post<Subfactor>(ENDPOINTS.GUIOS.SUBFACTORS, data);
        return response.data;
    },

    /**
     * Actualización total (PUT).
     */
    update: async (id: number | string, data: SubfactorInput): Promise<Subfactor> => {
        const response = await api.put<Subfactor>(ENDPOINTS.GUIOS.SUBFACTOR_DETAIL(id), data);
        return response.data;
    },

    /**
     * Actualización parcial (PATCH).
     */
    partialUpdate: async (id: number | string, data: Partial<SubfactorInput>): Promise<Subfactor> => {
        const response = await api.patch<Subfactor>(ENDPOINTS.GUIOS.SUBFACTOR_DETAIL(id), data);
        return response.data;
    },

    /**
     * Elimina un subfactor personalizado que no pertenezca al catálogo base
     * ni esté referenciado en evaluaciones.
     */
    delete: async (id: number | string): Promise<void> => {
        await api.delete(ENDPOINTS.GUIOS.SUBFACTOR_DETAIL(id));
    },
};

export default subfactorService;
