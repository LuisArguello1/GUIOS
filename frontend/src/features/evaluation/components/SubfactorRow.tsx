import { memo } from 'react';
import type { EvaluationSubfactorState, Rating } from '../../../api/guiosPublicService';
import { RATING_OPTIONS } from '../labels';
import ScaleButtons from './ScaleButtons';

interface SubfactorRowProps {
    subfactor: EvaluationSubfactorState;
    index: number;
    readOnly: boolean;
    onChange: (subfactorId: number, value: Rating | null) => void;
}

const SubfactorRow = ({ subfactor, index, readOnly, onChange }: SubfactorRowProps) => (
    <li className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] py-3 first:border-t-0">
        <p className="text-sm text-[var(--color-text-primary)]">
            <span className="mr-1.5 font-mono text-xs text-[var(--color-text-tertiary)]">{index + 1}.</span>
            {subfactor.description}
            {subfactor.rating === null && (
                <span className="ml-2 text-[11px] font-semibold text-[var(--color-warning-text)]">Sin calificar</span>
            )}
        </p>
        <ScaleButtons
            label={`Calificación: ${subfactor.description}`}
            options={RATING_OPTIONS}
            value={subfactor.rating}
            onChange={(value) => onChange(subfactor.subfactor_id, value)}
            disabled={readOnly}
        />
    </li>
);

export default memo(SubfactorRow);
