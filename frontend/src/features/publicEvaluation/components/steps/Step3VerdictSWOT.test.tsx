import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EvaluationDetail } from '../../../../api/evaluationService';
import { Step3VerdictSWOT } from './Step3VerdictSWOT';

const makeEvaluation = (overrides: Partial<EvaluationDetail> = {}): EvaluationDetail => ({
  id: 1,
  uuid: 'eval-uuid-1',
  software_name: 'Odoo Community',
  software_category: 'ERP',
  software_version: '17.0',
  software_repo_url: null,
  software_description: 'ERP modular open source',
  org_name: 'Cooperativa Andina',
  org_sector: 'Servicios',
  org_description: 'Organización mediana',
  status: 'in_progress',
  ai_enabled: true,
  ai_status: 'completed',
  created_by_username: null,
  started_at: '2026-11-10T10:00:00Z',
  completed_at: null,
  recommendation: null,
  q1_threshold: '1.0',
  q2_threshold: '2.0',
  q3_threshold: '3.0',
  q4_threshold: '4.0',
  factors: [
    {
      id: 1,
      factor_id: 101,
      factor_name: 'Seguridad',
      dimension_id: 1,
      dimension_name: 'Tecnológica',
      dimension_order: 1,
      order: 1,
      systemic_importance_snapshot: 2,
      subfactors_count_snapshot: 2,
      citations_count: 4,
      citation_ratio: '2.00',
      literature_importance_calculated: 2,
      expert_importance_snapshot: 2,
      decisor_importance: 2,
      relative_importance: 2,
      is_relevant: true,
      scope_used: 'internal',
      ai_literature_sources: [],
    },
    {
      id: 2,
      factor_id: 102,
      factor_name: 'Usabilidad',
      dimension_id: 1,
      dimension_name: 'Tecnológica',
      dimension_order: 1,
      order: 2,
      systemic_importance_snapshot: 2,
      subfactors_count_snapshot: 2,
      citations_count: 3,
      citation_ratio: '1.50',
      literature_importance_calculated: 2,
      expert_importance_snapshot: 2,
      decisor_importance: 2,
      relative_importance: 2,
      is_relevant: true,
      scope_used: 'internal',
      ai_literature_sources: [],
    },
    {
      id: 3,
      factor_id: 103,
      factor_name: 'Comunidad',
      dimension_id: 2,
      dimension_name: 'Organizacional',
      dimension_order: 2,
      order: 3,
      systemic_importance_snapshot: 3,
      subfactors_count_snapshot: 2,
      citations_count: 6,
      citation_ratio: '3.00',
      literature_importance_calculated: 3,
      expert_importance_snapshot: 3,
      decisor_importance: 3,
      relative_importance: 3,
      is_relevant: true,
      scope_used: 'external',
      ai_literature_sources: [],
    },
  ],
  subfactors: [],
  results: [
    {
      id: 1,
      factor_id: 101,
      factor_name: 'Seguridad',
      weighted_average: '2.0',
      meets_threshold: false,
      foda_classification: 'weakness',
      foda_display: 'Debilidad',
      calculated_at: '2026-11-10T10:05:00Z',
    },
    {
      id: 2,
      factor_id: 102,
      factor_name: 'Usabilidad',
      weighted_average: '2.5',
      meets_threshold: false,
      foda_classification: 'weakness',
      foda_display: 'Debilidad',
      calculated_at: '2026-11-10T10:05:00Z',
    },
    {
      id: 3,
      factor_id: 103,
      factor_name: 'Comunidad',
      weighted_average: '3.5',
      meets_threshold: true,
      foda_classification: 'opportunity',
      foda_display: 'Oportunidad',
      calculated_at: '2026-11-10T10:05:00Z',
    },
  ],
  verdict: null,
  ...overrides,
});

describe('Step3VerdictSWOT', () => {
  it('previsualiza Recomendación C cuando fallos opcionales (IR=2) superan a positivos', () => {
    render(
      <Step3VerdictSWOT
        evaluation={makeEvaluation()}
        onEmitVerdict={vi.fn().mockResolvedValue(true)}
        isComputing={false}
        onDownloadPdf={vi.fn().mockResolvedValue(undefined)}
        onDownloadExcel={vi.fn().mockResolvedValue(undefined)}
        downloadingFormat={null}
        onResetEvaluation={vi.fn()}
        onOpenHelp={vi.fn()}
      />,
    );

    expect(screen.getByText(/Veredicto Pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/Recomendación C\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Se sugiere analizar la adopción y posponerla/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/El plan de mitigación se generará y estructurará automáticamente al emitir el dictamen final\./i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Plan de Mitigación de Brechas Metodológicas/i)).not.toBeInTheDocument();
  });

  it('muestra el dictamen oficial persistido y permite cambiar a Resumen Ejecutivo', () => {
    const evalWithVerdict = makeEvaluation({
      status: 'completed',
      verdict: {
        id: 10,
        recommendation: 'B',
        recommendation_display: 'Recomendación B: Adoptar con matices',
        explanation_text: 'Texto oficial del veredicto.',
        ai_executive_summary: 'Resumen ejecutivo sintetizado por IA.',
        ai_mitigation_plan: '',
        calculated_at: '2026-11-10T12:00:00Z',
      },
    });

    render(
      <Step3VerdictSWOT
        evaluation={evalWithVerdict}
        onEmitVerdict={vi.fn().mockResolvedValue(true)}
        isComputing={false}
        onDownloadPdf={vi.fn().mockResolvedValue(undefined)}
        onDownloadExcel={vi.fn().mockResolvedValue(undefined)}
        downloadingFormat={null}
        onResetEvaluation={vi.fn()}
        onOpenHelp={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Recomendación B: Adoptar con matices'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resumen/i }));
    expect(
      screen.getByText(/Resumen ejecutivo sintetizado por IA\./i),
    ).toBeInTheDocument();
  });
});
