/**
 * features/publicEvaluation/components/MarkdownViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente para renderizar contenido Markdown (sintaxis GFM, encabezados,
 * negritas, listas y párrafos) generado por el backend o el motor de IA de GUIOS.
 */

import React, { useMemo, useRef, useLayoutEffect, memo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { clsx } from 'clsx';

interface MarkdownViewerProps {
    content?: string | null;
    className?: string;
}

const ALLOWED_ELEMENTS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    'strong', 'b', 'em', 'i', 'del', 's',
    'ul', 'ol', 'li',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTRIBUTES = ['href', 'title', 'target', 'rel'];

type SetHTMLElement = HTMLDivElement & {
    setHTML?: (
        html: string,
        options?: { sanitizer?: { elements: string[]; attributes: string[] } }
    ) => void;
};

function sanitizeWithDOMPurify(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [...ALLOWED_ELEMENTS, '#text'],
        ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
        ALLOW_ARIA_ATTR: false,
        ALLOW_DATA_ATTR: false,
        KEEP_CONTENT: false,
    });
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className }) => {
    const containerRef = useRef<SetHTMLElement | null>(null);
    const supportsNativeSanitizer =
        typeof Element !== 'undefined' && 'setHTML' in Element.prototype;

    const rawHtml = useMemo(() => {
        if (!content || !content.trim()) return '';

        try {
            // Configurar marked para saltos de línea y tablas GFM
            return marked.parse(content, {
                gfm: true,
                breaks: true,
                async: false,
            }) as string;
        } catch (err) {
            console.error('Error al parsear Markdown:', err);
            return '';
        }
    }, [content]);

    const sanitizedHtml = useMemo(() => {
        if (!rawHtml || supportsNativeSanitizer) return '';
        return sanitizeWithDOMPurify(rawHtml);
    }, [rawHtml, supportsNativeSanitizer]);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el || !supportsNativeSanitizer || typeof el.setHTML !== 'function') return;

        el.setHTML(rawHtml, {
            sanitizer: {
                elements: ALLOWED_ELEMENTS,
                attributes: ALLOWED_ATTRIBUTES,
            },
        });
    }, [rawHtml, supportsNativeSanitizer]);

    if (!content || !content.trim()) return null;

    const sharedClassName = clsx(
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
    );

    if (supportsNativeSanitizer) {
        return <div ref={containerRef} className={sharedClassName} />;
    }

    return (
        <div
            className={sharedClassName}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
    );
};

export default memo(MarkdownViewer);
