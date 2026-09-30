import api from './axios';
import { ENDPOINTS } from './endpoints';

export interface Organization {
    id: number;
    name: string;
    ruc?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
    slogan?: string | null;
    primary_color?: string;
    updated_at?: string;
}

export type OrganizationUpdatePayload = Omit<Partial<Organization>, 'logo'> & {
    logo?: File | null;
    clear_logo?: boolean;
};

const organizationService = {
    /** Obtiene la instancia única de organización. */
    getOrganization: async (): Promise<Organization> => {
        const { data } = await api.get<Organization>(ENDPOINTS.CORE.ORGANIZATION);
        return data;
    },

    /** Actualiza datos de la organización (incluye logo opcional). */
    updateOrganization: async (payload: OrganizationUpdatePayload): Promise<Organization> => {
        const hasBinaryLogo = typeof Blob !== 'undefined' && payload.logo instanceof Blob;
        const shouldClearLogo = payload.logo === null || payload.clear_logo === true;

        if (hasBinaryLogo || shouldClearLogo) {
            const formData = new FormData();

            Object.entries(payload).forEach(([key, value]) => {
                if (value === undefined || value === null) {
                    if (key === 'logo') {
                        formData.append('clear_logo', 'true');
                    }
                    return;
                }
                if (value instanceof Blob) {
                    formData.append(key, value);
                    return;
                }

                if (key === 'clear_logo') {
                    formData.append(key, value ? 'true' : 'false');
                    return;
                }

                formData.append(key, String(value));
            });

            if (shouldClearLogo) {
                formData.set('clear_logo', 'true');
            }

            const { data } = await api.patch<Organization>(ENDPOINTS.CORE.UPDATE_ORG, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return data;
        }

        const { data } = await api.patch<Organization>(ENDPOINTS.CORE.UPDATE_ORG, payload);
        return data;
    },
};

export default organizationService;
