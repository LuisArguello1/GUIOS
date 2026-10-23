import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AiSuggestion from './AiSuggestion';

describe('AiSuggestion', () => {
    it('muestra el valor y la justificación, diferenciados, con Aceptar / Cambiar / Ignorar', async () => {
        const handlers = { onAccept: vi.fn(), onChange: vi.fn(), onIgnore: vi.fn() };
        render(<AiSuggestion subject="la importancia de Soporte" valueLabel="3 · Importante" justification="Hay soporte local." {...handlers} />);
        const box = screen.getByRole('group', { name: 'Sugerencia de la IA para la importancia de Soporte' });
        expect(box).toHaveTextContent('Sugerencia de la IA:3 · Importante(orientativa, aún sin calificar)');
        expect(box).toHaveTextContent('Hay soporte local.');
        await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
        await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
        await userEvent.click(screen.getByRole('button', { name: 'Ignorar' }));
        expect(handlers.onAccept).toHaveBeenCalledTimes(1);
        expect(handlers.onChange).toHaveBeenCalledTimes(1);
        expect(handlers.onIgnore).toHaveBeenCalledTimes(1);
    });
});
