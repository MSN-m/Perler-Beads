/** Non-destructive source-image adjustments; UI values are integer -10..10. */
export const IMAGE_ADJUSTMENT_KEYS = ['brightness', 'contrast', 'saturation'];

export function normalizeImageAdjustments(settings = {}) {
    return Object.fromEntries(IMAGE_ADJUSTMENT_KEYS.map(key => {
        const value = Number(settings?.[key]);
        return [key, Number.isFinite(value) ? Math.max(-10, Math.min(10, Math.round(value))) : 0];
    }));
}

export function applyImageAdjustments(source, settings) {
    const { brightness, contrast, saturation } = normalizeImageAdjustments(settings);
    // Preserve the existing generation path byte-for-byte at neutral settings.
    if (!brightness && !contrast && !saturation) return source;
    const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
    const offset = brightness * 12.75;
    const factor = 2 ** (contrast / 5);
    const strength = 1 + saturation / 10;
    const clamp = value => Math.max(0, Math.min(255, value));
    for (let i = 0; i < output.data.length; i += 4) {
        if (!output.data[i + 3]) continue;
        const r = (source.data[i] + offset - 127.5) * factor + 127.5;
        const g = (source.data[i + 1] + offset - 127.5) * factor + 127.5;
        const b = (source.data[i + 2] + offset - 127.5) * factor + 127.5;
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        output.data[i] = clamp(gray + (r - gray) * strength);
        output.data[i + 1] = clamp(gray + (g - gray) * strength);
        output.data[i + 2] = clamp(gray + (b - gray) * strength);
    }
    return output;
}
