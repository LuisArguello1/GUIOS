/**
 * features/publicEvaluation/components/MarkdownViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente para renderizar contenido Markdown (sintaxis GFM, encabezados,
 * negritas, listas y párrafos) generado por el backend o el motor de IA de GUIOS.
 */

import React, { useMemo, memo } from 'react';
import { marked } from 'marked';
import { clsx } from 'clsx';

interface MarkdownViewerProps {
    content?: string | null;
    className?: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className }) => {
    const htmlContent = useMemo(() => {
        if (!content || !content.trim()) return '';

        try {
            // Configurar marked para saltos de línea y tablas GFM
            const rawHtml = marked.parse(content, {
                gfm: true,
                breaks: true,
                async: false,
            }) as string;

            return rawHtml;
        } catch (err) {
            console.error('Error al parsear Markdown:', err);
            return content;
        }
    }, [content]);

    if (!content || !content.trim()) return null;

    return (
        <div
            className={clsx(
                'guios-markdown text-[11px] leading-relaxed text-[var(--color-text-primary)] space-y-2',
                '[&_h1]:text-sm [&_h1]:font-black [&_h1]:text-[var(--color-text-primary)] [&_h1]:mt-2.5 [&_h1]:mb-1',
                '[&_h2]:text-xs [&_h2]:font-extrabold [&_h2]:text-[var(--color-text-primary)] [&_h2]:mt-2 [&_h2]:mb-1',
                '[&_h3]:text-[11px] [&_h3]:font-black [&_h3]:text-[var(--color-text-primary)] [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:border-b [&_h3]:border-[var(--color-border-subtle)] [&_h3]:pb-0.5',
                '[&_h4]:text-[11px] [&_h4]:font-bold [&_h4]:text-[var(--color-text-primary)] [&_h4]:mt-1.5 [&_h4]:mb-0.5',
                '[&_p]:mb-1.5 [&_p]:leading-relaxed',
                '[&_strong]:font-bold [&_strong]:text-[var(--color-text-primary)]',
                '[&_b]:font-bold [&_b]:text-[var(--color-text-primary)]',
                '[&_em]:italic [&_em]:text-[var(--color-text-primary)]',
                '[&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-4 [&_ul]:space-y-1 [&_ul]:mb-2',
                '[&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-4 [&_ol]:space-y-1 [&_ol]:mb-2',
                '[&_li]:leading-relaxed [&_li]:text-[var(--color-text-primary)]',
                '[&_li_strong]:text-[var(--color-text-primary)]',
                '[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-primary)] [&_blockquote]:pl-2.5 [&_blockquote]:italic [&_blockquote]:text-[var(--color-text-tertiary)] [&_blockquote]:my-1.5',
                '[&_code]:font-mono [&_code]:text-[10px] [&_code]:bg-[var(--color-bg-page)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-[var(--color-border-subtle)]',
                '[&_hr]:border-[var(--color-border-subtle)] [&_hr]:my-2',
                className
            )}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    );
};

export default memo(MarkdownViewer);
