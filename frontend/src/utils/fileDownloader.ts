/**
 * frontend/src/utils/fileDownloader.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilidad transversal para la descarga de archivos binarios (PDF, Excel, etc.)
 * generados por el backend en el navegador del cliente.
 */

export function downloadBlob(blob: Blob, fallbackFilename: string, contentDisposition?: string | null): void {
    let filename = fallbackFilename;

    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
        if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '').trim();
        }
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
