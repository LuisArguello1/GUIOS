import api from './axios';
import { ENDPOINTS } from './endpoints';

/**
 * System Modules & Navigation Service
 * Retrieves the navigation menu structure for the current user.
 */
const modulesService = {
    getMenu: async () => {
        const { data } = await api.get(ENDPOINTS.CORE.MENU);
        return data;
    },
};

export default modulesService;
