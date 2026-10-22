import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScaleButtons from './ScaleButtons';
import { RATING_OPTIONS } from '../labels';

describe('ScaleButtons', () => {
    it('muestra las 4 opciones como radios accesibles', () => {
        render(<ScaleButtons label="Calificación" options={RATING_OPTIONS} value={null} onChange={vi.fn()} />);
        expect(screen.getByRole('radiogroup', { name: 'Calificación' })).toBeInTheDocument();
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(4);
        expect(radios[1]).toHaveTextContent('2 · No se sabe');
        radios.forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'));
    });

    it('elige un valor y lo desmarca al pulsarlo de nuevo', async () => {
        const onChange = vi.fn();
        const { rerender } = render(<ScaleButtons label="ID" options={RATING_OPTIONS} value={null} onChange={onChange} />);
        await userEvent.click(screen.getByRole('radio', { name: /3 · Cumple parcialmente/ }));
        expect(onChange).toHaveBeenLastCalledWith(3);

        rerender(<ScaleButtons label="ID" options={RATING_OPTIONS} value={3} onChange={onChange} />);
        const selected = screen.getByRole('radio', { name: /3 · Cumple parcialmente/ });
        expect(selected).toHaveAttribute('aria-checked', 'true');
        await userEvent.click(selected);
        expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it('se usa con el teclado (flechas)', async () => {
        const onChange = vi.fn();
        render(<ScaleButtons label="ID" options={RATING_OPTIONS} value={2} onChange={onChange} />);
        await userEvent.tab();
        expect(screen.getByRole('radio', { name: /2 · No se sabe/ })).toHaveFocus();
        await userEvent.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith(3);
        expect(screen.getByRole('radio', { name: /3 · Cumple parcialmente/ })).toHaveFocus();
        await userEvent.keyboard('{ArrowLeft}');
        expect(onChange).toHaveBeenLastCalledWith(2);
    });

    it('no cambia nada si está deshabilitado (solo lectura)', async () => {
        const onChange = vi.fn();
        render(<ScaleButtons label="ID" options={RATING_OPTIONS} value={4} onChange={onChange} disabled />);
        await userEvent.click(screen.getByRole('radio', { name: /1 · No cumple/ }));
        expect(onChange).not.toHaveBeenCalled();
    });
});
