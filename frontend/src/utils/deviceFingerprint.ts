/**
 * Generador de huella digital de hardware de dispositivo (Browser Device Fingerprint).
 *
 * Diseñado para ser determinista e idéntico tanto en navegación estándar
 * como en pestañas de modo incógnito/privado en el mismo dispositivo físico.
 *
 * Combina:
 * 1. Firma de renderizado de Canvas 2D (variaciones en subpíxeles de GPU y rasterizado de fuentes del SO).
 * 2. WebGL Hardware Info & Shader Precision (GPU física / arquitectura).
 * 3. Offline AudioContext Processing (curva de compresión y FFT por hardware de audio).
 * 4. Características físicas fijas de pantalla (resolución de monitor, ratio de píxeles, profundidad de color).
 * 5. Especificaciones físicas de CPU (núcleos de hardware, memoria aproximada, puntos táctiles).
 * 6. Zona horaria de la máquina y configuraciones de sistema.
 */

let cachedFingerprint: string | null = null;

// Algoritmo SHA-256 determinista
async function sha256Hex(text: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        try {
            const msgBuffer = new TextEncoder().encode(text);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch {
            // Continuar con fallback determinista
        }
    }

    // Fallback determinista FNV-1a extendido de 64 caracteres
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        h1 ^= code;
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= code ^ (i << 3);
        h2 = Math.imul(h2, 0x5bd1e995);
    }
    const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `${part1}${part2}${part1}${part2}${part1}${part2}${part1}${part2}`;
}

function getCanvasFingerprint(): string {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'canvas_unsupported';

        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);

        ctx.fillStyle = '#069';
        ctx.font = "14px 'Arial', 'Segoe UI', sans-serif";
        ctx.fillText('TikTokVoting 🔒 🚀 @2026', 2, 15);

        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('TikTokVoting 🔒 🚀 @2026', 4, 17);

        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(254, 44, 85, 0.5)';
        ctx.beginPath();
        ctx.arc(40, 35, 15, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();

        return canvas.toDataURL();
    } catch {
        return 'canvas_blocked';
    }
}

function getWebGLFingerprint(): string {
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!gl) return 'webgl_unsupported';

        let vendor = '';
        let renderer = '';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
            renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        }
        if (!vendor) vendor = gl.getParameter(gl.VENDOR) || '';
        if (!renderer) renderer = gl.getParameter(gl.RENDERER) || '';

        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
        const maxViewport = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || []).join('x');
        const maxVertexAttrs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) || 0;

        return `${vendor}~${renderer}~tex:${maxTextureSize}~vp:${maxViewport}~va:${maxVertexAttrs}`;
    } catch {
        return 'webgl_blocked';
    }
}

async function getAudioFingerprint(): Promise<string> {
    try {
        const AudioCtx =
            window.OfflineAudioContext ||
            (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
        if (!AudioCtx) return 'audio_unsupported';

        const context = new AudioCtx(1, 44100, 44100);
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(10000, context.currentTime);

        const compressor = context.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-50, context.currentTime);
        compressor.knee.setValueAtTime(40, context.currentTime);
        compressor.ratio.setValueAtTime(12, context.currentTime);
        compressor.attack.setValueAtTime(0, context.currentTime);
        compressor.release.setValueAtTime(0.25, context.currentTime);

        oscillator.connect(compressor);
        compressor.connect(context.destination);
        oscillator.start(0);

        const renderedBuffer = await context.startRendering();
        const output = renderedBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 4500; i < 5000; i++) {
            sum += Math.abs(output[i] || 0);
        }
        return `audio_${sum.toFixed(6)}`;
    } catch {
        return 'audio_fallback';
    }
}

export async function getDeviceFingerprint(): Promise<string> {
    if (cachedFingerprint) {
        return cachedFingerprint;
    }

    try {
        const [canvas, webgl, audio] = await Promise.all([
            Promise.resolve(getCanvasFingerprint()),
            Promise.resolve(getWebGLFingerprint()),
            getAudioFingerprint(),
        ]);

        const screenData = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}@${window.devicePixelRatio || 1}`;
        const cores = navigator.hardwareConcurrency || 4;
        const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 0;
        const maxTouchPoints = navigator.maxTouchPoints || 0;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const tzOffset = new Date().getTimezoneOffset();
        const lang = navigator.language || 'es';
        const platform = navigator.platform || '';

        const rawData = [
            canvas,
            webgl,
            audio,
            screenData,
            cores,
            memory,
            maxTouchPoints,
            timezone,
            tzOffset,
            lang,
            platform,
        ].join('|||');

        const hash = await sha256Hex(rawData);
        cachedFingerprint = hash;
        return hash;
    } catch (e) {
        console.warn('Error al calcular huella de dispositivo:', e);
        // Fallback puramente determinista basado en navigator fijo
        const fallbackRaw = `${navigator.userAgent}_${window.screen.width}x${window.screen.height}_${navigator.language}`;
        const fallback = await sha256Hex(fallbackRaw);
        cachedFingerprint = fallback;
        return fallback;
    }
}
