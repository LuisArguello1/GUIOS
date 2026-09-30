import api from './axios';
import { ENDPOINTS } from './endpoints';

/**
 * Menu Module & Category Management Service
 */
const menuModuleService = {
    getTree: async () => {
        const { data } = await api.get(ENDPOINTS.CORE.MENU_TREE);
        return data;
    },

    updateCategory: async (id: number, payload: { name?: string; order?: number }) => {
        const { data } = await api.patch(ENDPOINTS.CORE.MENU_CATEGORIES.DETAIL(id), payload);
        return data;
    },

    updateModule: async (id: number, payload: { label?: string; order?: number; group?: number }) => {
        const { data } = await api.patch(ENDPOINTS.CORE.MENU_MODULES.DETAIL(id), payload);
        return data;
    },

    reorderCategories: async (ids: number[]) => {
        const { data } = await api.post(ENDPOINTS.CORE.MENU_CATEGORIES.REORDER, { ids });
        return data;
    },

    reorderModules: async (groupId: number, ids: number[]) => {
        const { data } = await api.post(ENDPOINTS.CORE.MENU_MODULES.REORDER, { ids, group_id: groupId });
        return data;
    },
};

export default menuModuleService;
