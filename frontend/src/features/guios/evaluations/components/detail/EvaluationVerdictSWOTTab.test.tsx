import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EvaluationDetail } from '../../../../../api/evaluationService';
import { EvaluationVerdictSWOTTab } from './EvaluationVerdictSWOTTab';

const makeEval = (withVerdict: boolean): EvaluationDetail => ({
  id: 1,
  uuid: 'uuid-tab',
  software_name: 'Nextcloud',
  software_category: 'Colaboración',
  software_version: '29.0',
  software_repo_url: null,
  software_description: 'Nube privada',
  org_name: 'Universidad',
  org_sector: 'Educación',
  org_description: 'Campus universitario',
  status: withVerdict ? 'completed' : 'in_progress',
  ai_enabled: true,
  ai_status: 'completed',
  created_by_username: 'admin',
  started_at: '2026-11-10T10:00:00Z',
  completed_at: withVerdict ? '2026-11-10T12:00:00Z' : null,
  recommendation: withVerdict ? 'A' : null,
  q1_threshold: '1.0',
  q2_threshold: '2.0',
  q3_threshold: '3.0',
  q4_threshold: '4.0',
  factors: [
    {
      id: 1,
      factor_id: 21,
      factor_name: 'Escalabilidad',
      dimension_id: 1,
      dimension_name: 'Tecnológica',
      dimension_order: 1,
      order: 1,
      systemic_importance_snapshot: 3,
      subfactors_count_snapshot: 1,
      citations_count: 5,
      citation_ratio: '5.00',
      literature_importance_calculated: 3,
      expert_importance_snapshot: 3,
      decisor_importance: 3,
      relative_importance: 3,
      is_relevant: true,
      scope_used: 'internal',
      ai_literature_sources: [],
    },
  ],
  subfactors: [],
  results: [
    {
      id: 1,
      factor_id: 21,
      factor_name: 'Escalabilidad',
      weighted_average: '3.8',
      meets_threshold: true,
      foda_classification: 'strength',
      foda_display: 'Fortaleza',
      calculated_at: '2026-11-10T11:00:00Z',
    },
  ],
  verdict: withVerdict
    ? {
        id: 5,
        recommendation: 'A',
        recommendation_display: 'Recomendación A: Adoptar sin observaciones',
        explanation_text: 'Cumple holgadamente los factores clave.',
        ai_executive_summary: 'Resumen ejecutivo favorable.',
        ai_mitigation_plan: '',
        calculated_at: '2026-11-10T12:00:00Z',
      }
    : null,
});

describe('EvaluationVerdictSWOTTab', () => {
  it('muestra estado en proceso cuando no hay veredicto emitido', () => {
    render(<EvaluationVerdictSWOTTab evaluation={makeEval(false)} />);
    expect(
      screen.getByText('Dictamen Institucional en Proceso'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/El plan de mitigación se estructurará cuando se emita el dictamen institucional\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/FORTALEZAS \(F\)/)).toBeInTheDocument();
  });

  it('muestra resolución oficial, resumen ejecutivo y permite inspeccionar un factor FODA', () => {
    const onViewFactorDetails = vi.fn();
    render(
      <EvaluationVerdictSWOTTab
        evaluation={makeEval(true)}
        onViewFactorDetails={onViewFactorDetails}
      />,
    );

    expect(
      screen.getByText('Recomendación A: Adoptar sin observaciones'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Resumen Ejecutivo/i }));
    expect(screen.getByText('Resumen ejecutivo favorable.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Escalabilidad'));
    expect(onViewFactorDetails).toHaveBeenCalledWith(21);
  });
});
