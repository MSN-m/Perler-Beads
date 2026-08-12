import { PALETTES } from './constants.js';
import { generatePatternData, medianCut } from './processor.js?flatness-pure-v3';

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
    const maxSide = 360;
    const scale = Math.max(1, Math.ceil(Math.max(imageData.width, imageData.height) / maxSide));
    const width = Math.ceil(imageData.width / scale);
    const height = Math.ceil(imageData.height / scale);
    const regionSize = Math.max(8, Math.round(22 - detailStrength * 8));
    const colorStep = Math.max(12, Math.round(34 - detailStrength * 12));
    const count = width * height;
    const labels = new Int32Array(count); labels.fill(-1);
    const colors = new Array(count);
    const keyOf = pixel => `${Math.round(pixel.r / colorStep)},${Math.round(pixel.g / colorStep)},${Math.round(pixel.b / colorStep)}`;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) colors[y * width + x] = pixelAt(imageData, x * scale, y * scale);

    const regions = [];
    const queue = new Int32Array(count);
    for (let start = 0; start < count; start++) {
        if (labels[start] !== -1) continue;
        const id = regions.length; const key = keyOf(colors[start]); let head = 0; let tail = 0;
        queue[tail++] = start; labels[start] = id; const members = []; let r = 0; let g = 0; let b = 0;
        while (head < tail) {
            const index = queue[head++]; members.push(index); const p = colors[index]; r += p.r; g += p.g; b += p.b;
            const x = index % width; const y = Math.floor(index / width);
            for (const next of [index - 1, index + 1, index - width, index + width]) {
                if (next < 0 || next >= count || labels[next] !== -1) continue;
                const nx = next % width; if (Math.abs(nx - x) > 1) continue;
                if (keyOf(colors[next]) === key) { labels[next] = id; queue[tail++] = next; }
            }
        }
        regions.push({ members, color: { r: r / members.length, g: g / members.length, b: b / members.length }, active: true });
    }

    const minSize = Math.max(2, Math.round(regionSize * (0.55 + backgroundStrength * 1.5)));
    for (const region of regions) {
        if (region.members.length >= minSize) continue;
        let best = -1; let bestDistance = Infinity;
        for (const index of region.members) {
            const x = index % width; const y = Math.floor(index / width);
            for (const next of [index - 1, index + 1, index - width, index + width]) {
                if (next < 0 || next >= count || labels[next] === -1) continue;
                const neighbor = regions[labels[next]]; if (neighbor === region || !neighbor.active) continue;
                const luminanceDistance = Math.abs((region.color.r * 0.2126 + region.color.g * 0.7152 + region.color.b * 0.0722) - (neighbor.color.r * 0.2126 + neighbor.color.g * 0.7152 + neighbor.color.b * 0.0722));
                if (luminanceDistance > 28 + detailStrength * 12) continue;
                const distance = rgbDistance(region.color, neighbor.color) + luminanceDistance * 0.8;
                if (distance < bestDistance) { bestDistance = distance; best = labels[next]; }
            }
        }
        if (best < 0) continue;
        for (const index of region.members) labels[index] = best;
        regions[best].members.push(...region.members); region.active = false;
    }
    const result = new Array(imageData.width * imageData.height);
    for (let y = 0; y < imageData.height; y++) for (let x = 0; x < imageData.width; x++) {
        const source = pixelAt(imageData, x, y); if (source.a < 128) { result[y * imageData.width + x] = { r: 255, g: 255, b: 255, a: 0 }; continue; }
        const region = regions[labels[Math.min(height - 1, Math.floor(y / scale)) * width + Math.min(width - 1, Math.floor(x / scale))]];
        const color = region?.color || source;
        // 保留区域平均色，不再映射到全局调色板，避免整体偏暗、偏灰。
        result[y * imageData.width + x] = { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b), a: 255 };
    }
    return result;
}

function draw(canvas, pixels, width, height) {
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); const imageData = ctx.createImageData(width, height);
    pixels.forEach((pixel, index) => { const o = index * 4; imageData.data[o] = pixel.r; imageData.data[o + 1] = pixel.g; imageData.data[o + 2] = pixel.b; imageData.data[o + 3] = pixel.a ?? 255; });
    ctx.putImageData(imageData, 0, 0);
}

function stats(pixels) { return new Set(pixels.filter(pixel => pixel.id || pixel.a >= 128).map(pixel => pixel.id || `${Math.round(pixel.r / 16)}-${Math.round(pixel.g / 16)}-${Math.round(pixel.b / 16)}`)).size; }
async function generate() {
    if (!sourceImageData) return;
    $('flat-generate-btn').disabled = true;
    $('flat-generate-spinner').classList.remove('hidden');
    $('flat-generate-label').textContent = '生成中...';
    $('flat-loading-overlay').classList.remove('hidden');
    $('flat-loading-overlay').classList.add('flex');
    $('flat-status').textContent = '正在生成原图和 4 组对比方案...';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    draw($('flat-source-canvas'), Array.from({ length: sourceImageData.width * sourceImageData.height }, (_, index) => {
        const offset = index * 4;
        return { r: sourceImageData.data[offset], g: sourceImageData.data[offset + 1], b: sourceImageData.data[offset + 2], a: sourceImageData.data[offset + 3] };
    }), sourceImageData.width, sourceImageData.height);
    $('flat-source-empty').classList.add('hidden');
    $('flat-source-stats').innerHTML = `原图<br><b>${sourceImageData.width}×${sourceImageData.height}</b>`;
    const originalStarted = performance.now();
    const original = generatePatternData({ sourceImageData, gridWidth: 100, gridHeight: 100, brand: 'mard', mardSet: '221', isColorLimitEnabled: true, maxColors: 12, isDitheringEnabled: false, precisionMode: 'standard', colorMatchMode: 'redmean', palettes: PALETTES });
    draw($('flat-original-canvas'), original, 100, 100);
    $('flat-original-empty').classList.add('hidden');
    $('flat-original-stats').innerHTML = `正式页面效果<br><b>${stats(original)}</b> 色　耗时 <b>${Math.round(performance.now() - originalStarted)}ms</b>`;
    const presets = [
        ['low', 'flat-low', 0.45, 0.15],
        ['medium', 'flat-medium', 0.90, 0.45],
        ['high', 'flat-high', 1.35, 0.85]
    ];
    for (const [, prefix, detail, background] of presets) {
        $('flat-loading-text').textContent = `正在生成${prefix === 'flat-low' ? '低强度' : prefix === 'flat-medium' ? '中强度' : '高强度'}方案...`;
        const started = performance.now();
        const pixels = quantizeRegionImage(sourceImageData, detail, background);
        draw($(`${prefix}-canvas`), pixels, sourceImageData.width, sourceImageData.height);
        $(`${prefix}-empty`).classList.add('hidden');
        $(`${prefix}-stats`).innerHTML = `色彩采样<br><b>${stats(pixels)}</b>　耗时 <b>${Math.round(performance.now() - started)}ms</b>`;
    }
    $('flat-status').textContent = '生成完成。当前只比较纯扁平化效果。';
    $('flat-loading-overlay').classList.add('hidden');
    $('flat-loading-overlay').classList.remove('flex');
    $('flat-generate-spinner').classList.add('hidden');
    $('flat-generate-label').textContent = '重新生成对比结果';
    $('flat-generate-btn').disabled = false;
}

function openZoom(canvas) {
    const zoomCanvas = $('flat-zoom-canvas');
    zoomCanvas.width = canvas.width;
    zoomCanvas.height = canvas.height;
    zoomCanvas.style.imageRendering = canvas.classList.contains('image-pixelated') ? 'pixelated' : 'auto';
    zoomCanvas.getContext('2d').drawImage(canvas, 0, 0);
    $('flat-zoom-modal').classList.remove('hidden');
    $('flat-zoom-modal').classList.add('flex');
}

function closeZoom() {
    $('flat-zoom-modal').classList.add('hidden');
    $('flat-zoom-modal').classList.remove('flex');
}

$('flat-image-input').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const image = await createImageBitmap(file); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); sourceImageData = ctx.getImageData(0, 0, image.width, image.height); $('flat-generate-btn').disabled = false; $('flat-status').textContent = '图片已载入，可以生成纯扁平化结果。'; } catch (error) { console.error(error); $('flat-status').textContent = '图片读取失败，请重试。'; }
});
$('flat-generate-btn').addEventListener('click', () => generate().catch(error => {
    console.error(error);
    $('flat-loading-overlay').classList.add('hidden');
    $('flat-loading-overlay').classList.remove('flex');
    $('flat-generate-spinner').classList.add('hidden');
    $('flat-generate-label').textContent = '重新生成对比结果';
    $('flat-status').textContent = '生成失败，请重试。';
    $('flat-generate-btn').disabled = false;
}));
['flat-source-canvas', 'flat-original-canvas', 'flat-low-canvas', 'flat-medium-canvas', 'flat-high-canvas'].forEach(id => $(id).addEventListener('click', () => openZoom($(id))));
$('flat-zoom-close').addEventListener('click', closeZoom);
$('flat-zoom-modal').addEventListener('click', event => { if (event.target.id === 'flat-zoom-modal') closeZoom(); });
