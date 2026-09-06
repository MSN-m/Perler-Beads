/**
 * 候选生成器专用实验流水线。
 * 不被正式主页引用：裁剪后的图像先做中强度区域扁平化，再进入最终候选匹配。
 */
import { PALETTES } from './constants.js';
import { getFilteredMardPalette } from './processor.js';

const clamp = (value) => Math.max(0, Math.min(255, value));
const linear = (value) => { value /= 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
const srgb = (value) => clamp((value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055) * 255);

export function flattenCandidateSource(sourceImageData) {
    const output = new ImageData(sourceImageData.width, sourceImageData.height);
    const { width, height, data } = sourceImageData;
    const quantize = 23;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] <= 127) continue;
        let red = 0, green = 0, blue = 0, count = 0;
        for (let sampleY = Math.max(0, y - 2); sampleY <= Math.min(height - 1, y + 2); sampleY++) {
            for (let sampleX = Math.max(0, x - 2); sampleX <= Math.min(width - 1, x + 2); sampleX++) {
                const sampleOffset = (sampleY * width + sampleX) * 4;
                if (data[sampleOffset + 3] <= 127) continue;
                red += data[sampleOffset]; green += data[sampleOffset + 1]; blue += data[sampleOffset + 2]; count++;
            }
        }
        output.data[offset] = Math.round(red / Math.max(1, count) / quantize) * quantize;
        output.data[offset + 1] = Math.round(green / Math.max(1, count) / quantize) * quantize;
        output.data[offset + 2] = Math.round(blue / Math.max(1, count) / quantize) * quantize;
        output.data[offset + 3] = 255;
    }
    return output;
}

function colorDistance(a, b) { return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b); }
function lab(color) {
    let red = linear(color.r), green = linear(color.g), blue = linear(color.b);
    let x = (red * .4124 + green * .3576 + blue * .1805) / .95047;
    let y = red * .2126 + green * .7152 + blue * .0722;
    let z = (red * .0193 + green * .1192 + blue * .9505) / 1.08883;
    const f = (value) => value > .008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}
function delta(a, b) { const left = lab(a), right = lab(b); return Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b); }
function average(samples) {
    let red = 0, green = 0, blue = 0, count = 0;
    samples.forEach((pixel) => { if (pixel.a >= 128) { red += linear(pixel.r); green += linear(pixel.g); blue += linear(pixel.b); count++; } });
    return count ? { r: srgb(red / count), g: srgb(green / count), b: srgb(blue / count), a: 255 } : { r: 255, g: 255, b: 255, a: 0 };
}

function buildSemanticGrid(sourceImageData, gridWidth, gridHeight) {
    const samplePixel = (x, y) => {
        const safeX = Math.max(0, Math.min(sourceImageData.width - 1, x));
        const safeY = Math.max(0, Math.min(sourceImageData.height - 1, y));
        const offset = (safeY * sourceImageData.width + safeX) * 4;
        return { r: sourceImageData.data[offset], g: sourceImageData.data[offset + 1], b: sourceImageData.data[offset + 2], a: sourceImageData.data[offset + 3] };
    };
    const cells = [];
    for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) {
        const startX = Math.floor(x * sourceImageData.width / gridWidth);
        const startY = Math.floor(y * sourceImageData.height / gridHeight);
        const endX = Math.max(startX + 1, Math.floor((x + 1) * sourceImageData.width / gridWidth));
        const endY = Math.max(startY + 1, Math.floor((y + 1) * sourceImageData.height / gridHeight));
        const samples = [];
        for (let sampleY = startY; sampleY < endY; sampleY++) for (let sampleX = startX; sampleX < endX; sampleX++) samples.push(samplePixel(sampleX, sampleY));
        cells.push({ color: average(samples), alpha: samples.filter((pixel) => pixel.a >= 128).length / samples.length, subject: false });
    }
    const border = cells.filter((_, index) => {
        const x = index % gridWidth, y = Math.floor(index / gridWidth);
        return !x || !y || x === gridWidth - 1 || y === gridHeight - 1;
    });
    const background = average(border.map((cell) => cell.color));
    const distances = border.filter((cell) => cell.alpha >= .22).map((cell) => colorDistance(cell.color, background)).sort((a, b) => a - b);
    const threshold = Math.max(30, Math.min(95, distances[Math.floor(distances.length * .8)] || 72));
    const backgroundCandidates = cells.map((cell) => cell.alpha >= .22 && colorDistance(cell.color, background) <= threshold);
    const connected = new Uint8Array(cells.length), queue = [];
    for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) if (!x || !y || x === gridWidth - 1 || y === gridHeight - 1) {
        const index = y * gridWidth + x;
        if (backgroundCandidates[index]) { connected[index] = 1; queue.push(index); }
    }
    for (let head = 0; head < queue.length; head++) {
        const index = queue[head], x = index % gridWidth, y = Math.floor(index / gridWidth);
        [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([nextX, nextY]) => {
            if (nextX < 0 || nextY < 0 || nextX >= gridWidth || nextY >= gridHeight) return;
            const next = nextY * gridWidth + nextX;
            if (backgroundCandidates[next] && !connected[next]) { connected[next] = 1; queue.push(next); }
        });
    }
    cells.forEach((cell, index) => { cell.subject = cell.alpha >= .22 && !connected[index]; });
    for (let y = 1; y < gridHeight - 1; y++) for (let x = 1; x < gridWidth - 1; x++) {
        const index = y * gridWidth + x;
        if (!cells[index].subject && cells[index].alpha >= .22 && [index - 1, index + 1, index - gridWidth, index + gridWidth].every((next) => cells[next].subject)) cells[index].subject = true;
    }
    return cells;
}

function selectPalette(cells, { brand, mardSet, maxColors }) {
    const source = cells.filter((cell) => cell.alpha >= .22).map((cell) => cell.color);
    const full = brand === 'mard' ? getFilteredMardPalette(mardSet) : (PALETTES[brand] || PALETTES.mard);
    if (!source.length) return [];
    const samples = source.filter((_, index) => index % Math.max(1, Math.ceil(source.length / 720)) === 0);
    const chosen = [], errors = samples.map(() => Infinity);
    while (chosen.length < Math.min(maxColors, full.length)) {
        let winner = null, winnerErrors = null, bestTotal = Infinity;
        full.forEach((bead) => {
            if (chosen.some((color) => color.id === bead.id)) return;
            const nextErrors = samples.map((sample, index) => Math.min(errors[index], delta(sample, bead)));
            const total = nextErrors.reduce((sum, value) => sum + value * value, 0);
            if (total < bestTotal) { winner = bead; winnerErrors = nextErrors; bestTotal = total; }
        });
        if (!winner) break;
        chosen.push(winner);
        winnerErrors.forEach((value, index) => { errors[index] = value; });
    }
    return chosen;
}

function clean(pixels, gridWidth, gridHeight, protectedMask) {
    const output = pixels.slice();
    const neighbors = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nextX, nextY]) => nextX >= 0 && nextY >= 0 && nextX < gridWidth && nextY < gridHeight);
    const visited = new Uint8Array(output.length);
    for (let start = 0; start < output.length; start++) {
        if (visited[start] || output[start].id === 'NONE') continue;
        const region = [], id = output[start].id, queue = [start]; visited[start] = 1;
        while (queue.length) {
            const index = queue.shift(); region.push(index);
            const x = index % gridWidth, y = Math.floor(index / gridWidth);
            neighbors(x, y).forEach(([nextX, nextY]) => { const next = nextY * gridWidth + nextX; if (!visited[next] && output[next].id === id) { visited[next] = 1; queue.push(next); } });
        }
        if (region.length > 2 || region.some((index) => protectedMask[index])) continue;
        const contacts = new Map();
        region.forEach((index) => { const x = index % gridWidth, y = Math.floor(index / gridWidth); neighbors(x, y).forEach(([nextX, nextY]) => { const color = output[nextY * gridWidth + nextX]; if (color.id !== 'NONE' && color.id !== id) contacts.set(color.id, { color, count: (contacts.get(color.id)?.count || 0) + 1 }); }); });
        const target = [...contacts.values()].sort((a, b) => b.count - a.count)[0];
        if (target && delta(output[region[0]], target.color) < 18) region.forEach((index) => { output[index] = target.color; });
    }
    return output;
}

export function generateCandidatePatternData({ sourceImageData, gridWidth, gridHeight, brand, mardSet, isColorLimitEnabled, maxColors }) {
    const cells = buildSemanticGrid(sourceImageData, gridWidth, gridHeight);
    const paletteLimit = isColorLimitEnabled ? maxColors : (brand === 'mard' ? getFilteredMardPalette(mardSet).length : (PALETTES[brand] || PALETTES.mard).length);
    const palette = selectPalette(cells, { brand, mardSet, maxColors: paletteLimit });
    const contours = cells.map((cell, index) => {
        if (!cell.subject) return false;
        const x = index % gridWidth, y = Math.floor(index / gridWidth);
        return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nextX, nextY]) => nextX >= 0 && nextY >= 0 && nextX < gridWidth && nextY < gridHeight && !cells[nextY * gridWidth + nextX].subject);
    });
    const match = (color) => palette.reduce((best, bead) => !best || delta(color, bead) < delta(color, best) ? bead : best, null);
    const pixelData = clean(cells.map((cell) => cell.alpha < .22 ? { id: 'NONE', r: 255, g: 255, b: 255, a: 0 } : match(cell.color)), gridWidth, gridHeight, contours);
    return { pixelData, cells, contours, palette };
}
