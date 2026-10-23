/** Guarda un archivo recibido como blob (CSV, PDF) con el nombre indicado. */
export const saveBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Nombre del archivo en Content-Disposition (o el valor por defecto). */
export const filenameFromDisposition = (header: string | undefined, fallback: string): string => {
    const match = header?.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : fallback;
};
