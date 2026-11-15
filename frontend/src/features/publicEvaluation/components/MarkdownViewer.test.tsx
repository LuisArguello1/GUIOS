import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownViewer } from './MarkdownViewer';

describe('MarkdownViewer (D-12 XSS sanitization)', () => {
    it('renders safe Markdown structure while stripping script, image handlers, and javascript URLs', () => {
        const maliciousMarkdown = [
            '### Resumen Ejecutivo',
            '',
            '**Resultado:** Aprobado',
            '',
            '<script>window.__xss = true;</script>',
            '<img src="x" onerror="alert(1)" />',
            '<a href="javascript:alert(1)" onclick="alert(2)">Enlace malicioso</a>',
            '',
            '- Punto clave de **mitigación**',
        ].join('\n');

        const { container } = render(<MarkdownViewer content={maliciousMarkdown} />);

        expect(screen.getByText('Resumen Ejecutivo')).toBeTruthy();
        expect(screen.getByText('Aprobado')).toBeTruthy();
        expect(screen.getByText(/Punto clave de/i)).toBeTruthy();

        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(container.innerHTML).not.toContain('onerror');
        expect(container.innerHTML).not.toContain('onclick');
        expect(container.innerHTML).not.toContain('javascript:');
    });
});
