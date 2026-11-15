import { describe, expect, it } from 'vitest';
import { getErrorDetail } from './errorUtils';

describe('getErrorDetail', () => {
  it('retorna el fallback cuando el error no es un objeto de respuesta válido', () => {
    expect(getErrorDetail(null)).toBe('Error inesperado');
    expect(getErrorDetail('boom', 'Fallo custom')).toBe('Fallo custom');
    expect(getErrorDetail({ response: {} }, 'Sin data')).toBe('Sin data');
  });

  it('extrae el campo detail cuando viene en response.data', () => {
    const err = { response: { data: { detail: 'No tienes permisos suficientes.' } } };
    expect(getErrorDetail(err)).toBe('No tienes permisos suficientes.');
  });

  it('formatea errores de validación de múltiples campos', () => {
    const err = {
      response: {
        data: {
          first_name: ['Este campo es requerido.'],
          email: 'Correo inválido.',
        },
      },
    };
    expect(getErrorDetail(err)).toBe(
      'first name: Este campo es requerido. | email: Correo inválido.',
    );
  });
});
