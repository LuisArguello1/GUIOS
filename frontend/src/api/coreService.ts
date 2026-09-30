import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { MenuGroup, Organization } from '../app/types/core';

const coreService = {
    getMenu: async (): Promise<MenuGroup[]> => {
        const response = await api.get<MenuGroup[]>(ENDPOINTS.CORE.MENU);
        return response.data;
    },

    getOrganization: async (): Promise<Organization> => {
        const response = await api.get<Organization>(ENDPOINTS.CORE.ORGANIZATION);
        return response.data;
    },

    updateOrganization: async (data: Partial<Organization>): Promise<Organization> => {
        const response = await api.patch<Organization>(ENDPOINTS.CORE.UPDATE_ORG, data);
        return response.data;
    },
};

export default coreService;
