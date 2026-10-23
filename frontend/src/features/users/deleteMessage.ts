import type { UserDeleteImpact } from '../../api/userService';

export type DeleteImpactState =
    | { status: 'loading' }
    | { status: 'ready'; impact: UserDeleteImpact }
    | { status: 'error' };

/**
 * Texto del modal de eliminar. El resultado real lo decide el DELETE; si la
 * consulta del impacto falla, se avisa de las dos posibilidades.
 */
export const deleteMessage = (name: string, state: DeleteImpactState): string => {
    if (state.status === 'loading') return `Comprobando los registros asociados a ${name}…`;
    if (state.status === 'error') {
        return `No se pudo comprobar si ${name} tiene registros asociados. Si los tiene, se desactivará en lugar de `
            + 'borrarse; si no, se eliminará permanentemente.';
    }
    if (state.impact.action === 'SOFT_DELETE') {
        return `${name} tiene registros asociados (${state.impact.summary}). Para conservar el historial, `
            + 'se desactivará en lugar de borrarse.';
    }
    return `¿Eliminar permanentemente a ${name}? No tiene registros asociados. Esta acción no se puede deshacer.`;
};

export const deleteConfirmText = (state: DeleteImpactState): string =>
    state.status === 'ready' && state.impact.action === 'SOFT_DELETE' ? 'Desactivar usuario' : 'Eliminar definitivamente';
