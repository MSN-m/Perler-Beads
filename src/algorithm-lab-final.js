import { PALETTES } from './constants.js';
import { generatePatternData, getFilteredMardPalette, medianCut } from './processor.js';

const $ = (id) => document.getElementById(id);
let sourceImageData = null;
const clamp = (value) => Math.max(0, Math.min(255, value));
const linear = (value) => { value /= 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
const srgb = (value) => clamp((value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055) * 255);

function pixelAt(x, y) { const sx = Math.max(0, Math.min(sourceImageData.width - 1, x)); const sy = Math.max(0, Math.min(sourceImageData.height - 1, y)); const offset = (sy * sourceImageData.width + sx) * 4; return { r: sourceImageData.data[offset], g: sourceImageData.data[offset + 1], b: sourceImageData.data[offset + 2], a: sourceImageData.data[offset + 3] }; }
function dist(a, b) { return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b); }
function lab(color) { let r = linear(color.r), g = linear(color.g), b = linear(color.b); let x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883; const f = (v) => v > .008856 ? v ** (1 / 3) : 7.787 * v + 16 / 116; x = f(x); y = f(y); z = f(z); return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) }; }
function delta(a, b) { const x = lab(a), y = lab(b); return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b); }

function settings() { const side = Math.max(16, Math.min(104, Number($('final-grid-size').value) || 80)); const ratio = sourceImageData.width / Math.max(1, sourceImageData.height); return { width: ratio >= 1 ? side : Math.max(16, Math.round(side * ratio)), height: ratio >= 1 ? Math.max(16, Math.round(side / ratio)) : side, brand: $('final-brand').value, maxColors: Math.max(4, Math.min(80, Number($('final-max-colors').value) || 12)) }; }
function bounds(s, x, y) { const sx = Math.floor(x * sourceImageData.width / s.width), sy = Math.floor(y * sourceImageData.height / s.height); return { sx, sy, ex: Math.max(sx + 1, Math.floor((x + 1) * sourceImageData.width / s.width)), ey: Math.max(sy + 1, Math.floor((y + 1) * sourceImageData.height / s.height)) }; }
function average(samples) { if (!samples.length) return { r: 255, g: 255, b: 255, a: 0 }; let r = 0, g = 0, b = 0, n = 0; samples.forEach((p) => { if (p.a >= 128) { r += linear(p.r); g += linear(p.g); b += linear(p.b); n++; } }); return n ? { r: srgb(r / n), g: srgb(g / n), b: srgb(b / n), a: 255 } : { r: 255, g: 255, b: 255, a: 0 }; }
function borderBackground(s, cells) { const pixels = []; for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (!x || !y || x === s.width - 1 || y === s.height - 1) pixels.push(cells[y * s.width + x].color); return average(pixels); }

function buildSemanticGrid(s) {
    const cells = [];
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) { const box = bounds(s, x, y); const samples = []; for (let py = box.sy; py < box.ey; py++) for (let px = box.sx; px < box.ex; px++) samples.push(pixelAt(px, py)); cells.push({ color: average(samples), alpha: samples.filter((p) => p.a >= 128).length / samples.length, subject: false }); }
    const background = borderBackground(s, cells);
    const borderDistances = cells.filter((_, index) => { const x = index % s.width, y = Math.floor(index / s.width); return !x || !y || x === s.width - 1 || y === s.height - 1; }).filter((cell) => cell.alpha >= .22).map((cell) => dist(cell.color, background)).sort((a, b) => a - b);
    const backgroundThreshold = Math.max(30, Math.min(95, borderDistances[Math.floor(borderDistances.length * .8)] || 72));
    const candidate = cells.map((cell) => cell.alpha >= .22 && dist(cell.color, background) <= backgroundThreshold);
    const queue = []; const connected = new Uint8Array(cells.length);
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (!x || !y || x === s.width - 1 || y === s.height - 1) { const index = y * s.width + x; if (candidate[index]) { queue.push(index); connected[index] = 1; } }
    for (let head = 0; head < queue.length; head++) { const index = queue[head], x = index % s.width, y = Math.floor(index / s.width); for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue; const next = ny * s.width + nx; if (candidate[next] && !connected[next]) { connected[next] = 1; queue.push(next); } } }
    cells.forEach((cell, index) => { cell.subject = cell.alpha >= .22 && !connected[index]; });
    // 主体的小孔洞若被主体包围则补齐，降低背景误穿透主体内部的概率。
    for (let y = 1; y < s.height - 1; y++) for (let x = 1; x < s.width - 1; x++) {
        const index = y * s.width + x;
        if (cells[index].subject || cells[index].alpha < .22) continue;
        const around = [index - 1, index + 1, index - s.width, index + s.width];
        if (around.every((neighbor) => cells[neighbor].subject)) cells[index].subject = true;
    }
    return { cells, background };
}

function selectPalette(cells, s) {
    const source = cells.filter((cell) => cell.alpha >= .22).map((cell) => cell.color);
    const full = s.brand === 'mard' ? getFilteredMardPalette('221') : (PALETTES[s.brand] || PALETTES.mard);
    if (!source.length) return [];
    // 控制采样数量；每次选择能最大幅度降低全图感知色差的色号。
    const stride = Math.max(1, Math.ceil(source.length / 720));
    const samples = source.filter((_, index) => index % stride === 0);
    const chosen = [];
    const errors = samples.map(() => Infinity);
    while (chosen.length < s.maxColors && chosen.length < full.length) {
        let winner = null;
        let winnerErrors = null;
        let bestTotal = Infinity;
        for (const bead of full) {
            if (chosen.some((color) => color.id === bead.id)) continue;
            const nextErrors = samples.map((sample, index) => Math.min(errors[index], delta(sample, bead)));
            const total = nextErrors.reduce((sum, value) => sum + value * value, 0);
            if (total < bestTotal) { bestTotal = total; winner = bead; winnerErrors = nextErrors; }
        }
        if (!winner) break;
        chosen.push(winner);
        winnerErrors.forEach((value, index) => { errors[index] = value; });
    }
    return chosen;
}
function match(color, palette) { let best = palette[0], score = Infinity; for (const bead of palette) { const value = delta(color, bead); if (value < score) { score = value; best = bead; } } return best; }
function clean(pixels, s, protectedMask = null) {
    const output = pixels.slice();
    const nearby = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < s.width && ny < s.height);
    const visited = new Uint8Array(output.length);
    for (let start = 0; start < output.length; start++) {
        if (visited[start] || output[start].id === 'NONE') continue;
        const region = [], id = output[start].id, queue = [start];
        visited[start] = 1;
        while (queue.length) {
            const index = queue.shift(); region.push(index);
            const x = index % s.width, y = Math.floor(index / s.width);
            nearby(x, y).forEach(([nx, ny]) => { const next = ny * s.width + nx; if (!visited[next] && output[next].id === id) { visited[next] = 1; queue.push(next); } });
        }
        if (region.length > 2 || region.some((index) => protectedMask?.[index])) continue;
        const contacts = new Map();
        region.forEach((index) => { const x = index % s.width, y = Math.floor(index / s.width); nearby(x, y).forEach(([nx, ny]) => { const color = output[ny * s.width + nx]; if (color.id !== 'NONE' && color.id !== id) contacts.set(color.id, { color, count: (contacts.get(color.id)?.count || 0) + 1 }); }); });
        const target = [...contacts.values()].sort((a, b) => b.count - a.count)[0];
        // 只合并与邻色接近的 1–2 格碎块，避免吞掉眼睛、嘴等关键小细节。
        if (target && delta(output[region[0]], target.color) < 18) region.forEach((index) => { output[index] = target.color; });
    }
    for (let y = 1; y < s.height - 1; y++) for (let x = 1; x < s.width - 1; x++) {
        const index = y * s.width + x;
        if (output[index].id !== 'NONE') continue;
        const around = nearby(x, y).map(([nx, ny]) => output[ny * s.width + nx]);
        if (around.length === 4 && around.every((p) => p.id === around[0].id)) output[index] = around[0];
    }
    return output;
}

function draw(canvas, pixels, width, height) { canvas.width = width; canvas.height = height; canvas.style.aspectRatio = `${width} / ${height}`; const context = canvas.getContext('2d'), image = context.createImageData(width, height); pixels.forEach((p, i) => { const o = i * 4; image.data[o] = p.r; image.data[o + 1] = p.g; image.data[o + 2] = p.b; image.data[o + 3] = p.a ?? 255; }); context.putImageData(image, 0, 0); }
function beadStats(pixels) { const beads = pixels.filter((p) => p.id !== 'NONE'); return `${new Set(beads.map((p) => p.id)).size} 色　${beads.length} 豆`; }

async function generate() { if (!sourceImageData) return; const s = settings(); $('final-generate-btn').disabled = true; try { const raw = Array.from({ length: sourceImageData.width * sourceImageData.height }, (_, i) => { const o = i * 4; return { r: sourceImageData.data[o], g: sourceImageData.data[o + 1], b: sourceImageData.data[o + 2], a: sourceImageData.data[o + 3] }; }); draw($('final-source'), raw, sourceImageData.width, sourceImageData.height); $('final-source-stats').textContent = `${sourceImageData.width} × ${sourceImageData.height}`; const semantic = buildSemanticGrid(s); draw($('final-mask'), semantic.cells.map((cell) => cell.alpha < .22 ? { r: 240, g: 240, b: 240, a: 0 } : cell.subject ? { r: 255, g: 255, b: 255, a: 255 } : { r: 42, g: 51, b: 65, a: 255 }), s.width, s.height); $('final-mask-stats').textContent = `主体格 ${semantic.cells.filter((cell) => cell.subject).length}`; const contourMask = semantic.cells.map((cell, index) => { if (!cell.subject) return false; const x = index % s.width, y = Math.floor(index / s.width); return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < s.width && ny < s.height && !semantic.cells[ny * s.width + nx].subject); }); const contours = contourMask.map((isContour, index) => isContour ? { r: 18, g: 25, b: 38, a: 255 } : { r: 245, g: 245, b: 245, a: semantic.cells[index].alpha < .22 ? 0 : 255 }); draw($('final-contours'), contours, s.width, s.height); $('final-contour-stats').textContent = `轮廓格 ${contourMask.filter(Boolean).length}`; const baseline = generatePatternData({ sourceImageData, gridWidth: s.width, gridHeight: s.height, brand: s.brand, mardSet: '221', isColorLimitEnabled: true, maxColors: s.maxColors, isDitheringEnabled: false, precisionMode: 'standard', colorMatchMode: 'redmean', palettes: PALETTES }); draw($('final-baseline'), baseline, s.width, s.height); $('final-baseline-stats').textContent = beadStats(baseline); const palette = selectPalette(semantic.cells, s); const final = clean(semantic.cells.map((cell) => cell.alpha < .22 ? { id: 'NONE', r: 255, g: 255, b: 255, a: 0 } : match(cell.color, palette)), s, contourMask); draw($('final-result'), final, s.width, s.height); $('final-result-stats').textContent = `${beadStats(final)}　候选色 ${palette.length}`; $('final-status').textContent = '生成完成：请重点检查掩码是否正确，以及最终候选的颜色和轮廓。'; } catch (error) { console.error(error); $('final-status').textContent = '生成失败，请重试。'; } finally { $('final-generate-btn').disabled = false; } }

$('final-image-input').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const image = await createImageBitmap(file), canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').drawImage(image, 0, 0); sourceImageData = canvas.getContext('2d').getImageData(0, 0, image.width, image.height); $('final-generate-btn').disabled = false; $('final-status').textContent = '图片已载入，可以生成候选结果。'; } catch { $('final-status').textContent = '图片读取失败，请重试。'; } });
$('final-generate-btn').addEventListener('click', generate);
