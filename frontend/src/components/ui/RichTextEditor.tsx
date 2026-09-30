import { useEffect, memo } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Strikethrough, List, ListOrdered, Undo, Redo, RemoveFormatting } from 'lucide-react';
import { clsx } from 'clsx';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: string;
    maxHeight?: string;
    className?: string;
}

/**
 * Barra de herramientas del Editor de Texto Enriquecido estilo TikTok.
 */
const MenuBar = memo(({ editor }: { editor: Editor | null }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/50 p-1.5 rounded-t-[6px] shrink-0 select-none">
            {/* Negrita */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={clsx(
                    "p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95 cursor-pointer",
                    editor.isActive('bold') && "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                )}
                title="Negrita"
            >
                <Bold size={14} />
            </button>

            {/* Cursiva */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={clsx(
                    "p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95 cursor-pointer",
                    editor.isActive('italic') && "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                )}
                title="Cursiva"
            >
                <Italic size={14} />
            </button>

            {/* Tachado */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={clsx(
                    "p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95 cursor-pointer",
                    editor.isActive('strike') && "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                )}
                title="Tachado"
            >
                <Strikethrough size={14} />
            </button>

            <div className="w-[1px] h-4 bg-[var(--color-border-subtle)] mx-1" />

            {/* Lista Viñetas */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={clsx(
                    "p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95 cursor-pointer",
                    editor.isActive('bulletList') && "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                )}
                title="Lista de viñetas"
            >
                <List size={14} />
            </button>

            {/* Lista Ordenada */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={clsx(
                    "p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95 cursor-pointer",
                    editor.isActive('orderedList') && "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                )}
                title="Lista ordenada"
            >
                <ListOrdered size={14} />
            </button>

            <div className="w-[1px] h-4 bg-[var(--color-border-subtle)] mx-1" />

            {/* Limpiar formato */}
            <button
                type="button"
                onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                className="p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95 cursor-pointer"
                title="Limpiar formato"
            >
                <RemoveFormatting size={14} />
            </button>

            <div className="w-[1px] h-4 bg-[var(--color-border-subtle)] mx-1 ml-auto" />

            {/* Deshacer */}
            <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                className="p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-30 active:scale-95 cursor-pointer"
                title="Deshacer"
            >
                <Undo size={14} />
            </button>

            {/* Rehacer */}
            <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                className="p-1.5 rounded-[4px] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-30 active:scale-95 cursor-pointer"
                title="Rehacer"
            >
                <Redo size={14} />
            </button>
        </div>
    );
});
MenuBar.displayName = 'MenuBar';

/**
 * RichTextEditor - Editor de Texto Enriquecido con Tiptap y tema TikTok.
 */
const RichTextEditor = ({
    value,
    onChange,
    placeholder = 'Escribe aquí...',
    minHeight = '100px',
    maxHeight = '220px',
    className = '',
}: RichTextEditorProps) => {
    
    // Inicializar Tiptap
    const editor = useEditor({
        extensions: [StarterKit],
        content: value,
        editorProps: {
            attributes: {
                class: 'ProseMirror custom-scrollbar',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Sincronizar value externo
    useEffect(() => {
        if (editor && !editor.isDestroyed && editor.getHTML() !== value) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    return (
        <div 
            style={{
                '--editor-min-height': minHeight,
                '--editor-max-height': maxHeight,
            } as React.CSSProperties}
            className={clsx(
                "tiptap-editor-container flex flex-col rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] overflow-hidden transition-all duration-150 focus-within:border-[var(--color-border-focus)] focus-within:ring-1 focus-within:ring-[var(--color-border-focus)] hover:border-[var(--color-border-strong)]",
                className
            )}
        >
            {/* Estilo local */}
            <style>{`
                .tiptap-editor-container .ProseMirror {
                    min-height: var(--editor-min-height, 100px);
                    max-height: var(--editor-max-height, 220px);
                    overflow-y: auto;
                    outline: none;
                    padding: 10px 14px;
                    font-size: 13px;
                    line-height: 1.6;
                    color: var(--color-text-primary);
                }
                .tiptap-editor-container .ProseMirror p.is-editor-empty:first-child::before {
                    color: var(--color-text-disabled);
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                .tiptap-editor-container .ProseMirror ul {
                    list-style-type: disc !important;
                    padding-left: 20px !important;
                    margin: 4px 0 !important;
                }
                .tiptap-editor-container .ProseMirror ol {
                    list-style-type: decimal !important;
                    padding-left: 20px !important;
                    margin: 4px 0 !important;
                }
                .tiptap-editor-container .ProseMirror p {
                    margin: 4px 0 !important;
                }
                .tiptap-editor-container .ProseMirror strong {
                    font-weight: 700;
                    color: var(--color-text-primary);
                }
            `}</style>

            {/* Barra de herramientas */}
            <MenuBar editor={editor} />

            {/* Editor Content */}
            <EditorContent 
                editor={editor} 
                className="flex-1 overflow-hidden" 
                placeholder={placeholder}
            />
        </div>
    );
};

export default memo(RichTextEditor);
