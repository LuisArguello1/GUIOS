import { describe, expect, it } from 'vitest';
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  hasShortSearchTerm,
  normalizeSearchTerm,
} from './search';

describe('search utils', () => {
  it('usa longitud mínima de 3 caracteres', () => {
    expect(GLOBAL_SEARCH_MIN_LENGTH).toBe(3);
  });

  it('normaliza términos válidos y descarta vacíos o cortos', () => {
    expect(normalizeSearchTerm('   ')).toBeUndefined();
    expect(normalizeSearchTerm('ab')).toBeUndefined();
    expect(normalizeSearchTerm('  odoo  ')).toBe('odoo');
  });

  it('detecta términos cortos no vacíos', () => {
    expect(hasShortSearchTerm('')).toBe(false);
    expect(hasShortSearchTerm('   ')).toBe(false);
    expect(hasShortSearchTerm('ai')).toBe(true);
    expect(hasShortSearchTerm('erp')).toBe(false);
  });
});
