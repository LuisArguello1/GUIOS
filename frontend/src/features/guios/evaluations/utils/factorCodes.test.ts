import { describe, expect, it } from 'vitest';
import { getFactorCode, getSubfactorCode } from './factorCodes';

describe('factorCodes', () => {
  it('genera prefijos TEC, ORG y ECO normalizando tildes y caracteres', () => {
    expect(getFactorCode('Usabilidad y Diseño', 'Tecnológica')).toBe('TEC-USA');
    expect(getFactorCode('Capacitación Técnica', 'Organizacional')).toBe('ORG-CAP');
    expect(getFactorCode('Costo Total (TCO)', 'Económica')).toBe('ECO-COS');
  });

  it('formatea códigos de subfactor con dos dígitos', () => {
    expect(getSubfactorCode('TEC-USA', 1)).toBe('TEC-USA-01');
    expect(getSubfactorCode('ORG-CAP', 12)).toBe('ORG-CAP-12');
  });
});
