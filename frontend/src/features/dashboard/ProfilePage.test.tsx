import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from '../../app/useAuthStore';
import useToastStore from '../../app/useToastStore';
import ProfilePage from './ProfilePage';

const service = vi.hoisted(() => ({ getTOTPConfig: vi.fn(), activateTOTP: vi.fn(), updateProfile: vi.fn() }));
vi.mock('../../api/authService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../api/authService')>()),
    default: service,
}));

const addToast = vi.fn();

const openActivation = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(service.getTOTPConfig).toHaveBeenCalled());
    await user.click(screen.getByRole('switch'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('textbox')[0]);
    await user.keyboard('123456');
    await user.click(within(dialog).getByRole('button', { name: 'Activar 2FA' }));
    return dialog;
};

describe('Perfil: activar 2FA no guarda el perfil', () => {
    beforeEach(() => {
        useAuthStore.setState({
            isAuthenticated: true,
            user: {
                id: 1, email: 'ana@example.com', username: 'ana', first_name: 'Ana', last_name: 'Pérez',
                is_staff: false, is_superuser: false, permissions: ['settings.profile_manage'],
            },
        });
        useToastStore.setState({ addToast });
        addToast.mockReset();
        Object.values(service).forEach((fn) => fn.mockReset());
        service.getTOTPConfig.mockResolvedValue({ uri: 'otpauth://totp/GUIOS:ana?secret=JBSWY3DPEHPK3PXP', secret: 'JBSWY3DPEHPK3PXP', is_active: false });
    });

    it('un código incorrecto muestra el error en el modal y no dispara el guardado del perfil', async () => {
        const user = userEvent.setup();
        service.activateTOTP.mockRejectedValue({ response: { data: { detail: 'Código inválido.', attempts_left: 3 } } });
        const dialog = await openActivation(user);

        expect(await within(dialog).findByText('Código incorrecto · 3 intentos restantes')).toBeInTheDocument();
        expect(service.activateTOTP).toHaveBeenCalledWith('123456');
        expect(service.updateProfile).not.toHaveBeenCalled();
        expect(addToast.mock.calls.map(([toast]) => toast.message)).not.toContain('¡Perfil actualizado con éxito!');
    });

    it('un código correcto activa el 2FA sin guardar el perfil', async () => {
        const user = userEvent.setup();
        service.activateTOTP.mockResolvedValue({ detail: '2FA activado.', recovery_codes: ['AAAA-BBBB'] });
        await openActivation(user);

        expect(await screen.findByText('¡2FA Activado!')).toBeInTheDocument();
        expect(service.updateProfile).not.toHaveBeenCalled();
        expect(addToast.mock.calls.map(([toast]) => toast.message)).not.toContain('¡Perfil actualizado con éxito!');
    });
});
