import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './fileDownloader';

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa el nombre de Content-Disposition cuando está presente', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const blob = new Blob(['demo'], { type: 'application/pdf' });

    downloadBlob(blob, 'fallback.pdf', 'attachment; filename="reporte_guios.pdf"');

    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('reporte_guios.pdf');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('usa fallbackFilename si no viene Content-Disposition', () => {
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:fallback'),
      configurable: true,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    downloadBlob(new Blob(['xlsx']), 'evaluacion.xlsx');

    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('evaluacion.xlsx');
  });
});
