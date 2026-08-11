import { PALETTES } from './constants.js';
import { generatePatternData, medianCut } from './processor.js?flatness-pure-v2';

const $ = id => document.getElementById(id);
let sourceImageData = null;

function samplePixels(imageData, stride = 4) {
    const pixels = [];
    for (let y = 0; y < imageData.height; y += stride) {
        for (let x = 0; x < imageData.width; x += stride) {
            const o = (y * imageData.width + x) * 4;
            if (imageData.data[o + 3] >= 128) pixels.push({ r: imageData.data[o], g: imageData.data[o + 1], b: imageData.data[o + 2] });
        }
    }
    return pixels;
}

function nearestColor(pixel, palette) {
    let best = palette[0]; let bestDistance = Infinity;
    for (const color of palette) {
        const dr = pixel.r - color.r; const dg = pixel.g - color.g; const db = pixel.b - color.b;
        const distance = dr * dr + dg * dg + db * db;
        if (distance < bestDistance) { bestDistance = distance; best = color; }
    }
    return best;
}

function pixelAt(imageData, x, y) {
    const sx = Math.max(0, Math.min(imageData.width - 1, x));
    const sy = Math.max(0, Math.min(imageData.height - 1, y));
    const o = (sy * imageData.width + sx) * 4;
    return { r: imageData.data[o], g: imageData.data[o + 1], b: imageData.data[o + 2], a: imageData.data[o + 3] };
}

function rgbDistance(a, b) { return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b); }

function localAverage(imageData, x, y) {
    let r = 0, g = 0, b = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const pixel = pixelAt(imageData, x + dx, y + dy);
            if (pixel.a < 128) continue;
            r += pixel.r; g += pixel.g; b += pixel.b; count++;
        }
    }
    return count ? { r: r / count, g: g / count, b: b / count, a: 255 } : pixelAt(imageData, x, y);
}

function buildBackground(imageData) {
    const corners = [pixelAt(imageData, 0, 0), pixelAt(imageData, imageData.width - 1, 0), pixelAt(imageData, 0, imageData.height - 1), pixelAt(imageData, imageData.width - 1, imageData.height - 1)];
    return corners.reduce((sum, pixel) => ({ r: sum.r + pixel.r / corners.length, g: sum.g + pixel.g / corners.length, b: sum.b + pixel.b / corners.length }), { r: 0, g: 0, b: 0 });
}

function quantizeImage(imageData, colorCount, protectedMode, detailStrength, backgroundStrength) {
    const sourcePixels = samplePixels(imageData, Math.max(1, Math.floor(Math.max(imageData.width, imageData.height) / 500)));
    const palette = medianCut(sourcePixels, colorCount);
    const background = buildBackground(imageData);
    const result = new Array(imageData.width * imageData.height);
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const pixel = pixelAt(imageData, x, y);
            if (pixel.a < 128) { result[y * imageData.width + x] = { r: 255, g: 255, b: 255, a: 0 }; continue; }
            const right = pixelAt(imageData, x + 1, y); const down = pixelAt(imageData, x, y + 1);
            const edge = Math.min(1, (rgbDistance(pixel, right) + rgbDistance(pixel, down)) / 360);
            const backgroundDistance = rgbDistance(pixel, background) / 441;
            const detailBias = protectedMode ? Math.min(1.5, edge * detailStrength * 2.2) : 0;
            const backgroundBias = protectedMode ? Math.max(0, 1 - backgroundDistance) * backgroundStrength : 0;
            const smoothing = protectedMode ? Math.min(0.85, Math.max(0, backgroundStrength) * (1 - edge) * 0.9) : 0;
            const smoothed = smoothing > 0.02 ? localAverage(imageData, x, y) : pixel;
            const workingPixel = { r: pixel.r * (1 - smoothing) + smoothed.r * smoothing, g: pixel.g * (1 - smoothing) + smoothed.g * smoothing, b: pixel.b * (1 - smoothing) + smoothed.b * smoothing };
            const contrastFactor = 1 + detailBias * 0.75;
            const adjusted = { r: Math.max(0, Math.min(255, (workingPixel.r - 128) * contrastFactor + 128)), g: Math.max(0, Math.min(255, (workingPixel.g - 128) * contrastFactor + 128)), b: Math.max(0, Math.min(255, (workingPixel.b - 128) * contrastFactor + 128)) };
            const color = nearestColor(adjusted, palette);
            result[y * imageData.width + x] = { r: color.r, g: color.g, b: color.b, a: 255 };
            // 背景简化只影响调色强度，不直接覆盖背景像素，避免整张图被冲成单一浅色。
            if (backgroundBias > 0.02 && edge < 0.12) {
                const backgroundColor = nearestColor(background, palette);
                const current = result[y * imageData.width + x];
                const mix = Math.min(0.85, backgroundBias * 0.75);
                result[y * imageData.width + x] = { r: current.r * (1 - mix) + backgroundColor.r * mix, g: current.g * (1 - mix) + backgroundColor.g * mix, b: current.b * (1 - mix) + backgroundColor.b * mix, a: 255 };
            }
        }
    }
    return result;
}

function quantizeRegionImage(imageData, detailStrength, backgroundStrength) {
    const background = buildBackground(imageData);
    const records = [];
    const foregroundSamples = [];
    const backgroundSamples = [];
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const pixel = pixelAt(imageData, x, y);
            if (pixel.a < 128) { records.push({ pixel, x, y, foreground: false, detail: false }); continue; }
            const edge = Math.min(1, (rgbDistance(pixel, pixelAt(imageData, x + 1, y)) + rgbDistance(pixel, pixelAt(imageData, x, y + 1))) / 360);
            const backgroundDistance = rgbDistance(pixel, background) / 441;
            const localContrast = rgbDistance(pixel, localAverage(imageData, x, y)) / 441;
            const detail = edge > 0.18 || localContrast > 0.16 || (pixel.r + pixel.g + pixel.b) / 3 < 90;
            const foreground = backgroundDistance > 0.14 || edge > 0.10 || localContrast > 0.12;
            records.push({ pixel, x, y, foreground, detail, edge });
            if (foreground || detail) foregroundSamples.push(pixel); else backgroundSamples.push(pixel);
        }
    }
    const paletteStride = Math.max(1, Math.floor(records.length / 300000));
    const foregroundPalette = medianCut(foregroundSamples.filter((_, index) => index % paletteStride === 0), 8);
    const backgroundPalette = medianCut(backgroundSamples.filter((_, index) => index % paletteStride === 0), 3);
    return records.map(record => {
        if (record.pixel.a < 128) return { r: 255, g: 255, b: 255, a: 0 };
        const palette = record.foreground || record.detail ? foregroundPalette : backgroundPalette;
        const smoothing = record.detail ? 0 : Math.min(0.95, 0.70 + backgroundStrength * 0.30);
        const local = smoothing ? localAverage(imageData, record.x, record.y) : record.pixel;
        const blended = { r: record.pixel.r * (1 - smoothing) + local.r * smoothing, g: record.pixel.g * (1 - smoothing) + local.g * smoothing, b: record.pixel.b * (1 - smoothing) + local.b * smoothing };
        const posterizeStep = record.detail ? 12 : Math.max(18, 42 - backgroundStrength * 18);
        const working = { r: Math.round(blended.r / posterizeStep) * posterizeStep, g: Math.round(blended.g / posterizeStep) * posterizeStep, b: Math.round(blended.b / posterizeStep) * posterizeStep };
        const contrast = 1 + record.edge * Math.max(0.8, detailStrength) * 1.5;
        const adjusted = { r: Math.max(0, Math.min(255, (working.r - 128) * contrast + 128)), g: Math.max(0, Math.min(255, (working.g - 128) * contrast + 128)), b: Math.max(0, Math.min(255, (working.b - 128) * contrast + 128)) };
        const matched = nearestColor(adjusted, palette.length ? palette : [background]);
        if (!record.foreground && !record.detail && backgroundStrength > 0) {
            const backgroundColor = nearestColor(background, palette.length ? palette : [background]);
            const mix = Math.min(0.35, backgroundStrength * (1 - record.edge) * 0.35);
            return { r: matched.r * (1 - mix) + backgroundColor.r * mix, g: matched.g * (1 - mix) + backgroundColor.g * mix, b: matched.b * (1 - mix) + backgroundColor.b * mix, a: 255 };
        }
        return { ...matched, a: 255 };
    });
}

function draw(canvas, pixels, width, height) {
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); const imageData = ctx.createImageData(width, height);
    pixels.forEach((pixel, index) => { const o = index * 4; imageData.data[o] = pixel.r; imageData.data[o + 1] = pixel.g; imageData.data[o + 2] = pixel.b; imageData.data[o + 3] = pixel.a ?? 255; });
    ctx.putImageData(imageData, 0, 0);
}

function stats(pixels) { return new Set(pixels.filter(pixel => pixel.id || pixel.a >= 128).map(pixel => pixel.id || `${Math.round(pixel.r / 16)}-${Math.round(pixel.g / 16)}-${Math.round(pixel.b / 16)}`)).size; }
function syncOutputs() { $('flat-detail-output').value = Number($('flat-detail').value).toFixed(2); $('flat-background-output').value = Number($('flat-background').value).toFixed(2); }

async function generate() {
    if (!sourceImageData) return;
    $('flat-generate-btn').disabled = true; $('flat-status').textContent = '正在生成纯扁平化对比...';
    const started = performance.now();
    const current = generatePatternData({ sourceImageData, gridWidth: 100, gridHeight: 100, brand: 'mard', mardSet: '221', isColorLimitEnabled: true, maxColors: 12, isDitheringEnabled: false, precisionMode: 'standard', colorMatchMode: 'redmean', palettes: PALETTES });
    draw($('flat-current-canvas'), current, 100, 100); $('flat-current-empty').classList.add('hidden');
    const protectedPixels = quantizeRegionImage(sourceImageData, Number($('flat-detail').value), Number($('flat-background').value));
    draw($('flat-protected-canvas'), protectedPixels, sourceImageData.width, sourceImageData.height); $('flat-protected-empty').classList.add('hidden');
    const elapsed = Math.round(performance.now() - started);
    $('flat-current-stats').innerHTML = `正式页面效果<br><b>${stats(current)}</b> 色　耗时 <b>${elapsed}ms</b>`;
    $('flat-protected-stats').innerHTML = `色彩采样<br><b>${stats(protectedPixels)}</b>　耗时<br><b>${elapsed}ms</b>`;
    $('flat-status').textContent = '生成完成。当前只比较纯扁平化效果。'; $('flat-generate-btn').disabled = false;
}

$('flat-image-input').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const image = await createImageBitmap(file); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); sourceImageData = ctx.getImageData(0, 0, image.width, image.height); $('flat-generate-btn').disabled = false; $('flat-status').textContent = '图片已载入，可以生成纯扁平化结果。'; } catch (error) { console.error(error); $('flat-status').textContent = '图片读取失败，请重试。'; }
});
['flat-detail', 'flat-background'].forEach(id => $(id).addEventListener('input', syncOutputs));
$('flat-generate-btn').addEventListener('click', () => generate().catch(error => { console.error(error); $('flat-status').textContent = '生成失败，请重试。'; $('flat-generate-btn').disabled = false; }));
syncOutputs();
