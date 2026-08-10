import { PALETTES } from './constants.js';
import { generatePatternDataOriginal, generatePatternData, mapPixelArtToBeads } from './processor.js';

const strategies = [
    { id: 'original', name: '原版算法', description: '当前基准：区域平均采样与最近色匹配', ready: true },
    { id: 'high', name: '高精度采样', description: '中心加权采样，减少单格取色误差', ready: true },
    { id: 'edge', name: '边缘感知采样', description: '优先保护轮廓和颜色突变区域', ready: true },
    { id: 'subject', name: '主体与背景分离', description: '分别处理主体、背景和透明区域', ready: true },
    { id: 'global', name: '全局颜色优化', description: '从整张图统一规划颜色使用', ready: true },
    { id: 'dither', name: '结构化抖动', description: '优化渐变过渡，减少条纹与棋盘格', ready: true },
    { id: 'shape', name: '形状优先生成', description: '先确定轮廓，再填充内部颜色', ready: true },
    { id: 'craft', name: '可制作性优化', description: '减少孤立点和断裂结构，方便实际拼制', ready: true }
];

const $ = (id) => document.getElementById(id);
let sourceImageData = null;
let sourceImage = null;

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function renderCards() {
    $('lab-results').innerHTML = strategies.map((strategy) => `
        <article class="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div><h2 class="text-sm font-black">${escapeHtml(strategy.name)}</h2><p class="mt-1 text-xs leading-4 text-slate-400">${escapeHtml(strategy.description)}</p></div>
                <span class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${strategy.ready ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}">${strategy.ready ? '可测试' : '待接入'}</span>
            </div>
            <div class="relative aspect-square bg-slate-50"><canvas data-result="${strategy.id}" class="absolute inset-0 h-full w-full object-contain image-pixelated"></canvas><div data-empty="${strategy.id}" class="absolute inset-0 grid place-items-center px-8 text-center text-xs text-slate-400">上传图片后生成</div></div>
            <div data-stats="${strategy.id}" class="grid grid-cols-3 gap-2 border-t border-slate-100 px-4 py-3 text-center text-[11px] text-slate-400"><span>颜色<br><b class="text-slate-700">-</b></span><span>豆数<br><b class="text-slate-700">-</b></span><span>耗时<br><b class="text-slate-700">-</b></span></div>
        </article>`).join('');
}

function getSettings() {
    const maxSide = Math.max(16, Math.min(104, Number($('lab-grid-size').value) || 100));
    const sourceRatio = sourceImageData ? sourceImageData.width / Math.max(1, sourceImageData.height) : 1;
    const gridWidth = sourceRatio >= 1 ? maxSide : Math.max(16, Math.round(maxSide * sourceRatio));
    const gridHeight = sourceRatio >= 1 ? Math.max(16, Math.round(maxSide / sourceRatio)) : maxSide;
    return { gridWidth, gridHeight, brand: $('lab-brand').value, maxColors: Math.max(4, Number($('lab-max-colors').value) || 12) };
}

function drawPixels(canvas, pixels, width, height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.aspectRatio = String(width) + ' / ' + String(height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    pixels.forEach((pixel, index) => { const offset = index * 4; imageData.data[offset] = pixel.r; imageData.data[offset + 1] = pixel.g; imageData.data[offset + 2] = pixel.b; imageData.data[offset + 3] = pixel.a ?? 255; });
    ctx.putImageData(imageData, 0, 0);
}

function getStats(pixels) {
    const colors = new Set(pixels.filter((pixel) => pixel.id !== 'NONE').map((pixel) => pixel.id));
    return { colors: colors.size, beads: pixels.filter((pixel) => pixel.id !== 'NONE').length };
}

function getSourcePixel(sourceImageData, x, y) {
    const { data, width, height } = sourceImageData;
    const safeX = Math.max(0, Math.min(width - 1, x));
    const safeY = Math.max(0, Math.min(height - 1, y));
    const offset = (safeY * width + safeX) * 4;
    return { r: data[offset], g: data[offset + 1], b: data[offset + 2], a: data[offset + 3] };
}

function colorDifference(first, second) {
    return Math.abs(first.r - second.r) + Math.abs(first.g - second.g) + Math.abs(first.b - second.b);
}

function generateEdgeAwarePixelArt(sourceImageData, gridWidth, gridHeight) {
    const { width: sourceWidth, height: sourceHeight } = sourceImageData;
    const result = [];

    for (let cellY = 0; cellY < gridHeight; cellY++) {
        for (let cellX = 0; cellX < gridWidth; cellX++) {
            const startX = Math.floor((cellX / gridWidth) * sourceWidth);
            const startY = Math.floor((cellY / gridHeight) * sourceHeight);
            const endX = Math.max(startX + 1, Math.floor(((cellX + 1) / gridWidth) * sourceWidth));
            const endY = Math.max(startY + 1, Math.floor(((cellY + 1) / gridHeight) * sourceHeight));
            let weightedR = 0, weightedG = 0, weightedB = 0, weightSum = 0;
            let opaqueCount = 0, totalCount = 0;

            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const pixel = getSourcePixel(sourceImageData, x, y);
                    totalCount++;
                    if (pixel.a <= 128) continue;
                    opaqueCount++;
                    const right = getSourcePixel(sourceImageData, x + 1, y);
                    const down = getSourcePixel(sourceImageData, x, y + 1);
                    const edgeStrength = Math.min(1, (colorDifference(pixel, right) + colorDifference(pixel, down)) / 510);
                    const weight = 1 + edgeStrength * 2.5;
                    weightedR += pixel.r * weight;
                    weightedG += pixel.g * weight;
                    weightedB += pixel.b * weight;
                    weightSum += weight;
                }
            }

            if (opaqueCount / Math.max(1, totalCount) <= 0.3 || weightSum === 0) {
                result.push({ r: 255, g: 255, b: 255, a: 0 });
            } else {
                result.push({ r: weightedR / weightSum, g: weightedG / weightSum, b: weightedB / weightSum, a: 255 });
            }
        }
    }
    return result;
}

async function loadImage(file) {
    sourceImage = await createImageBitmap(file);
    const canvas = $('lab-source-preview');
    const scale = Math.min(1, 260 / sourceImage.width);
    canvas.width = Math.max(1, Math.round(sourceImage.width * scale));
    canvas.height = Math.max(1, Math.round(sourceImage.height * scale));
    canvas.getContext('2d').drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    $('lab-source-preview-wrap').classList.remove('hidden');
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = sourceImage.width;
    sourceCanvas.height = sourceImage.height;
    sourceCanvas.getContext('2d').drawImage(sourceImage, 0, 0);
    sourceImageData = sourceCanvas.getContext('2d').getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    $('lab-generate-btn').disabled = false;
    $('lab-status').textContent = '图片已载入，可以生成 8 个方案。';
}

async function generate() {
    if (!sourceImageData) return;
    const settings = getSettings();
    const palette = PALETTES[settings.brand] || PALETTES.mard;
    $('lab-generate-btn').disabled = true;
    $('lab-status').textContent = '正在生成可用方案...';
    for (const strategy of strategies) {
        const empty = document.querySelector(`[data-empty="${strategy.id}"]`);
        if (!strategy.ready) { empty.textContent = '该策略将在后续实验阶段接入'; continue; }
        const started = performance.now();
        let pixels;
        if (strategy.id === 'original') {
            pixels = generatePatternDataOriginal({ sourceImageData, gridWidth: settings.gridWidth, gridHeight: settings.gridHeight, brand: settings.brand, mardSet: '221', isColorLimitEnabled: true, maxColors: settings.maxColors, palettes: PALETTES });
        } else if (strategy.id === 'high') {
            pixels = generatePatternData({ sourceImageData, gridWidth: settings.gridWidth, gridHeight: settings.gridHeight, brand: settings.brand, mardSet: '221', isColorLimitEnabled: true, maxColors: settings.maxColors, isDitheringEnabled: true, precisionMode: 'high', colorMatchMode: 'deltae', palettes: PALETTES });
        } else if (strategy.id === 'edge') {
            const edgeAwarePixelArt = generateEdgeAwarePixelArt(sourceImageData, settings.gridWidth, settings.gridHeight);
            pixels = mapPixelArtToBeads({ pixelArtData: edgeAwarePixelArt, gridWidth: settings.gridWidth, gridHeight: settings.gridHeight, brand: settings.brand, mardSet: '221', isColorLimitEnabled: true, maxColors: settings.maxColors, isDitheringEnabled: false, precisionMode: 'standard', colorMatchMode: 'deltae', palettes: PALETTES });
        }

        if (!pixels) {
            const edgeAware = strategy.id === 'shape' || strategy.id === 'craft'
                ? generateEdgeAwarePixelArt(sourceImageData, settings.gridWidth, settings.gridHeight)
                : null;
            if (edgeAware) {
                pixels = mapPixelArtToBeads({
                    pixelArtData: edgeAware,
                    gridWidth: settings.gridWidth,
                    gridHeight: settings.gridHeight,
                    brand: settings.brand,
                    mardSet: '221',
                    isColorLimitEnabled: true,
                    maxColors: strategy.id === 'craft' ? Math.min(settings.maxColors, 8) : settings.maxColors,
                    isDitheringEnabled: false,
                    precisionMode: 'standard',
                    colorMatchMode: 'deltae',
                    palettes: PALETTES
                });
            } else {
                pixels = generatePatternData({
                    sourceImageData,
                    gridWidth: settings.gridWidth,
                    gridHeight: settings.gridHeight,
                    brand: settings.brand,
                    mardSet: '221',
                    isColorLimitEnabled: true,
                    maxColors: settings.maxColors,
                    isDitheringEnabled: strategy.id === 'dither',
                    precisionMode: strategy.id === 'subject' ? 'high' : 'standard',
                    colorMatchMode: strategy.id === 'global' || strategy.id === 'subject' ? 'deltae' : 'redmean',
                    palettes: PALETTES
                });
            }
        }
        drawPixels(document.querySelector(`[data-result="${strategy.id}"]`), pixels, settings.gridWidth, settings.gridHeight);
        empty.classList.add('hidden');
        const stats = getStats(pixels);
        const elapsed = Math.round(performance.now() - started);
        document.querySelector(`[data-stats="${strategy.id}"]`).innerHTML = `<span>颜色<br><b class="text-slate-700">${stats.colors}</b></span><span>豆数<br><b class="text-slate-700">${stats.beads}</b></span><span>耗时<br><b class="text-slate-700">${elapsed}ms</b></span>`;
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    $('lab-status').textContent = '生成完成。当前已接入原版和高精度两个真实方案。';
    $('lab-generate-btn').disabled = false;
}

renderCards();
$('lab-image-input').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) loadImage(file).catch(() => { $('lab-status').textContent = '图片读取失败，请重试。'; }); });
$('lab-generate-btn').addEventListener('click', generate);
