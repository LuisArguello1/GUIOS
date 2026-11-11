import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { MenuGroup, Organization } from '../app/types/core';
import useAuthStore from '../app/useAuthStore';

const coreService = {
    getMenu: async (roleId?: number | string): Promise<MenuGroup[]> => {
        const activeRoleId = roleId ?? useAuthStore.getState().selectedGroup?.id;
        const params: Record<string, string | number> = {};
        if (activeRoleId !== undefined && activeRoleId !== null && activeRoleId !== '') {
            params.role_id = activeRoleId;
        }
        const response = await api.get<MenuGroup[]>(ENDPOINTS.CORE.MENU, { params });
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
