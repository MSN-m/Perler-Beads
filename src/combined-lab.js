import { PALETTES } from './constants.js';
import { generatePatternData, generatePatternDataProtected } from './processor.js';

const $ = (id) => document.getElementById(id);
let sourceImageData = null;

function pixelAt(imageData, x, y) {
    const sx = Math.max(0, Math.min(imageData.width - 1, x));
    const sy = Math.max(0, Math.min(imageData.height - 1, y));
    const offset = (sy * imageData.width + sx) * 4;
    return { r: imageData.data[offset], g: imageData.data[offset + 1], b: imageData.data[offset + 2], a: imageData.data[offset + 3] };
}

function rgbDistance(first, second) {
    return Math.hypot(first.r - second.r, first.g - second.g, first.b - second.b);
}

function createMediumFlattenedImage(imageData) {
    const maxSide = 360;
    const scale = Math.max(1, Math.ceil(Math.max(imageData.width, imageData.height) / maxSide));
    const width = Math.ceil(imageData.width / scale);
    const height = Math.ceil(imageData.height / scale);
    const cellCount = width * height;
    const colorStep = 23;
    const labels = new Int32Array(cellCount);
    const colors = new Array(cellCount);
    const regions = [];
    const queue = new Int32Array(cellCount);
    labels.fill(-1);

    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) colors[y * width + x] = pixelAt(imageData, x * scale, y * scale);
    const colorKey = (pixel) => pixel.a < 128 ? 'transparent' : `${Math.round(pixel.r / colorStep)},${Math.round(pixel.g / colorStep)},${Math.round(pixel.b / colorStep)}`;

    for (let start = 0; start < cellCount; start++) {
        if (labels[start] !== -1) continue;
        const regionId = regions.length;
        const key = colorKey(colors[start]);
        const members = [];
        let head = 0;
        let tail = 0;
        let r = 0;
        let g = 0;
        let b = 0;
        queue[tail++] = start;
        labels[start] = regionId;
        while (head < tail) {
            const index = queue[head++];
            const pixel = colors[index];
            members.push(index);
            r += pixel.r;
            g += pixel.g;
            b += pixel.b;
            const x = index % width;
            for (const next of [index - 1, index + 1, index - width, index + width]) {
                if (next < 0 || next >= cellCount || labels[next] !== -1 || Math.abs((next % width) - x) > 1) continue;
                if (colorKey(colors[next]) === key) { labels[next] = regionId; queue[tail++] = next; }
            }
        }
        regions.push({ members, color: { r: r / members.length, g: g / members.length, b: b / members.length }, active: true });
    }

    const minRegionSize = 18;
    for (const region of regions) {
        if (!region.active || region.members.length >= minRegionSize) continue;
        let targetId = -1;
        let bestDistance = Infinity;
        for (const index of region.members) {
            const x = index % width;
            for (const next of [index - 1, index + 1, index - width, index + width]) {
                if (next < 0 || next >= cellCount || Math.abs((next % width) - x) > 1) continue;
                const candidateId = labels[next];
                const candidate = regions[candidateId];
                if (!candidate || candidate === region || !candidate.active) continue;
                const distance = rgbDistance(region.color, candidate.color);
                if (distance < bestDistance) { bestDistance = distance; targetId = candidateId; }
            }
        }
        if (targetId >= 0 && bestDistance < 62) {
            for (const index of region.members) labels[index] = targetId;
            regions[targetId].members.push(...region.members);
            region.active = false;
        }
    }

    const output = new ImageData(imageData.width, imageData.height);
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const source = pixelAt(imageData, x, y);
            const offset = (y * imageData.width + x) * 4;
            if (source.a < 128) { output.data[offset + 3] = 0; continue; }
            const region = regions[labels[Math.min(height - 1, Math.floor(y / scale)) * width + Math.min(width - 1, Math.floor(x / scale))]];
            output.data[offset] = Math.round(region?.color.r ?? source.r);
            output.data[offset + 1] = Math.round(region?.color.g ?? source.g);
            output.data[offset + 2] = Math.round(region?.color.b ?? source.b);
            output.data[offset + 3] = 255;
        }
    }
    return output;
}

function getSettings() {
    const maxSide = Math.max(16, Math.min(104, Number($('combined-grid-size').value) || 80));
    const ratio = sourceImageData.width / Math.max(1, sourceImageData.height);
    return {
        gridWidth: ratio >= 1 ? maxSide : Math.max(16, Math.round(maxSide * ratio)),
        gridHeight: ratio >= 1 ? Math.max(16, Math.round(maxSide / ratio)) : maxSide,
        brand: $('combined-brand').value,
        maxColors: Math.max(4, Math.min(80, Number($('combined-max-colors').value) || 12))
    };
}

function draw(canvas, pixels, width, height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.aspectRatio = `${width} / ${height}`;
    const context = canvas.getContext('2d');
    const output = context.createImageData(width, height);
    pixels.forEach((pixel, index) => {
        const offset = index * 4;
        output.data[offset] = pixel.r;
        output.data[offset + 1] = pixel.g;
        output.data[offset + 2] = pixel.b;
        output.data[offset + 3] = pixel.a ?? 255;
    });
    context.putImageData(output, 0, 0);
}

function drawImageData(canvas, imageData) {
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.style.aspectRatio = `${imageData.width} / ${imageData.height}`;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
}

function beadStats(pixels) {
    const beads = pixels.filter((pixel) => pixel.id !== 'NONE');
    return { colors: new Set(beads.map((pixel) => pixel.id)).size, beads: beads.length };
}

function imageColorCount(imageData) {
    const colors = new Set();
    for (let offset = 0; offset < imageData.data.length; offset += 4) {
        if (imageData.data[offset + 3] < 128) continue;
        colors.add(`${Math.round(imageData.data[offset] / 16)}-${Math.round(imageData.data[offset + 1] / 16)}-${Math.round(imageData.data[offset + 2] / 16)}`);
    }
    return colors.size;
}

function setBusy(isBusy) {
    $('combined-generate-btn').disabled = isBusy;
    $('combined-generate-spinner').classList.toggle('hidden', !isBusy);
    $('combined-generate-label').textContent = isBusy ? '生成中…' : '重新生成同条件对照';
    $('combined-loading-overlay').classList.toggle('hidden', !isBusy);
    $('combined-loading-overlay').classList.toggle('flex', isBusy);
}

async function generate() {
    if (!sourceImageData) return;
    const settings = getSettings();
    setBusy(true);
    try {
        $('combined-loading-text').textContent = '正在准备原图与中强度扁平化…';
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        drawImageData($('combined-source-canvas'), sourceImageData);
        $('combined-source-empty').classList.add('hidden');
        $('combined-source-stats').innerHTML = `尺寸<br><b>${sourceImageData.width} × ${sourceImageData.height}</b>`;

        const flatStarted = performance.now();
        const flattened = createMediumFlattenedImage(sourceImageData);
        drawImageData($('combined-flat-canvas'), flattened);
        $('combined-flat-empty').classList.add('hidden');
        $('combined-flat-stats').innerHTML = `区域色数<br><b>${imageColorCount(flattened)}</b>　耗时 <b>${Math.round(performance.now() - flatStarted)}ms</b>`;

        $('combined-loading-text').textContent = '正在生成正式基准…';
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const originalStarted = performance.now();
        const original = generatePatternData({ sourceImageData, ...settings, mardSet: '221', isColorLimitEnabled: true, isDitheringEnabled: false, precisionMode: 'standard', colorMatchMode: 'redmean', palettes: PALETTES });
        const originalStats = beadStats(original);
        draw($('combined-original-canvas'), original, settings.gridWidth, settings.gridHeight);
        $('combined-original-empty').classList.add('hidden');
        $('combined-original-stats').innerHTML = `颜色 <b>${originalStats.colors}</b>　豆数 <b>${originalStats.beads}</b><br>耗时 <b>${Math.round(performance.now() - originalStarted)}ms</b>`;

        $('combined-loading-text').textContent = '正在生成组合方案…';
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const combinedStarted = performance.now();
        const combined = generatePatternDataProtected({ sourceImageData: flattened, ...settings, mardSet: '221', isColorLimitEnabled: true, subjectThreshold: 0.38, edgeStrength: 0.75, detailStrength: 0.70, colorWeight: 1.20, continuityWeight: 0.15, palettes: PALETTES });
        const combinedStats = beadStats(combined);
        draw($('combined-result-canvas'), combined, settings.gridWidth, settings.gridHeight);
        $('combined-result-empty').classList.add('hidden');
        $('combined-result-stats').innerHTML = `颜色 <b>${combinedStats.colors}</b>　豆数 <b>${combinedStats.beads}</b><br>耗时 <b>${Math.round(performance.now() - combinedStarted)}ms</b>`;
        $('combined-status').textContent = `生成完成：两种图纸均使用 ${settings.gridWidth} × ${settings.gridHeight} 网格、${settings.brand.toUpperCase()} 色板和 ${settings.maxColors} 色上限。`;
    } catch (error) {
        console.error(error);
        $('combined-status').textContent = '生成失败，请检查图片后重试。';
    } finally {
        setBusy(false);
    }
}

function openZoom(canvas) {
    const zoomCanvas = $('combined-zoom-canvas');
    zoomCanvas.width = canvas.width;
    zoomCanvas.height = canvas.height;
    zoomCanvas.style.imageRendering = canvas.classList.contains('image-pixelated') ? 'pixelated' : 'auto';
    zoomCanvas.getContext('2d').drawImage(canvas, 0, 0);
    $('combined-zoom-modal').classList.replace('hidden', 'flex');
}

function closeZoom() { $('combined-zoom-modal').classList.replace('flex', 'hidden'); }

$('combined-image-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const image = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        sourceImageData = context.getImageData(0, 0, image.width, image.height);
        $('combined-generate-btn').disabled = false;
        $('combined-status').textContent = '图片已载入，可以生成同条件对照。';
    } catch (error) {
        console.error(error);
        $('combined-status').textContent = '图片读取失败，请重试。';
    }
});

$('combined-generate-btn').addEventListener('click', generate);
['combined-source-canvas', 'combined-flat-canvas', 'combined-original-canvas', 'combined-result-canvas'].forEach((id) => $(id).addEventListener('click', () => openZoom($(id))));
$('combined-zoom-close').addEventListener('click', closeZoom);
$('combined-zoom-modal').addEventListener('click', (event) => { if (event.target.id === 'combined-zoom-modal') closeZoom(); });
