import { describe, expect, it } from 'vitest';
import {
  buildConfirmedSubfactorRatingsPayload,
  draftSubfactorRating,
  type LocalSubfactorRatingState,
} from './usePublicEvaluation';
import type { EvaluationSubfactorItem } from '../../../api/evaluationService';

const makeSubfactor = (overrides: Partial<EvaluationSubfactorItem> = {}): EvaluationSubfactorItem => ({
  id: 1,
  subfactor_id: 101,
  factor_id: 10,
  factor_name: 'Compatibilidad',
  order: 1,
  description_snapshot: 'Criterio verificable',
  rating: null,
  ai_citations_count: 0,
  ai_suggested_rating: null,
  saved_at: '2026-11-22T00:00:00Z',
  ...overrides,
});

describe('D-18 subfactor ratings confirmation', () => {
  it('mantiene sin calificación (null) los subfactores no confirmados aunque exista sugerencia de IA', () => {
    const draft = draftSubfactorRating(
      makeSubfactor({
        subfactor_id: 101,
        rating: null,
        ai_suggested_rating: 4,
        ai_rating_justification: 'Sugerencia automática',
      })
    );

    expect(draft.rating).toBeNull();
    expect(draft.is_modified).toBe(false);
    expect(draft.ai_suggested).toBe(4);
    expect(draft.user_adjusted).toBe(false);
  });

  it('no envía el valor por defecto 3 ni sugerencias de IA sin confirmación del evaluador', () => {
    const sfUnratedWithAi = makeSubfactor({
      subfactor_id: 101,
      rating: null,
      ai_suggested_rating: 3,
    });
    const sfUnratedPlain = makeSubfactor({
      subfactor_id: 102,
      rating: null,
      ai_suggested_rating: null,
    });
    const sfConfirmedByUser = makeSubfactor({
      subfactor_id: 103,
      rating: null,
      ai_suggested_rating: 4,
    });

    const map: Record<number, LocalSubfactorRatingState> = {
      101: draftSubfactorRating(sfUnratedWithAi),
      102: draftSubfactorRating(sfUnratedPlain),
      103: {
        ...draftSubfactorRating(sfConfirmedByUser),
        rating: 2,
        is_modified: true,
        user_adjusted: true,
      },
    };

    const result = buildConfirmedSubfactorRatingsPayload(
      [sfUnratedWithAi, sfUnratedPlain, sfConfirmedByUser],
      map
    );

    expect(result.hasModified).toBe(true);
    expect(result.ratings).toEqual({ 103: 2 });
    expect(result.ratings[101]).toBeUndefined();
    expect(result.ratings[102]).toBeUndefined();
  });
});
