import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RepoHealthMetrics } from '../../../../../api/evaluationService';
import { RepoHealthCard } from './RepoHealthCard';

describe('RepoHealthCard', () => {
  it('muestra guía para ingresar URL cuando no hay repositorio ni métricas', () => {
    render(<RepoHealthCard />);
    expect(
      screen.getByText(/Pulso Vivo de Repositorio \(GitHub \/ GitLab\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Agrega la URL de GitHub o GitLab/i),
    ).toBeInTheDocument();
  });

  it('permite ingresar URL personalizada y dispara onSync al enviar', async () => {
    const onSync = vi.fn().mockResolvedValue(undefined);
    render(<RepoHealthCard allowEditUrl onSync={onSync} />);

    fireEvent.click(screen.getByRole('button', { name: /Ingresar URL Repo/i }));
    const input = screen.getByPlaceholderText(
      /https:\/\/github\.com\/organizacion\/repositorio/i,
    );
    fireEvent.change(input, {
      target: { value: 'https://github.com/odoo/odoo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar/i }));

    await waitFor(() => {
      expect(onSync).toHaveBeenCalledWith('https://github.com/odoo/odoo');
    });
  });

  it('renderiza métricas saludables y alertas de GitHub correctamente', () => {
    const metrics: RepoHealthMetrics = {
      status: 'ok',
      provider: 'github',
      repo_full_name: 'django/django',
      repo_url: 'https://github.com/django/django',
      primary_language: 'Python',
      license_spdx: 'BSD-3-Clause',
      stars: 82400,
      forks: 32100,
      days_since_last_push: 1,
      latest_release: { tag_name: 'v5.2' },
      contributors_count: 150,
      activity_status: 'active',
      health_score: 94,
      health_grade: 'Excelente',
      alerts: [{ level: 'info', message: 'Repositorio activo y con licencia OSI.' }],
    };

    render(<RepoHealthCard metrics={metrics} />);

    expect(screen.getByText('django/django')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento Activo')).toBeInTheDocument();
    expect(screen.getByText('94/100')).toBeInTheDocument();
    expect(screen.getByText('BSD-3-Clause')).toBeInTheDocument();
    expect(screen.getByText('Hace 1 día')).toBeInTheDocument();
    expect(screen.getByText('v5.2')).toBeInTheDocument();
    expect(screen.getByText('82.4k ★')).toBeInTheDocument();
    expect(screen.getByText('150 contrib.')).toBeInTheDocument();
    expect(
      screen.getByText('Repositorio activo y con licencia OSI.'),
    ).toBeInTheDocument();
  });
});
