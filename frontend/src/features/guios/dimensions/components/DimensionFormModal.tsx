import React, { useState, memo } from 'react';
import { Layers, Hash, AlignLeft, Info } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type { Dimension, DimensionInput } from '../../../../api/dimensionService';

interface DimensionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    dimensionToEdit: Dimension | null;
    onSubmit: (data: DimensionInput) => Promise<boolean>;
}

interface DimensionFormContentProps {
    onClose: () => void;
    dimensionToEdit: Dimension | null;
    onSubmit: (data: DimensionInput) => Promise<boolean>;
}

const DimensionFormContent: React.FC<DimensionFormContentProps> = ({
    onClose,
    dimensionToEdit,
    onSubmit,
}) => {
    const isEditing = !!dimensionToEdit;

    const [name, setName] = useState(dimensionToEdit?.name || '');
    const [order, setOrder] = useState<number>(dimensionToEdit?.order ?? 1);
    const [description, setDescription] = useState(dimensionToEdit?.description || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanName = name.trim();
        if (!cleanName) {
            setNameError('El nombre de la dimensión es obligatorio.');
            return;
        }

        setNameError(null);
        setIsSubmitting(true);

        const payload: DimensionInput = {
            name: cleanName,
            order: Number(order) || 1,
            description: description.trim(),
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
            size="md"
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                            {isEditing ? 'Editar Dimensión de Evaluación' : 'Nueva Dimensión de Evaluación'}
                        </h3>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {isEditing
                                ? `Modificando los parámetros de la dimensión #${dimensionToEdit?.order}`
                                : 'Define un pilar conceptual de primer nivel en el catálogo GUIOS'}
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                        * Campos requeridos
                    </span>
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
                                : 'Crear Dimensión'}
                        </Button>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nombre de la Dimensión */}
                <div>
                    <Input
                        label="Nombre de la Dimensión *"
                        icon={Layers}
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (nameError) setNameError(null);
                        }}
                        placeholder="Ej: Tecnológica, Organizacional, Entorno..."
                        error={nameError || undefined}
                        required
                    />
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1 flex items-center gap-1">
                        <Info size={12} className="text-[var(--color-info-text)]" />
                        Representa el nivel más alto de agrupación en la metodología de evaluación.
                    </p>
                </div>

                {/* Orden */}
                <div>
                    <Input
                        label="Orden de Visualización *"
                        icon={Hash}
                        type="number"
                        min={1}
                        value={order}
                        onChange={(e) => setOrder(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        placeholder="1, 2, 3..."
                        required
                    />
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                        Determina la posición jerárquica en los reportes y evaluaciones.
                    </p>
                </div>

                {/* Descripción */}
                <div>
                    <Input
                        isTextArea
                        label="Descripción o Alcance Teórico"
                        icon={AlignLeft}
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe qué características o factores abarca esta dimensión..."
                    />
                </div>
            </form>
        </Modal>
    );
};

export const DimensionFormModal: React.FC<DimensionFormModalProps> = ({
    isOpen,
    onClose,
    dimensionToEdit,
    onSubmit,
}) => {
    if (!isOpen) return null;

    return (
        <DimensionFormContent
            key={dimensionToEdit ? `edit-${dimensionToEdit.id}` : 'new'}
            onClose={onClose}
            dimensionToEdit={dimensionToEdit}
            onSubmit={onSubmit}
        />
    );
};

export default memo(DimensionFormModal);
