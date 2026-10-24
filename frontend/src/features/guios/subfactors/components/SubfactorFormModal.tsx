import React, { useState, useMemo, memo } from 'react';
import { Quote, Layers, Sliders, Hash, Sparkles, Info } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type { Subfactor, SubfactorInput } from '../../../../api/subfactorService';
import type { Factor } from '../../../../api/factorService';
import type { Dimension } from '../../../../api/dimensionService';

interface SubfactorFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    subfactorToEdit: Subfactor | null;
    defaultFactorId?: number;
    factors: Factor[];
    dimensions: Dimension[];
    onSubmit: (data: SubfactorInput) => Promise<boolean>;
}

interface SubfactorFormContentProps {
    onClose: () => void;
    subfactorToEdit: Subfactor | null;
    defaultFactorId?: number;
    factors: Factor[];
    dimensions: Dimension[];
    onSubmit: (data: SubfactorInput) => Promise<boolean>;
}

const SubfactorFormContent: React.FC<SubfactorFormContentProps> = ({
    onClose,
    subfactorToEdit,
    defaultFactorId,
    factors,
    dimensions,
    onSubmit,
}) => {
    const isEditing = !!subfactorToEdit;

    const initialFactorId = subfactorToEdit
        ? subfactorToEdit.factor.id
        : (defaultFactorId || (factors.length > 0 ? factors[0].id : 0));

    const initialDimId = subfactorToEdit
        ? (subfactorToEdit.factor.dimension_id || 0)
        : (factors.find((f) => f.id === initialFactorId)?.dimension?.id || 0);

    // Estados de formulario inicializados directamente de las props
    const [selectedDimensionId, setSelectedDimensionId] = useState<number>(initialDimId);
    const [factorId, setFactorId] = useState<number>(initialFactorId);
    const [description, setDescription] = useState(subfactorToEdit?.description || '');
    const [baseCitationsCount, setBaseCitationsCount] = useState<number>(subfactorToEdit?.base_citations_count ?? 1);
    const [keywordsIa, setKeywordsIa] = useState(subfactorToEdit?.keywords_ia || '');
    const [order, setOrder] = useState<number>(subfactorToEdit?.order ?? 0);
    const [isActive, setIsActive] = useState(subfactorToEdit?.is_active ?? true);

    const [descError, setDescError] = useState<string | null>(null);
    const [factorError, setFactorError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Lista de factores filtrada por la dimensión seleccionada (si aplica)
    const availableFactors = useMemo(() => {
        if (!selectedDimensionId) return factors;
        return factors.filter((f) => f.dimension?.id === selectedDimensionId);
    }, [factors, selectedDimensionId]);

    const handleDimensionChange = (newDimId: number) => {
        setSelectedDimensionId(newDimId);
        // Si el factor actual no pertenece a la nueva dimensión, seleccionar el primero disponible
        const matchingFactors = newDimId ? factors.filter((f) => f.dimension?.id === newDimId) : factors;
        if (matchingFactors.length > 0 && !matchingFactors.some((f) => f.id === factorId)) {
            setFactorId(matchingFactors[0].id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validaciones
        const cleanDesc = description.trim();
        if (!cleanDesc) {
            setDescError('La afirmación o descripción del subfactor es obligatoria.');
            return;
        }
        if (cleanDesc.length < 5) {
            setDescError('La descripción debe contener al menos 5 caracteres descriptivos.');
            return;
        }
        setDescError(null);

        if (!factorId) {
            setFactorError('Debe seleccionar un factor de evaluación.');
            return;
        }
        setFactorError(null);

        setIsSubmitting(true);
        const payload: SubfactorInput = {
            factor_id: factorId,
            description: cleanDesc,
            base_citations_count: Number(baseCitationsCount) || 0,
            keywords_ia: keywordsIa.trim(),
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
                        <Quote size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                            {isEditing ? 'Editar Subfactor de Evaluación' : 'Nuevo Subfactor de Evaluación'}
                        </h3>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {isEditing
                                ? `Modificando subfactor #${subfactorToEdit?.order} del catálogo`
                                : 'Añadir un nuevo criterio verificable al catálogo GUIOS'}
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="text-[11px] text-[var(--color-text-tertiary)]">
                        * Campos requeridos para evaluación metodológica
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !description.trim()}
                        >
                            {isSubmitting
                                ? 'Guardando...'
                                : isEditing
                                ? 'Guardar Cambios'
                                : 'Crear Subfactor'}
                        </Button>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selección de Dimensión y Factor Padre */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
                            <Layers size={13} className="text-[var(--color-primary)]" />
                            Dimensión
                        </label>
                        <select
                            value={selectedDimensionId}
                            onChange={(e) => handleDimensionChange(Number(e.target.value))}
                            className="w-full py-1.5 px-2.5 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                        >
                            <option value={0}>Todas las Dimensiones</option>
                            {dimensions.map((d) => (
                                <option key={d.id} value={d.id}>
                                    #{d.order} {d.name}
                                </option>
                            ))}
                        </select>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                            Filtra los factores mostrados abajo
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
                            <Sliders size={13} className="text-[var(--color-primary)]" />
                            Factor de Pertenencia *
                        </label>
                        <select
                            value={factorId}
                            onChange={(e) => {
                                setFactorId(Number(e.target.value));
                                setFactorError(null);
                            }}
                            className={`w-full py-1.5 px-2.5 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer ${
                                factorError ? 'border-[var(--color-danger-border)]' : 'border-[var(--color-border-default)]'
                            }`}
                        >
                            {availableFactors.map((f) => (
                                <option key={f.id} value={f.id}>
                                    #{f.order} {f.name} ({f.dimension?.name})
                                </option>
                            ))}
                        </select>
                        {factorError && (
                            <span className="text-[10px] text-[var(--color-danger-text)] block mt-0.5">
                                {factorError}
                            </span>
                        )}
                    </div>
                </div>

                {/* Descripción / Afirmación Verificable */}
                <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <Quote size={13} className="text-[var(--color-primary)]" />
                            Afirmación Verificable (Criterio) *
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                            {description.length} caracteres
                        </span>
                    </label>
                    <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => {
                            setDescription(e.target.value);
                            if (descError) setDescError(null);
                        }}
                        placeholder="Ejemplo: El software interactúa y se integra con el software propietario existente."
                        className={`w-full p-2.5 text-xs bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] resize-y leading-relaxed ${
                            descError ? 'border-[var(--color-danger-border)]' : 'border-[var(--color-border-default)]'
                        }`}
                    />
                    {descError ? (
                        <span className="text-[10px] text-[var(--color-danger-text)] block mt-0.5">
                            {descError}
                        </span>
                    ) : (
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-1">
                            <Info size={11} className="text-[var(--color-info-text)] shrink-0" />
                            Redacte la afirmación de forma afirmativa y verificable para calificación con escala 1-4.
                        </p>
                    )}
                </div>

                {/* Métricas: Citas Base en Literatura y Palabras Clave IA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
                            <Hash size={13} className="text-[var(--color-primary)]" />
                            Citas Base en Literatura (ci)
                        </label>
                        <Input
                            type="number"
                            min={0}
                            max={999}
                            value={baseCitationsCount}
                            onChange={(e) => setBaseCitationsCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            placeholder="1"
                        />
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                            Citas académicas base de referencia para el cálculo de cuartiles IL.
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
                            <Sparkles size={13} className="text-[var(--color-primary)]" />
                            Palabras Clave para IA
                        </label>
                        <Input
                            type="text"
                            value={keywordsIa}
                            onChange={(e) => setKeywordsIa(e.target.value)}
                            placeholder="cloud, interoperabilidad, saas"
                        />
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                            Términos separados por comas para orientar la extracción semántica.
                        </span>
                    </div>
                </div>

                {/* Orden y Estado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                            Orden dentro del Factor
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={order}
                            onChange={(e) => setOrder(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            placeholder="0"
                        />
                    </div>

                    <div className="flex items-center justify-between sm:justify-start gap-3 mt-4 sm:mt-6">
                        <label className="text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer select-none">
                            Subfactor Activo
                        </label>
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                        />
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export const SubfactorFormModal: React.FC<SubfactorFormModalProps> = ({
    isOpen,
    onClose,
    subfactorToEdit,
    defaultFactorId,
    factors,
    dimensions,
    onSubmit,
}) => {
    if (!isOpen) return null;

    return (
        <SubfactorFormContent
            key={subfactorToEdit ? `edit-${subfactorToEdit.id}` : `new-${defaultFactorId ?? 0}`}
            onClose={onClose}
            subfactorToEdit={subfactorToEdit}
            defaultFactorId={defaultFactorId}
            factors={factors}
            dimensions={dimensions}
            onSubmit={onSubmit}
        />
    );
};

export default memo(SubfactorFormModal);
