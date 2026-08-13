import { PALETTES } from './constants.js';
import { generatePatternData, generatePatternDataOriginal, mapPixelArtToBeads, medianCut, getFilteredMardPalette } from './processor.js';

const strategies = [
    { id: 'original', name: '原版算法', description: '当前正式基准：区域平均采样与最近色匹配。' },
    { id: 'high', name: '高精度采样', description: '中心加权取样与 DeltaE 匹配，降低单格取色误差。' },
    { id: 'edge', name: '边缘感知采样', description: '按局部色差提高轮廓区域的取样权重。' },
    { id: 'subject', name: '主体与背景分离', description: '以角落背景估计为基准，主体与背景采用不同取样策略。' },
    { id: 'global', name: '全局颜色优化', description: '先从全图选择共享色组，再映射每个网格。' },
    { id: 'dither', name: '结构化抖动', description: '在非纯色区进行误差扩散，改善渐变过渡。' },
    { id: 'shape', name: '形状优先生成', description: '先识别高对比轮廓网格，再分别填充轮廓与内部。' },
    { id: 'craft', name: '可制作性优化', description: '在图纸生成后清除碎块、填补单格孔洞并降低断裂。' }
];

const $ = (id) => document.getElementById(id);
let sourceImageData = null;

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function renderCards() {
    $('complete-results').innerHTML = strategies.map((strategy) => `<article class="overflow-hidden rounded-2xl bg-white shadow-sm"><div class="border-b border-slate-100 px-4 py-3"><div class="flex items-start justify-between gap-3"><div><h2 class="text-sm font-black">${escapeHtml(strategy.name)}</h2><p class="mt-1 text-xs leading-4 text-slate-400">${escapeHtml(strategy.description)}</p></div><span class="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">独立实现</span></div></div><div class="relative aspect-square bg-slate-50"><canvas data-result="${strategy.id}" class="absolute inset-0 h-full w-full object-contain image-pixelated"></canvas><div data-empty="${strategy.id}" class="absolute inset-0 grid place-items-center px-8 text-center text-xs text-slate-400">上传图片后生成</div></div><div data-stats="${strategy.id}" class="grid grid-cols-3 gap-2 border-t border-slate-100 px-4 py-3 text-center text-[11px] text-slate-400"><span>颜色<br><b class="text-slate-700">—</b></span><span>豆数<br><b class="text-slate-700">—</b></span><span>耗时<br><b class="text-slate-700">—</b></span></div></article>`).join('');
}

function getSettings() {
    const maxSide = Math.max(16, Math.min(104, Number($('complete-grid-size').value) || 80));
    const ratio = sourceImageData.width / Math.max(1, sourceImageData.height);
    return { gridWidth: ratio >= 1 ? maxSide : Math.max(16, Math.round(maxSide * ratio)), gridHeight: ratio >= 1 ? Math.max(16, Math.round(maxSide / ratio)) : maxSide, brand: $('complete-brand').value, maxColors: Math.max(4, Math.min(80, Number($('complete-max-colors').value) || 12)) };
}

function pixelAt(imageData, x, y) {
    const sx = Math.max(0, Math.min(imageData.width - 1, x));
    const sy = Math.max(0, Math.min(imageData.height - 1, y));
    const offset = (sy * imageData.width + sx) * 4;
    return { r: imageData.data[offset], g: imageData.data[offset + 1], b: imageData.data[offset + 2], a: imageData.data[offset + 3] };
}

function colorDistance(first, second) { return Math.hypot(first.r - second.r, first.g - second.g, first.b - second.b); }

function edgeStrength(imageData, x, y) {
    const pixel = pixelAt(imageData, x, y);
    return Math.min(1, (colorDistance(pixel, pixelAt(imageData, x + 1, y)) + colorDistance(pixel, pixelAt(imageData, x, y + 1))) / 360);
}

function getCellBounds(imageData, gridWidth, gridHeight, cellX, cellY) {
    return { startX: Math.floor(cellX * imageData.width / gridWidth), startY: Math.floor(cellY * imageData.height / gridHeight), endX: Math.max(Math.floor((cellX + 1) * imageData.width / gridWidth), Math.floor(cellX * imageData.width / gridWidth) + 1), endY: Math.max(Math.floor((cellY + 1) * imageData.height / gridHeight), Math.floor(cellY * imageData.height / gridHeight) + 1) };
}

function averageSamples(samples) {
    if (!samples.length) return { r: 255, g: 255, b: 255, a: 0 };
    const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
    return { r: samples.reduce((sum, sample) => sum + sample.r * sample.weight, 0) / totalWeight, g: samples.reduce((sum, sample) => sum + sample.g * sample.weight, 0) / totalWeight, b: samples.reduce((sum, sample) => sum + sample.b * sample.weight, 0) / totalWeight, a: 255 };
}

function generateEdgeAwarePixelArt(imageData, gridWidth, gridHeight) {
    const result = [];
    for (let cellY = 0; cellY < gridHeight; cellY++) for (let cellX = 0; cellX < gridWidth; cellX++) {
        const bounds = getCellBounds(imageData, gridWidth, gridHeight, cellX, cellY);
        const samples = [];
        let opaque = 0;
        let total = 0;
        for (let y = bounds.startY; y < bounds.endY; y++) for (let x = bounds.startX; x < bounds.endX; x++) {
            total++;
            const pixel = pixelAt(imageData, x, y);
            if (pixel.a < 128) continue;
            opaque++;
            samples.push({ ...pixel, weight: 1 + edgeStrength(imageData, x, y) * 2.5 });
        }
        result.push(opaque / Math.max(1, total) <= 0.22 ? { r: 255, g: 255, b: 255, a: 0 } : averageSamples(samples));
    }
    return result;
}

function estimateBackground(imageData) {
    const corners = [pixelAt(imageData, 0, 0), pixelAt(imageData, imageData.width - 1, 0), pixelAt(imageData, 0, imageData.height - 1), pixelAt(imageData, imageData.width - 1, imageData.height - 1)].filter((pixel) => pixel.a >= 128);
    return averageSamples(corners.map((pixel) => ({ ...pixel, weight: 1 })));
}

function generateSubjectBackgroundPixelArt(imageData, gridWidth, gridHeight) {
    const background = estimateBackground(imageData);
    const result = [];
    for (let cellY = 0; cellY < gridHeight; cellY++) for (let cellX = 0; cellX < gridWidth; cellX++) {
        const bounds = getCellBounds(imageData, gridWidth, gridHeight, cellX, cellY);
        const subject = [];
        const backgroundSamples = [];
        let opaque = 0;
        let total = 0;
        for (let y = bounds.startY; y < bounds.endY; y++) for (let x = bounds.startX; x < bounds.endX; x++) {
            total++;
            const pixel = pixelAt(imageData, x, y);
            if (pixel.a < 128) continue;
            opaque++;
            const edge = edgeStrength(imageData, x, y);
            const isSubject = colorDistance(pixel, background) >= 68 || edge >= 0.16;
            (isSubject ? subject : backgroundSamples).push({ ...pixel, weight: isSubject ? 1 + edge * 3 : 1 });
        }
        if (opaque / Math.max(1, total) <= 0.22) { result.push({ r: 255, g: 255, b: 255, a: 0 }); continue; }
        const subjectRatio = subject.length / Math.max(1, opaque);
        result.push(subjectRatio >= 0.18 ? averageSamples(subject) : averageSamples(backgroundSamples));
    }
    return result;
}

function getPalette(settings) { return settings.brand === 'mard' ? getFilteredMardPalette('221') : (PALETTES[settings.brand] || PALETTES.mard); }
function nearestColor(pixel, palette) { return palette.reduce((best, color) => colorDistance(pixel, color) < colorDistance(pixel, best) ? color : best, palette[0]); }

function generateGlobalPalettePattern(imageData, settings) {
    const samples = [];
    const stride = Math.max(1, Math.floor(Math.sqrt((imageData.width * imageData.height) / 6000)));
    for (let y = 0; y < imageData.height; y += stride) for (let x = 0; x < imageData.width; x += stride) { const pixel = pixelAt(imageData, x, y); if (pixel.a >= 128) samples.push(pixel); }
    const palette = getPalette(settings);
    const selected = [...new Map(medianCut(samples, settings.maxColors).map((color) => { const bead = nearestColor(color, palette); return [bead.id, bead]; })).values()];
    if (!selected.length) return Array.from({ length: settings.gridWidth * settings.gridHeight }, () => ({ id: 'NONE', r: 255, g: 255, b: 255, a: 0 }));
    return generateEdgeAwarePixelArt(imageData, settings.gridWidth, settings.gridHeight).map((pixel) => pixel.a < 128 ? { id: 'NONE', r: 255, g: 255, b: 255, a: 0 } : nearestColor(pixel, selected));
}

function generateShapeFirstPixelArt(imageData, gridWidth, gridHeight) {
    const result = [];
    for (let cellY = 0; cellY < gridHeight; cellY++) for (let cellX = 0; cellX < gridWidth; cellX++) {
        const bounds = getCellBounds(imageData, gridWidth, gridHeight, cellX, cellY);
        const edges = [];
        const interiors = [];
        let opaque = 0;
        let total = 0;
        for (let y = bounds.startY; y < bounds.endY; y++) for (let x = bounds.startX; x < bounds.endX; x++) {
            total++;
            const pixel = pixelAt(imageData, x, y);
            if (pixel.a < 128) continue;
            opaque++;
            const edge = edgeStrength(imageData, x, y);
            (edge >= 0.18 ? edges : interiors).push({ ...pixel, weight: 1 + edge * 2 });
        }
        if (opaque / Math.max(1, total) <= 0.22) { result.push({ r: 255, g: 255, b: 255, a: 0 }); continue; }
        result.push(edges.length / Math.max(1, opaque) >= 0.28 ? averageSamples(edges) : averageSamples(interiors.length ? interiors : edges));
    }
    return result;
}

function optimizeForCraft(pixelData, gridWidth, gridHeight) {
    const output = pixelData.slice();
    const indexOf = (x, y) => y * gridWidth + x;
    const neighbors = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nx, ny]) => nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight);
    const visited = new Uint8Array(output.length);
    for (let start = 0; start < output.length; start++) {
        if (visited[start] || output[start].id === 'NONE') continue;
        const id = output[start].id;
        const region = [];
        const queue = [start];
        visited[start] = 1;
        while (queue.length) {
            const index = queue.shift();
            region.push(index);
            const x = index % gridWidth;
            const y = Math.floor(index / gridWidth);
            for (const [nx, ny] of neighbors(x, y)) { const next = indexOf(nx, ny); if (!visited[next] && output[next].id === id) { visited[next] = 1; queue.push(next); } }
        }
        if (region.length > 2) continue;
        const contacts = new Map();
        for (const index of region) { const x = index % gridWidth; const y = Math.floor(index / gridWidth); for (const [nx, ny] of neighbors(x, y)) { const color = output[indexOf(nx, ny)]; if (color.id !== 'NONE' && color.id !== id) contacts.set(color.id, { color, count: (contacts.get(color.id)?.count || 0) + 1 }); } }
        const target = [...contacts.values()].sort((a, b) => b.count - a.count)[0]?.color;
        if (target) region.forEach((index) => { output[index] = target; });
    }
    for (let y = 1; y < gridHeight - 1; y++) for (let x = 1; x < gridWidth - 1; x++) {
        const index = indexOf(x, y);
        if (output[index].id !== 'NONE') continue;
        const surrounding = neighbors(x, y).map(([nx, ny]) => output[indexOf(nx, ny)]).filter((color) => color.id !== 'NONE');
        const counts = new Map();
        surrounding.forEach((color) => counts.set(color.id, { color, count: (counts.get(color.id)?.count || 0) + 1 }));
        const target = [...counts.values()].sort((a, b) => b.count - a.count)[0];
        if (target?.count >= 3) output[index] = target.color;
    }
    return output;
}

function drawPixels(canvas, pixels, width, height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.aspectRatio = `${width} / ${height}`;
    const context = canvas.getContext('2d');
    const imageData = context.createImageData(width, height);
    pixels.forEach((pixel, index) => { const offset = index * 4; imageData.data[offset] = pixel.r; imageData.data[offset + 1] = pixel.g; imageData.data[offset + 2] = pixel.b; imageData.data[offset + 3] = pixel.a ?? 255; });
    context.putImageData(imageData, 0, 0);
}

function stats(pixels) { const beads = pixels.filter((pixel) => pixel.id !== 'NONE'); return { colors: new Set(beads.map((pixel) => pixel.id)).size, beads: beads.length }; }
function mapPixelArt(pixelArtData, settings) { return mapPixelArtToBeads({ pixelArtData, ...settings, mardSet: '221', isColorLimitEnabled: true, isDitheringEnabled: false, precisionMode: 'standard', colorMatchMode: 'deltae', palettes: PALETTES }); }

function runStrategy(strategy, settings) {
    if (strategy.id === 'original') return generatePatternDataOriginal({ sourceImageData, ...settings, mardSet: '221', isColorLimitEnabled: true, palettes: PALETTES });
    if (strategy.id === 'high') return generatePatternData({ sourceImageData, ...settings, mardSet: '221', isColorLimitEnabled: true, isDitheringEnabled: true, precisionMode: 'high', colorMatchMode: 'deltae', palettes: PALETTES });
    if (strategy.id === 'edge') return mapPixelArt(generateEdgeAwarePixelArt(sourceImageData, settings.gridWidth, settings.gridHeight), settings);
    if (strategy.id === 'subject') return mapPixelArt(generateSubjectBackgroundPixelArt(sourceImageData, settings.gridWidth, settings.gridHeight), settings);
    if (strategy.id === 'global') return generateGlobalPalettePattern(sourceImageData, settings);
    if (strategy.id === 'dither') return generatePatternData({ sourceImageData, ...settings, mardSet: '221', isColorLimitEnabled: true, isDitheringEnabled: true, precisionMode: 'standard', colorMatchMode: 'redmean', palettes: PALETTES });
    if (strategy.id === 'shape') return mapPixelArt(generateShapeFirstPixelArt(sourceImageData, settings.gridWidth, settings.gridHeight), settings);
    return optimizeForCraft(mapPixelArt(generateEdgeAwarePixelArt(sourceImageData, settings.gridWidth, settings.gridHeight), settings), settings.gridWidth, settings.gridHeight);
}

async function loadImage(file) {
    const image = await createImageBitmap(file);
    const preview = $('complete-source-preview');
    const scale = Math.min(1, 260 / image.width);
    preview.width = Math.max(1, Math.round(image.width * scale));
    preview.height = Math.max(1, Math.round(image.height * scale));
    preview.getContext('2d').drawImage(image, 0, 0, preview.width, preview.height);
    $('complete-source-preview-wrap').classList.remove('hidden');
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    sourceImageData = canvas.getContext('2d').getImageData(0, 0, image.width, image.height);
    $('complete-generate-btn').disabled = false;
    $('complete-status').textContent = '图片已载入，可以生成八种独立策略。';
}

async function generate() {
    if (!sourceImageData) return;
    const settings = getSettings();
    $('complete-generate-btn').disabled = true;
    $('complete-status').textContent = '正在生成八种策略…';
    try {
        for (const strategy of strategies) {
            const started = performance.now();
            const pixels = runStrategy(strategy, settings);
            drawPixels(document.querySelector(`[data-result="${strategy.id}"]`), pixels, settings.gridWidth, settings.gridHeight);
            document.querySelector(`[data-empty="${strategy.id}"]`).classList.add('hidden');
            const resultStats = stats(pixels);
            document.querySelector(`[data-stats="${strategy.id}"]`).innerHTML = `<span>颜色<br><b class="text-slate-700">${resultStats.colors}</b></span><span>豆数<br><b class="text-slate-700">${resultStats.beads}</b></span><span>耗时<br><b class="text-slate-700">${Math.round(performance.now() - started)}ms</b></span>`;
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        $('complete-status').textContent = '生成完成。请用不同主体、背景和透明图片对照评估。';
    } catch (error) {
        console.error(error);
        $('complete-status').textContent = '生成失败，请检查图片或参数后重试。';
    } finally { $('complete-generate-btn').disabled = false; }
}

renderCards();
$('complete-image-input').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) loadImage(file).catch(() => { $('complete-status').textContent = '图片读取失败，请重试。'; }); });
$('complete-generate-btn').addEventListener('click', generate);
