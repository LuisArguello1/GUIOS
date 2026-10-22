import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RegistrationForm from './RegistrationForm';

describe('RegistrationForm', () => {
    it('exige el nombre del software y de la organización', async () => {
        const onSubmit = vi.fn();
        render(<RegistrationForm onSubmit={onSubmit} isSubmitting={false} />);
        await userEvent.click(screen.getByRole('button', { name: /Comenzar evaluación/ }));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText('Escriba el nombre del software.')).toBeInTheDocument();
        expect(screen.getByText('Escriba el nombre de la organización.')).toBeInTheDocument();
    });

    it('envía los datos (opcionales vacíos permitidos) y muestra errores del servidor', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ software_repo_url: 'Introduzca una URL válida.' });
        render(<RegistrationForm onSubmit={onSubmit} isSubmitting={false} />);
        await userEvent.type(screen.getByLabelText(/Nombre del software/), '  B&R Suite ');
        await userEvent.type(screen.getByLabelText(/Organización evaluadora/), 'Ñandú & Cía.');
        await userEvent.click(screen.getByRole('button', { name: /Comenzar evaluación/ }));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            software_name: 'B&R Suite', org_name: 'Ñandú & Cía.', software_repo_url: null, software_version: '',
        }));
        expect(await screen.findByText('Introduzca una URL válida.')).toBeInTheDocument();
    });
});
