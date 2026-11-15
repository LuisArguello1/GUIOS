import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import useAuthStore from '../../app/useAuthStore';
import { PermissionGuard } from './PermissionGuard';

describe('PermissionGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('renderiza children cuando cumple requireStaff y permiso', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 1,
        email: 'admin@guios.org',
        username: 'admin',
        first_name: 'Admin',
        last_name: 'Guios',
        is_staff: true,
        is_superuser: false,
        permissions: ['guios.edit_evaluation'],
      },
    });

    render(
      <PermissionGuard
        requireStaff
        require="guios.edit_evaluation"
        fallback={<span>Sin acceso</span>}
      >
        <span>Contenido protegido</span>
      </PermissionGuard>,
    );

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
    expect(screen.queryByText('Sin acceso')).not.toBeInTheDocument();
  });

  it('muestra fallback si falta requireStaff o el permiso requerido', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 2,
        email: 'user@guios.org',
        username: 'viewer',
        first_name: 'Viewer',
        last_name: 'User',
        is_staff: false,
        is_superuser: false,
        permissions: [],
      },
    });

    render(
      <PermissionGuard requireStaff fallback={<span>Solo staff</span>}>
        <span>Panel secreto</span>
      </PermissionGuard>,
    );

    expect(screen.getByText('Solo staff')).toBeInTheDocument();
    expect(screen.queryByText('Panel secreto')).not.toBeInTheDocument();
  });
});
