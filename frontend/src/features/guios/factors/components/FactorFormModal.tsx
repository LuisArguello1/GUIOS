import React, { useState, useMemo, memo } from 'react';
import { Sliders, Hash, Sparkles, Info } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type { Factor, FactorInput, FactorScope } from '../../../../api/factorService';
import type { Dimension } from '../../../../api/dimensionService';
import { calculateSuggestedImportance } from '../../../../calculations/combinationMatrix';

interface FactorFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    factorToEdit: Factor | null;
    dimensions: Dimension[];
    onSubmit: (data: FactorInput) => Promise<boolean>;
}

interface FactorFormContentProps {
    onClose: () => void;
    factorToEdit: Factor | null;
    dimensions: Dimension[];
    onSubmit: (data: FactorInput) => Promise<boolean>;
}

const IMPORTANCE_LABELS: Record<number, string> = {
    1: '1 - Irrelevante',
    2: '2 - Opcional',
    3: '3 - Importante',
    4: '4 - Fundamental',
};

const FactorFormContent: React.FC<FactorFormContentProps> = ({
    onClose,
    factorToEdit,
    dimensions,
    onSubmit,
}) => {
    const isEditing = !!factorToEdit;

    const initialAutoIS = factorToEdit
        ? calculateSuggestedImportance(factorToEdit.literature_importance_base, factorToEdit.expert_importance)
        : 3;
    const initialIsCustom = factorToEdit ? factorToEdit.systemic_importance !== initialAutoIS : false;

    const [dimensionId, setDimensionId] = useState<number>(factorToEdit?.dimension?.id || (dimensions[0]?.id ?? 0));
    const [name, setName] = useState(factorToEdit?.name || '');
    const [scope, setScope] = useState<FactorScope>(factorToEdit?.scope || 'external');
    const [scopeConfigurable, setScopeConfigurable] = useState(factorToEdit?.scope_configurable ?? false);
    const [expertImportance, setExpertImportance] = useState<number>(factorToEdit?.expert_importance ?? 3);
    const [literatureImportanceBase, setLiteratureImportanceBase] = useState<number>(factorToEdit?.literature_importance_base ?? 1);
    const [useCustomIS, setUseCustomIS] = useState(initialIsCustom);
    const [customSystemicImportance, setCustomSystemicImportance] = useState<number>(factorToEdit?.systemic_importance ?? 3);
    const [order, setOrder] = useState<number>(factorToEdit?.order ?? 0);
    const [isActive, setIsActive] = useState(factorToEdit?.is_active ?? true);

    const [nameError, setNameError] = useState<string | null>(null);
    const [dimError, setDimError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calcular en tiempo real el IS según matriz 5.10
    const calculatedIS = useMemo(
        () => calculateSuggestedImportance(literatureImportanceBase, expertImportance),
        [literatureImportanceBase, expertImportance]
    );

    const finalIS = useCustomIS ? customSystemicImportance : calculatedIS;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanName = name.trim();
        if (!cleanName) {
            setNameError('El nombre del factor es obligatorio.');
            return;
        }

        if (!dimensionId) {
            setDimError('Debe asociar el factor a una dimensión.');
            return;
        }

        setNameError(null);
        setDimError(null);
        setIsSubmitting(true);

        const payload: FactorInput = {
            dimension_id: Number(dimensionId),
            name: cleanName,
            scope,
            scope_configurable: scopeConfigurable,
            expert_importance: Number(expertImportance),
            literature_importance_base: Number(literatureImportanceBase),
            systemic_importance: useCustomIS ? Number(customSystemicImportance) : null,
            order: Number(order) || 0,
            is_active: isActive,
        };

        const success = await onSubmit(payload);
        setIsSubmitting(false);

        if (success) {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Sliders size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                            {isEditing ? 'Editar Factor de Evaluación' : 'Nuevo Factor de Evaluación'}
                        </h3>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {isEditing
                                ? `Modificando factor #${factorToEdit?.order} del catálogo oficial GUIOS`
                                : 'Define un criterio de segundo nivel con métricas de importancia y ámbito FODA'}
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="text-[11px] text-[var(--color-text-tertiary)]">
                        * Campos requeridos para el motor de recomendación
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !name.trim()}
                        >
                            {isSubmitting
                                ? 'Guardando...'
                                : isEditing
                                ? 'Guardar Cambios'
                                : 'Crear Factor'}
                        </Button>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* ── Dimensión y Nombre ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                            Dimensión Asociada *
                        </label>
                        <select
                            value={dimensionId}
                            onChange={(e) => {
                                setDimensionId(Number(e.target.value));
                                if (dimError) setDimError(null);
                            }}
                            className={`w-full py-1.5 px-2.5 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer ${
                                dimError ? 'border-[var(--color-danger-border)]' : 'border-[var(--color-border-default)]'
                            }`}
                        >
                            <option value={0}>Seleccione Dimensión...</option>
                            {dimensions.map((d) => (
                                <option key={d.id} value={d.id}>
                                    #{d.order} {d.name}
                                </option>
                            ))}
                        </select>
                        {dimError && (
                            <span className="text-[10px] text-[var(--color-danger-text)] block mt-0.5">
                                {dimError}
                            </span>
                        )}
                    </div>

                    <div className="sm:col-span-2">
                        <Input
                            label="Nombre del Factor *"
                            icon={Sliders}
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (nameError) setNameError(null);
                            }}
                            placeholder="Ej: Compatibilidad, Madurez, Soporte Técnico..."
                            error={nameError || undefined}
                            required
                        />
                    </div>
                </div>

                {/* ── Ámbito y Alcance FODA ── */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                            Clasificación de Alcance (FODA)
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            Determina si el factor genera Fortalezas/Debilidades u Oportunidades/Amenazas
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className={`flex items-start gap-2 p-2 rounded-[2px] border cursor-pointer transition-colors ${
                            scope === 'external'
                                ? 'bg-[var(--color-primary-soft-bg)] border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]'
                        }`}>
                            <input
                                type="radio"
                                name="scope"
                                value="external"
                                checked={scope === 'external'}
                                onChange={() => setScope('external')}
                                className="mt-0.5 text-[var(--color-primary)] focus:ring-0"
                            />
                            <div>
                                <span className="text-xs font-bold block">Externo (Software)</span>
                                <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5 leading-snug">
                                    Características del producto. FODA: Oportunidad / Amenaza.
                                </span>
                            </div>
                        </label>

                        <label className={`flex items-start gap-2 p-2 rounded-[2px] border cursor-pointer transition-colors ${
                            scope === 'internal'
                                ? 'bg-[var(--color-info-bg)] border-[var(--color-info)] text-[var(--color-info-text)]'
                                : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]'
                        }`}>
                            <input
                                type="radio"
                                name="scope"
                                value="internal"
                                checked={scope === 'internal'}
                                onChange={() => setScope('internal')}
                                className="mt-0.5 text-[var(--color-info-text)] focus:ring-0"
                            />
                            <div>
                                <span className="text-xs font-bold block">Interno (Organización)</span>
                                <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5 leading-snug">
                                    Capacidades de la entidad. FODA: Fortaleza / Debilidad.
                                </span>
                            </div>
                        </label>

                        <label className={`flex items-start gap-2 p-2 rounded-[2px] border cursor-pointer transition-colors ${
                            scope === 'both'
                                ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning-text)]'
                                : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]'
                        }`}>
                            <input
                                type="radio"
                                name="scope"
                                value="both"
                                checked={scope === 'both'}
                                onChange={() => setScope('both')}
                                className="mt-0.5 text-[var(--color-warning-text)] focus:ring-0"
                            />
                            <div>
                                <span className="text-xs font-bold block">Ambos (Dual)</span>
                                <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5 leading-snug">
                                    Afecta tanto al producto como a la institución.
                                </span>
                            </div>
                        </label>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border-subtle)]">
                        <input
                            type="checkbox"
                            id="scopeConfigurable"
                            checked={scopeConfigurable}
                            onChange={(e) => setScopeConfigurable(e.target.checked)}
                            className="rounded-[2px] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="scopeConfigurable" className="text-[11px] text-[var(--color-text-primary)] cursor-pointer select-none">
                            Permitir que el evaluador/decisor configure o redefina este alcance al iniciar una evaluación.
                        </label>
                    </div>
                </div>

                {/* ── Matriz Metodológica (IE x IL -> IS) ── */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={14} className="text-[var(--color-primary)]" />
                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                Métricas de Importancia y Matriz Metodológica (Figura 5.10)
                            </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                            IS Resultante: Nivel {finalIS} ({IMPORTANCE_LABELS[finalIS].split('-')[1].trim()})
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                                Importancia del Experto (IE) *
                            </label>
                            <select
                                value={expertImportance}
                                onChange={(e) => setExpertImportance(Number(e.target.value))}
                                className="w-full py-1.5 px-2.5 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                            >
                                <option value={1}>{IMPORTANCE_LABELS[1]}</option>
                                <option value={2}>{IMPORTANCE_LABELS[2]}</option>
                                <option value={3}>{IMPORTANCE_LABELS[3]}</option>
                                <option value={4}>{IMPORTANCE_LABELS[4]}</option>
                            </select>
                            <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                                Criterio base de la tesis / panel de expertos (1 a 4).
                            </span>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                                Importancia Literatura Base (IL) *
                            </label>
                            <select
                                value={literatureImportanceBase}
                                onChange={(e) => setLiteratureImportanceBase(Number(e.target.value))}
                                className="w-full py-1.5 px-2.5 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                            >
                                <option value={1}>{IMPORTANCE_LABELS[1]}</option>
                                <option value={2}>{IMPORTANCE_LABELS[2]}</option>
                                <option value={3}>{IMPORTANCE_LABELS[3]}</option>
                                <option value={4}>{IMPORTANCE_LABELS[4]}</option>
                            </select>
                            <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                                Cuartil de citas científicas en la literatura previa.
                            </span>
                        </div>
                    </div>

                    {/* Simulación y anulación manual opcional de IS */}
                    <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={useCustomIS}
                                    onChange={(e) => setUseCustomIS(e.target.checked)}
                                    className="rounded-[2px] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                                />
                                <span className="text-xs text-[var(--color-text-secondary)]">
                                    Sobrescribir manualmente la Importancia Sugerida (IS)
                                </span>
                            </label>

                            {!useCustomIS && (
                                <span className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1">
                                    <Info size={11} />
                                    Autocalculado por matriz metodológica ({literatureImportanceBase} x {expertImportance})
                                </span>
                            )}
                        </div>

                        {useCustomIS && (
                            <div className="p-2 bg-[var(--color-bg-elevated)] border border-[var(--color-warning-border)] rounded-[2px] flex items-center justify-between gap-3">
                                <span className="text-xs text-[var(--color-warning-text)] font-semibold">
                                    Valor manual de Importancia Sugerida (IS):
                                </span>
                                <select
                                    value={customSystemicImportance}
                                    onChange={(e) => setCustomSystemicImportance(Number(e.target.value))}
                                    className="py-1 px-2 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer font-mono font-bold"
                                >
                                    <option value={1}>{IMPORTANCE_LABELS[1]}</option>
                                    <option value={2}>{IMPORTANCE_LABELS[2]}</option>
                                    <option value={3}>{IMPORTANCE_LABELS[3]}</option>
                                    <option value={4}>{IMPORTANCE_LABELS[4]}</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Orden y Estado ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <Input
                            label="Orden de Visualización"
                            icon={Hash}
                            type="number"
                            min={0}
                            value={order}
                            onChange={(e) => setOrder(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            placeholder="0, 1, 2..."
                        />
                    </div>
                    <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="rounded-[2px] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                                Factor Activo para Evaluaciones
                            </span>
                        </label>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export const FactorFormModal: React.FC<FactorFormModalProps> = ({
    isOpen,
    onClose,
    factorToEdit,
    dimensions,
    onSubmit,
}) => {
    if (!isOpen) return null;

    return (
        <FactorFormContent
            key={factorToEdit ? `edit-${factorToEdit.id}` : 'new'}
            onClose={onClose}
            factorToEdit={factorToEdit}
            dimensions={dimensions}
            onSubmit={onSubmit}
        />
    );
};

export default memo(FactorFormModal);
