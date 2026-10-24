import { memo } from 'react';
import type { EvaluationSubfactorState, Rating } from '../../../api/guiosPublicService';
import { focusScale } from '../focusScale';
import { RATING_OPTIONS } from '../labels';
import AiSuggestion, { AiSuggestedTag } from './AiSuggestion';
import ScaleButtons from './ScaleButtons';

interface SubfactorRowProps {
    subfactor: EvaluationSubfactorState;
    index: number;
    readOnly: boolean;
    onChange: (subfactorId: number, value: Rating | null) => void;
    /** Solo con la asistencia de IA activa. */
    ai?: { dismissed: boolean; onDismiss: (key: string) => void };
}

const ratingText = (value: Rating) => `${value} · ${RATING_OPTIONS.find((option) => option.value === value)?.label ?? ''}`;

const SubfactorRow = ({ subfactor, index, readOnly, onChange, ai }: SubfactorRowProps) => {
    const suggested = subfactor.ai_suggested_rating;
    const key = `subfactor:${subfactor.subfactor_id}`;
    const scaleId = `rating-scale-${subfactor.subfactor_id}`;
    return (
        <li className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] py-3 first:border-t-0">
            <p className="text-sm text-[var(--color-text-primary)]">
                <span className="mr-1.5 font-mono text-xs text-[var(--color-text-tertiary)]">{index + 1}.</span>
                {subfactor.description}
                {subfactor.rating === null && (
                    <span className="ml-2 text-[11px] font-semibold text-[var(--color-warning-text)]">Sin calificar</span>
                )}
            </p>
            <div id={scaleId}>
                <ScaleButtons
                    label={`Calificación: ${subfactor.description}`}
                    options={RATING_OPTIONS}
                    value={subfactor.rating}
                    onChange={(value) => onChange(subfactor.subfactor_id, value)}
                    disabled={readOnly}
                />
            </div>
            {ai && suggested !== null && (subfactor.rating === null ? (
                !ai.dismissed && (
                    <AiSuggestion
                        subject={`la calificación de «${subfactor.description}»`}
                        valueLabel={ratingText(suggested)}
                        justification={subfactor.ai_rating_justification}
                        onAccept={() => onChange(subfactor.subfactor_id, suggested)}
                        onChange={() => { ai.onDismiss(key); focusScale(scaleId); }}
                        onIgnore={() => ai.onDismiss(key)}
                        disabled={readOnly}
                    />
                )
            ) : (
                <AiSuggestedTag valueLabel={ratingText(suggested)} accepted={subfactor.rating === suggested} />
            ))}
        </li>
    );
};

export default memo(SubfactorRow);
