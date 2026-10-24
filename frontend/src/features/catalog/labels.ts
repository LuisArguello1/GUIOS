import type { AdminDimension, AdminFactor, AdminScope, AdminSubfactor } from '../../api/guiosAdminService';

export const SCOPE_TEXT: Record<AdminScope, string> = {
    internal: 'Interno',
    external: 'Externo',
    both: 'Ambos (lo elige el evaluador)',
};

const BASE = 'Es del catálogo base';

/** Motivo por el que no se puede eliminar (null si se puede), según can_delete. */
export const dimensionBlockReason = (d: AdminDimension): string | null =>
    d.can_delete ? null : d.is_base ? BASE : 'Tiene factores';

export const factorBlockReason = (f: AdminFactor): string | null => {
    if (f.can_delete) return null;
    if (f.is_base) return BASE;
    if (f.evaluations_count > 0) return 'Tiene evaluaciones';
    return 'Tiene subfactores';
};

export const subfactorBlockReason = (s: AdminSubfactor): string | null =>
    s.can_delete ? null : s.is_base ? BASE : 'Tiene evaluaciones';
