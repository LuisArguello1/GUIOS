import { useMemo, useState } from 'react';
import { HelpCircle, ListTree, Plus, Search } from 'lucide-react';
import AccessDenied from '../../components/ui/AccessDenied';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import GenericHelpModal from '../../components/ui/GenericHelpModal';
import Input from '../../components/ui/Input';
import PermissionGuard from '../../components/ui/PermissionGuard';
import Skeleton from '../../components/ui/Skeleton';
import SlidePanel from '../../components/ui/SlidePanel';
import Toggle from '../../components/ui/Toggle';
import type { AdminDimension, AdminFactor, AdminSubfactor } from '../../api/guiosAdminService';
import useCatalogAdmin, { type MutationResult } from '../../hooks/useCatalogAdmin';
import usePermissions from '../../hooks/usePermissions';
import CatalogTree, { type CatalogTreeActions } from './components/CatalogTree';
import { DimensionForm, FactorForm, SubfactorForm } from './components/CatalogForms';

type PanelState =
    | { kind: 'dimension'; item: AdminDimension | null }
    | { kind: 'factor'; item: AdminFactor | null; dimensionId: number }
    | { kind: 'subfactor'; item: AdminSubfactor | null; factorId: number };

interface ConfirmState {
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info' | 'primary';
    run: () => Promise<MutationResult>;
}

const matches = (text: string, term: string) => text.toLowerCase().includes(term);

/** Filtra el árbol por texto y oculta los inactivos si se pide. */
const filterTree = (tree: AdminDimension[], term: string, showInactive: boolean): AdminDimension[] =>
    tree.map((dimension) => {
        const factors = (dimension.factors ?? [])
            .filter((f) => showInactive || f.is_active)
            .map((f) => ({ ...f, subfactors: (f.subfactors ?? []).filter((s) => showInactive || s.is_active) }))
            .filter((f) => !term || matches(f.name, term) || matches(dimension.name, term)
                || f.subfactors.some((s) => matches(s.description, term)))
            .map((f) => (term && !matches(f.name, term) && !matches(dimension.name, term)
                ? { ...f, subfactors: f.subfactors.filter((s) => matches(s.description, term)) }
                : f));
        return { ...dimension, factors };
    }).filter((d) => !term || matches(d.name, term) || (d.factors ?? []).length > 0);

/** Catálogo GUIOS (RF-ADM-20, 31-33): árbol con altas, cambios, activar/desactivar y bajas. */
const CatalogPage = () => {
    const { has } = usePermissions();
    const catalog = useCatalogAdmin(has('catalog.view'));
    const [panel, setPanel] = useState<PanelState | null>(null);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(true);
    const [helpOpen, setHelpOpen] = useState(false);

    const visibleTree = useMemo(
        () => filterTree(catalog.tree, search.trim().toLowerCase(), showInactive),
        [catalog.tree, search, showInactive],
    );

    if (!has('catalog.view')) {
        return <AccessDenied message="No tiene permiso para ver el catálogo de GUIOS (catalog.view)." />;
    }

    const ask = (state: ConfirmState) => { setConfirmError(null); setConfirm(state); };

    const runConfirm = async () => {
        if (!confirm) return;
        setConfirming(true);
        const result = await confirm.run();
        setConfirming(false);
        if (result.ok) setConfirm(null);
        else setConfirmError(result.message ?? 'No se pudo completar la operación.');
    };

    const actions: CatalogTreeActions = {
        onAddFactor: (d) => setPanel({ kind: 'factor', item: null, dimensionId: d.id }),
        onAddSubfactor: (f) => setPanel({ kind: 'subfactor', item: null, factorId: f.id }),
        onEditDimension: (d) => setPanel({ kind: 'dimension', item: d }),
        onEditFactor: (f, d) => setPanel({ kind: 'factor', item: f, dimensionId: d.id }),
        onEditSubfactor: (s, f) => setPanel({ kind: 'subfactor', item: s, factorId: f.id }),
        onToggleFactor: (f) => ask({
            title: f.is_active ? 'Desactivar factor' : 'Activar factor',
            message: f.is_active
                ? `«${f.name}» dejará de aparecer en las evaluaciones nuevas. Las evaluaciones existentes no cambian.`
                : `«${f.name}» aparecerá en las evaluaciones nuevas. Necesita al menos un subfactor activo.`,
            confirmText: f.is_active ? 'Desactivar' : 'Activar',
            variant: f.is_active ? 'warning' : 'primary',
            run: () => catalog.updateFactor(f.id, { is_active: !f.is_active }),
        }),
        onToggleSubfactor: (s) => ask({
            title: s.is_active ? 'Desactivar subfactor' : 'Activar subfactor',
            message: s.is_active
                ? 'El criterio dejará de aparecer en las evaluaciones nuevas.'
                : 'El criterio aparecerá en las evaluaciones nuevas.',
            confirmText: s.is_active ? 'Desactivar' : 'Activar',
            variant: s.is_active ? 'warning' : 'primary',
            run: () => catalog.updateSubfactor(s.id, { is_active: !s.is_active }),
        }),
        onDeleteDimension: (d) => ask({
            title: 'Eliminar dimensión', message: `Se eliminará la dimensión «${d.name}».`, confirmText: 'Eliminar',
            variant: 'danger', run: () => catalog.deleteDimension(d.id),
        }),
        onDeleteFactor: (f) => ask({
            title: 'Eliminar factor', message: `Se eliminará el factor «${f.name}».`, confirmText: 'Eliminar',
            variant: 'danger', run: () => catalog.deleteFactor(f.id),
        }),
        onDeleteSubfactor: (s) => ask({
            title: 'Eliminar subfactor', message: `Se eliminará el criterio «${s.description}».`, confirmText: 'Eliminar',
            variant: 'danger', run: () => catalog.deleteSubfactor(s.id),
        }),
    };

    const closePanel = () => setPanel(null);
    const panelTitle = panel
        ? `${panel.item ? 'Editar' : 'Nuevo'} ${{ dimension: 'dimensión', factor: 'factor', subfactor: 'subfactor' }[panel.kind]}`
        : '';

    return (
        <div className="space-y-4 p-3 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]">
                        <ListTree size={20} aria-hidden /> Catálogo GUIOS
                    </h1>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                        Dimensiones, factores y subfactores. La IS usa la escala 1 a 4; GUIOS no usa pesos por dimensión.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setHelpOpen(true)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                        <HelpCircle size={14} aria-hidden /> Reglas del catálogo
                    </button>
                    <PermissionGuard require="catalog.create">
                        <Button icon={Plus} onClick={() => setPanel({ kind: 'dimension', item: null })}>Nueva dimensión</Button>
                    </PermissionGuard>
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <Input className="max-w-sm" label="Buscar" icon={Search} value={search}
                    onChange={(e) => setSearch(e.target.value)} placeholder="Factor, dimensión o criterio" />
                <Toggle label="Mostrar inactivos" checked={showInactive} onChange={setShowInactive} inline />
            </div>

            {catalog.error && <Alert type="error" message={catalog.error} />}
            {catalog.isLoading && catalog.tree.length === 0
                ? <Skeleton height={320} />
                : <CatalogTree tree={visibleTree} actions={actions} />}

            <SlidePanel isOpen={panel !== null} onClose={closePanel} title={panelTitle} width="max-w-lg">
                {panel?.kind === 'dimension' && (
                    <DimensionForm initial={panel.item} onCancel={closePanel}
                        onSave={(p) => (panel.item ? catalog.updateDimension(panel.item.id, p) : catalog.createDimension(p))} />
                )}
                {panel?.kind === 'factor' && (
                    <FactorForm initial={panel.item} dimensionId={panel.dimensionId} dimensions={catalog.tree} onCancel={closePanel}
                        onSave={(p) => (panel.item ? catalog.updateFactor(panel.item.id, p) : catalog.createFactor(p))} />
                )}
                {panel?.kind === 'subfactor' && (
                    <SubfactorForm initial={panel.item} factorId={panel.factorId} dimensions={catalog.tree} onCancel={closePanel}
                        onSave={(p) => (panel.item ? catalog.updateSubfactor(panel.item.id, p) : catalog.createSubfactor(p))} />
                )}
            </SlidePanel>

            <ConfirmModal
                isOpen={confirm !== null}
                onClose={() => setConfirm(null)}
                onConfirm={runConfirm}
                isLoading={confirming}
                title={confirm?.title}
                message={confirm?.message}
                confirmText={confirm?.confirmText}
                cancelText="Cancelar"
                variant={confirm?.variant}
            >
                {confirmError && <Alert type="error" title="No se pudo completar" message={confirmError} />}
            </ConfirmModal>

            <GenericHelpModal
                isOpen={helpOpen}
                onClose={() => setHelpOpen(false)}
                title="Reglas del catálogo"
                description="Estas reglas protegen las evaluaciones ya realizadas (RN-07, RN-08)."
                steps={[
                    { icon: <ListTree size={16} />, title: 'Catálogo base', description: 'Los elementos de la tesis no se eliminan (se pueden desactivar); su IS y su ámbito no se modifican.' },
                    { icon: <ListTree size={16} />, title: 'Con evaluaciones', description: 'Lo que ya se usó en evaluaciones no se elimina, y un subfactor evaluado no se mueve de factor.' },
                    { icon: <ListTree size={16} />, title: 'Factores activos', description: 'Un factor nuevo nace inactivo; un factor activo siempre debe tener al menos un subfactor activo.' },
                    { icon: <ListTree size={16} />, title: 'Ámbito "Ambos"', description: 'El evaluador elige si es interno o externo (como "Soporte").' },
                ]}
                footerText="Catálogo GUIOS"
            />
        </div>
    );
};

export default CatalogPage;
