import { useEffect } from 'react';
import useCoreStore from '../app/useCoreStore';
import { usePermissions } from './usePermissions';
import useToastStore from '../app/useToastStore';
import type { Organization } from '../app/types/core';

export const useOrganization = () => {
    const organization = useCoreStore((s) => s.organization);
    const loadingOrg = useCoreStore((s) => s.loadingOrg);
    const organizationLoaded = useCoreStore((s) => s.organizationLoaded);
    const orgError = useCoreStore((s) => s.orgError);
    const fetchOrganization = useCoreStore((s) => s.fetchOrganization);
    const updateOrganization = useCoreStore((s) => s.updateOrganization);
    const updatePreferences = useCoreStore((s) => s.updatePreferences);

    const { canModify, isAdmin } = usePermissions();
    const { addToast } = useToastStore();

    useEffect(() => {
        if (!organizationLoaded) {
            fetchOrganization();
        }
    }, [organizationLoaded, fetchOrganization]);

    const saveOrganization = async (data: Partial<Organization>) => {
        if (!canModify && !isAdmin) {
            addToast({ message: 'No tienes permisos para modificar la organización.', type: 'error' });
            return;
        }
        try {
            await updateOrganization(data);
            addToast({ message: 'Información de la empresa actualizada.', type: 'success' });
        } catch {
            // El store ya actualizó orgError; el toast de error viene del interceptor
            addToast({ message: 'No se pudo guardar la información.', type: 'error' });
        }
    };

    const savePreferences = async (
        sidebar?: { is_collapsed?: boolean; theme?: 'dark' | 'light' }
    ) => {
        if (!canModify && !isAdmin) {
            addToast({ message: 'No tienes permisos para cambiar preferencias visuales.', type: 'error' });
            return;
        }
        try {
            await updatePreferences({ sidebar });
            addToast({ message: 'Preferencias visuales aplicadas.', type: 'success' });
        } catch {
            addToast({ message: 'No se pudieron guardar las preferencias.', type: 'error' });
        }
    };

    return {
        organization,
        sidebarPrefs: organization?.sidebar_preferences,
        isLoadingOrg: loadingOrg,
        orgError,
        saveOrganization,
        savePreferences,
        refreshOrganization: fetchOrganization,
    };
};

export default useOrganization;