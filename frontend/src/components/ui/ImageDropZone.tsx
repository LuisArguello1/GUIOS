import React, { useState, useRef, useCallback, memo, useMemo } from 'react';
import { clsx } from 'clsx';
import { UploadCloud, X, AlertCircle, RefreshCw, FileImage, Camera, Building2 } from 'lucide-react';

const DEFAULT_MAX_MB = 5;
const DEFAULT_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface ImageDropZoneProps {
    preview?: string | null;
    value?: string | File | null;
    onSelect?: (file: File, previewUrl: string) => void;
    onChange?: (file: File) => void;
    onClear?: () => void;
    onRemove?: () => void;
    size?: string;
    label?: string;
    hint?: string | false;
    maxSizeMb?: number;
    acceptedTypes?: string[];
    shape?: 'square' | 'circle' | 'rectangle' | 'rect';
    disabled?: boolean;
    className?: string;
}

export const ImageDropZone: React.FC<ImageDropZoneProps> = ({
    preview,
    value,
    onSelect,
    onChange,
    onClear,
    onRemove,
    size,
    label,
    hint,
    maxSizeMb = DEFAULT_MAX_MB,
    acceptedTypes = DEFAULT_ACCEPTED,
    shape = 'rectangle',
    disabled = false,
    className,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);
    const maxBytes = maxSizeMb * 1024 * 1024;

    // Resolver preview URL
    const currentPreviewUrl = useMemo(() => {
        if (typeof preview === 'string') return preview;
        if (typeof value === 'string') return value;
        if (value instanceof File) {
            return URL.createObjectURL(value);
        }
        return null;
    }, [preview, value]);

    const isCircle = shape === 'circle';
    const isSquare = shape === 'square';
    const isCompact = isCircle || isSquare;

    const defaultSizeClass = useMemo(() => {
        if (size) return size;
        if (isCircle) return 'w-20 h-20 sm:w-24 sm:h-24';
        if (isSquare) return 'w-20 h-20 sm:w-24 sm:h-24';
        return 'w-full h-44 sm:h-48';
    }, [size, isCircle, isSquare]);

    const shapeBorderClass = isCircle ? 'rounded-full' : 'rounded-[8px]';

    const handleClear = useCallback(() => {
        if (disabled) return;
        setError(null);
        if (onClear) onClear();
        if (onRemove) onRemove();
        if (inputRef.current) inputRef.current.value = '';
    }, [disabled, onClear, onRemove]);

    const validateAndProcess = useCallback(
        (file: File | null | undefined) => {
            setError(null);
            if (!file) return;

            if (!acceptedTypes.includes(file.type)) {
                setError('Formato no soportado. Usa PNG, JPG, WebP o GIF.');
                return;
            }
            if (file.size > maxBytes) {
                setError(
                    `Archivo muy grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Máximo ${maxSizeMb} MB.`
                );
                return;
            }

            const url = URL.createObjectURL(file);
            if (onSelect) onSelect(file, url);
            if (onChange) onChange(file);
        },
        [acceptedTypes, maxBytes, maxSizeMb, onSelect, onChange]
    );

    const onDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (dragCounter.current === 1) setIsDragging(true);
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) setIsDragging(false);
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current = 0;
            setIsDragging(false);
            if (!disabled) {
                validateAndProcess(e.dataTransfer?.files?.[0]);
            }
        },
        [disabled, validateAndProcess]
    );

    const onFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            validateAndProcess(e.target.files?.[0]);
            e.target.value = '';
        },
        [validateAndProcess]
    );

    const showHint = hint !== false;

    return (
        <div
            className={clsx(
                'select-none',
                isCompact ? 'inline-flex flex-col items-center shrink-0' : 'w-full flex flex-col gap-2',
                className
            )}
        >
            {/* ── Drop Zone Container ── */}
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={label ?? (isCompact ? 'Subir imagen' : 'Arrastra una imagen')}
                aria-disabled={disabled}
                onClick={() => !disabled && inputRef.current?.click()}
                onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        inputRef.current?.click();
                    }
                }}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={clsx(
                    'relative overflow-hidden group transition-all duration-200 shrink-0',
                    defaultSizeClass,
                    shapeBorderClass,
                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    currentPreviewUrl
                        ? 'border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] shadow-xs'
                        : clsx(
                              'border-2 border-dashed flex flex-col items-center justify-center text-center',
                              isDragging
                                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 scale-[1.02] shadow-md shadow-[var(--color-primary)]/20'
                                  : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/70 hover:bg-[var(--color-bg-secondary)]'
                          )
                )}
            >
                {/* ── ESTADO 1: Vista Previa de Imagen ── */}
                {currentPreviewUrl ? (
                    <>
                        <img
                            src={currentPreviewUrl}
                            alt="Vista previa"
                            className={clsx(
                                'w-full h-full select-none pointer-events-none transition-transform duration-300 group-hover:scale-105',
                                isSquare ? 'object-contain p-1' : 'object-cover',
                                shapeBorderClass
                            )}
                            draggable={false}
                        />

                        {/* Capa oscura de hover */}
                        <div
                            className={clsx(
                                'absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 p-2 text-center',
                                shapeBorderClass,
                                isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                        >
                            {isCompact ? (
                                <Camera size={20} className="text-white drop-shadow-sm" />
                            ) : (
                                <>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[12px] font-bold bg-white text-black shadow-md">
                                        <RefreshCw size={13} />
                                        <span>Cambiar Imagen</span>
                                    </span>
                                    <span className="text-[11px] font-medium text-white/90">
                                        Haz clic o arrastra otra imagen
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Botón de eliminar (X) */}
                        {!disabled && (
                            <button
                                type="button"
                                aria-label="Quitar imagen"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                }}
                                className={clsx(
                                    'absolute z-20 transition-all duration-150 cursor-pointer',
                                    isCircle
                                        ? '-top-1 -right-1 size-6 bg-[var(--color-danger)] text-white rounded-full border border-white shadow-sm flex items-center justify-center'
                                        : 'top-1.5 right-1.5 size-6 sm:size-7 rounded-full flex items-center justify-center bg-black/75 hover:bg-[var(--color-danger)] text-white border border-white/20 shadow-md backdrop-blur-xs',
                                    'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                                )}
                                title="Eliminar imagen"
                            >
                                <X size={isCircle ? 12 : 14} strokeWidth={2.5} />
                            </button>
                        )}
                    </>
                ) : (
                    /* ── ESTADO 2: Dropzone Vacío ── */
                    <div className="flex flex-col items-center justify-center gap-2 p-2 pointer-events-none w-full h-full">
                        {isCompact ? (
                            /* Modo Compacto (Avatar o Logo cuadrado) */
                            <div className="flex flex-col items-center justify-center text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] transition-colors">
                                {isDragging ? (
                                    <UploadCloud size={24} className="text-[var(--color-primary)] animate-bounce" />
                                ) : isSquare ? (
                                    <Building2 size={24} className="opacity-70" />
                                ) : (
                                    <Camera size={22} className="opacity-70" />
                                )}
                                <span className="text-[10px] font-bold mt-1 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-primary)]">
                                    {isDragging ? 'Soltar' : 'Subir'}
                                </span>
                            </div>
                        ) : (
                            /* Modo Banner Rectangular Amplio */
                            <>
                                <div
                                    className={clsx(
                                        'w-11 h-11 rounded-[8px] flex items-center justify-center transition-transform duration-200',
                                        isDragging
                                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] scale-110'
                                            : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-primary)]'
                                    )}
                                >
                                    {isDragging ? (
                                        <UploadCloud size={24} className="animate-bounce" />
                                    ) : (
                                        <FileImage size={22} />
                                    )}
                                </div>

                                <div className="space-y-1 text-center px-2">
                                    <p className="text-[13px] font-bold text-[var(--color-text-primary)] tracking-tight">
                                        {isDragging ? '¡Suelta la imagen aquí!' : label ?? 'Arrastra una imagen o haz clic para subir'}
                                    </p>
                                    {showHint && (
                                        <p className="text-[11.5px] text-[var(--color-text-tertiary)] font-normal">
                                            {hint ?? `PNG, JPG, WebP o GIF · Máximo ${maxSizeMb} MB`}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Input oculto nativo */}
                <input
                    ref={inputRef}
                    type="file"
                    accept={acceptedTypes.join(',')}
                    className="hidden"
                    onChange={onFileChange}
                    disabled={disabled}
                    aria-hidden="true"
                    tabIndex={-1}
                />
            </div>

            {/* ── Error de Validación ── */}
            {error && (
                <div
                    role="alert"
                    className="flex items-center gap-1.5 text-[var(--color-danger-text)] text-[11px] font-semibold pt-1 text-center"
                >
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default memo(ImageDropZone);