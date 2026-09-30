import React, { memo } from 'react';
import { Download, FileCheck, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface DownloadProgressProps {
    isDownloading: boolean;
    progress: number;
    title?: string;
    show?: boolean;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({ 
    isDownloading, 
    progress, 
    title = "Generando archivo...", 
    show 
}) => {
    if (!show && !isDownloading) return null;

    const isComplete = progress === 100;

    return (
        <div className={clsx(
            "fixed bottom-6 right-6 z-[9999] flex w-72 flex-col gap-3 rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3.5 shadow-xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 select-none",
            !isDownloading && !isComplete && "scale-95 opacity-0 pointer-events-none"
        )}>
            <div className="flex items-center gap-3">
                <div className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-[4px] shrink-0 border",
                    isComplete
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success)]/20"
                        : "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20"
                )}>
                    {isComplete ? (
                        <FileCheck size={16} />
                    ) : isDownloading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Download size={16} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-[var(--color-text-primary)] truncate">
                        {isComplete ? "¡Descarga completa!" : title}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">
                        {isComplete ? "El archivo se ha descargado" : `Procesando... ${Math.round(progress)}%`}
                    </p>
                </div>
            </div>

            <div className="h-1 w-full overflow-hidden rounded-[2px] bg-[var(--color-bg-secondary)]">
                <div 
                    className={clsx(
                        "h-full transition-all duration-150 ease-out",
                        isComplete ? "bg-[var(--color-success)]" : "bg-[var(--color-primary)]"
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default memo(DownloadProgress);
