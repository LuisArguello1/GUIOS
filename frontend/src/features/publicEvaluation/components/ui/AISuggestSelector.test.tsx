import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AISuggestSelector } from './AISuggestSelector';

describe('AISuggestSelector', () => {
    it('allows switching between individual, group, and all scopes and triggers run', () => {
        const onScopeChange = vi.fn();
        const onRun = vi.fn();

        render(
            <AISuggestSelector
                options={[
                    { value: 'factor', label: 'Factor actual', pendingCount: 1 },
                    { value: 'dimension', label: 'Dimensión Tecnológica', pendingCount: 4 },
                    { value: 'all', label: 'Todos los factores', pendingCount: 10 },
                ]}
                selectedScope="factor"
                onScopeChange={onScopeChange}
                onRun={onRun}
            />
        );

        const select = screen.getByLabelText('Modo de sugerencia de IA') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'all' } });
        expect(onScopeChange).toHaveBeenCalledWith('all');

        const button = screen.getByRole('button', { name: /Sugerir IA/i });
        fireEvent.click(button);
        expect(onRun).toHaveBeenCalledTimes(1);
    });

    it('disables the action button when no pending items remain for the selected scope', () => {
        render(
            <AISuggestSelector
                options={[
                    { value: 'factor', label: 'Factor actual', pendingCount: 0 },
                    { value: 'all', label: 'Todos los factores', pendingCount: 5 },
                ]}
                selectedScope="factor"
                onScopeChange={vi.fn()}
                onRun={vi.fn()}
                allReadyForScope={true}
            />
        );

        const button = screen.getByRole('button', { name: /Sugerencia lista/i }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });
});
