/**
 * 拼豆图纸生成器 - 图像处理算法
 */
import { findNearestColor } from './utils.js';
import { PALETTES } from './constants.js';

/**
 * 中值切分法 (Median Cut) 颜色量化
 * @param {Array} pixels - 像素数组 [{r, g, b}, ...]
 * @param {number} maxColors - 最大颜色数
 * @returns {Array} - 量化后的代表色数组
 */
export function medianCut(pixels, maxColors) {
    let boxes = [pixels];
    while (boxes.length < maxColors) {
        let boxIndex = -1;
        let maxRange = -1;
        let splitAxis = 'r';

        for (let i = 0; i < boxes.length; i++) {
            if (boxes[i].length <= 1) continue;
            
            let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
            for (let p of boxes[i]) {
                if (p.r < minR) minR = p.r; if (p.r > maxR) maxR = p.r;
                if (p.g < minG) minG = p.g; if (p.g > maxG) maxG = p.g;
                if (p.b < minB) minB = p.b; if (p.b > maxB) maxB = p.b;
            }
            
            let rangeR = maxR - minR;
            let rangeG = maxG - minG;
            let rangeB = maxB - minB;
            let currentMaxRange = Math.max(rangeR, rangeG, rangeB);
            
            if (currentMaxRange > maxRange) {
                maxRange = currentMaxRange;
                boxIndex = i;
                splitAxis = rangeR >= rangeG && rangeR >= rangeB ? 'r' : (rangeG >= rangeB ? 'g' : 'b');
            }
        }

        if (boxIndex === -1) break;

        let box = boxes.splice(boxIndex, 1)[0];
        box.sort((a, b) => a[splitAxis] - b[splitAxis]);
        let median = Math.floor(box.length / 2);
        boxes.push(box.slice(0, median));
        boxes.push(box.slice(median));
    }

    return boxes.map(box => {
        let sumR = 0, sumG = 0, sumB = 0;
        for (let p of box) {
            sumR += p.r; sumG += p.g; sumB += p.b;
        }
        return {
            r: Math.round(sumR / box.length),
            g: Math.round(sumG / box.length),
            b: Math.round(sumB / box.length)
        };
    });
}

/**
 * 获取 MARD 品牌特定套装的过滤后的色板
 * @param {number} mardSet - 套装规格 (24, 48, ...)
 * @returns {Array} - 过滤后的色板
 */
export function getFilteredMardPalette(mardSet) {
    const palette = PALETTES.mard;
    const set = String(mardSet);
    const setGroups = {
        '24': ['1'], '48': ['1', '2'], '72': ['1', '2', '3'], '96': ['1', '2', '3', '4'],
        '120': ['A', 'B', 'C', 'D', 'E'], '144': ['A', 'B', 'C', 'D', 'E', '6'],
        '216': ['A', 'B', 'C', 'D', 'E', '6', '9', '10', '11'],
        '221': ['A', 'B', 'C', 'D', 'E', '6', '8', '9', '10', '11', 'other'],
        '264': ['A', 'B', 'C', 'D', 'E', '6', '7', '8', '9', '10', '11']
    };
    const allowedGroups = setGroups[set] || [];
    const filtered = palette.filter(c => {
        const isAllowed = c.groups.some(g => allowedGroups.includes(g));
        if (set === '216' && ['C29', 'D10', 'B9', 'C12', 'D4'].includes(c.id)) return false;
        if (set === '221' && !/^[ABCDEFGHM]\d+$/.test(c.id)) return false;
        if (set === '264' && c.id === 'C29') return false;
        return isAllowed;
    });

    // 去重，防止同一颜色在不同分组中重复出现
    const unique = [];
    const seen = new Set();
    for (const color of filtered) {
        if (!seen.has(color.id)) {
            unique.push(color);
            seen.add(color.id);
        }
    }
    return unique;
}

/**
 * 背景移除 (Flood Fill)
 * @param {ImageData} imageData - 图像数据
 * @param {number} startX - 起点 X
 * @param {number} startY - 起点 Y
 * @param {number} tolerance - 容差
 * @returns {ImageData} - 处理后的图像数据
 */
export function removeBackground(imageData, startX, startY, tolerance) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const targetIdx = (startY * width + startX) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    if (targetA === 0) return imageData;

    const stack = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const idx = (y * width + x) * 4;

        if (visited[y * width + x]) continue;
        visited[y * width + x] = 1;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        const dist = Math.sqrt(
            Math.pow(r - targetR, 2) +
            Math.pow(g - targetG, 2) +
            Math.pow(b - targetB, 2)
        );

        if (a > 0 && dist < tolerance) {
            data[idx + 3] = 0;
            if (x > 0) stack.push([x - 1, y]);
            if (x < width - 1) stack.push([x + 1, y]);
            if (y > 0) stack.push([x, y - 1]);
            if (y < height - 1) stack.push([x, y + 1]);
        }
    }
    return imageData;
}

/**
 * 清除细小残留碎片
 * @param {ImageData} imageData - 图像数据
 * @param {number} minIslandSize - 判定为残留的像素阈值
 * @returns {ImageData} - 处理后的图像数据
 */
export function cleanTinyFragments(imageData, minIslandSize = 15) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const visited = new Uint8Array(width * height);
    const toRemove = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] > 0 && !visited[y * width + x]) {
                const island = [];
                const stack = [[x, y]];
                visited[y * width + x] = 1;

                while (stack.length > 0) {
                    const [currX, currY] = stack.pop();
                    island.push([currX, currY]);

                    const neighbors = [
                        [currX - 1, currY], [currX + 1, currY],
                        [currX, currY - 1], [currX, currY + 1]
                    ];

                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = (ny * width + nx) * 4;
                            if (data[nIdx + 3] > 0 && !visited[ny * width + nx]) {
                                visited[ny * width + nx] = 1;
                                stack.push([nx, ny]);
                            }
                        }
                    }
                }

                if (island.length < minIslandSize) {
                    toRemove.push(...island);
                }
            }
        }
    }

    toRemove.forEach(([rx, ry]) => {
        const idx = (ry * width + rx) * 4;
        data[idx + 3] = 0;
    });

    return imageData;
}

/**
 * 核心算法：像素化与颜色匹配（包含颜色量化和抖动处理）
 * @param {Object} options - 配置选项
 * @returns {Array} - 生成的像素数据
 */
export function generatePatternData({
    sourceImageData,
    gridWidth,
    gridHeight,
    brand,
    mardSet,
    isColorLimitEnabled,
    maxColors,
    isDitheringEnabled,
    palettes
}) {
    const { data: sourceData, width: sourceWidth, height: sourceHeight } = sourceImageData;
    let palette = palettes[brand] || palettes.perler;

    // MARD 品牌过滤
    if (brand === 'mard') {
        palette = getFilteredMardPalette(mardSet);
    }

    // 颜色量化限制
    let finalPalette = palette;
    if (isColorLimitEnabled) {
        let sampledPixels = [];
        const sampleStep = Math.max(1, Math.floor((gridWidth * gridHeight) / 2000));
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x += sampleStep) {
                const startX = Math.floor((x / gridWidth) * sourceWidth);
                const startY = Math.floor((y / gridHeight) * sourceHeight);
                const idx = (startY * sourceWidth + startX) * 4;
                if (sourceData[idx + 3] > 128) {
                    sampledPixels.push({ r: sourceData[idx], g: sourceData[idx + 1], b: sourceData[idx + 2] });
                }
            }
        }

        if (sampledPixels.length > 0) {
            const representativeColors = medianCut(sampledPixels, maxColors);
            const reducedPaletteMap = new Map();
            representativeColors.forEach(rep => {
                const nearest = findNearestColor(rep.r, rep.g, rep.b, palette);
                reducedPaletteMap.set(nearest.id, nearest);
            });
            finalPalette = Array.from(reducedPaletteMap.values());
        }
    }

    const pixelData = [];
    let errorBuffer = isDitheringEnabled ? new Float32Array(gridWidth * gridHeight * 3) : null;

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const startX = Math.floor((x / gridWidth) * sourceWidth);
            const startY = Math.floor((y / gridHeight) * sourceHeight);
            const endX = Math.floor(((x + 1) / gridWidth) * sourceWidth);
            const endY = Math.floor(((y + 1) / gridHeight) * sourceHeight);

            let rSum = 0, gSum = 0, bSum = 0, count = 0, alphaSum = 0;
            for (let sy = startY; sy < endY; sy++) {
                for (let sx = startX; sx < endX; sx++) {
                    const idx = (sy * sourceWidth + sx) * 4;
                    rSum += sourceData[idx];
                    gSum += sourceData[idx + 1];
                    bSum += sourceData[idx + 2];
                    alphaSum += sourceData[idx + 3];
                    count++;
                }
            }

            let r = count > 0 ? rSum / count : 255;
            let g = count > 0 ? gSum / count : 255;
            let b = count > 0 ? bSum / count : 255;
            const a = count > 0 ? alphaSum / count : 0;

            if (a < 128) {
                pixelData.push({ id: 'NONE', r: 255, g: 255, b: 255, a: 0 });
                continue;
            }

            if (isDitheringEnabled) {
                const errIdx = (y * gridWidth + x) * 3;
                r = Math.max(0, Math.min(255, r + errorBuffer[errIdx]));
                g = Math.max(0, Math.min(255, g + errorBuffer[errIdx + 1]));
                b = Math.max(0, Math.min(255, b + errorBuffer[errIdx + 2]));
            }

            const matched = findNearestColor(r, g, b, finalPalette);
            pixelData.push(matched);

            if (isDitheringEnabled) {
                const errR = r - matched.r;
                const errG = g - matched.g;
                const errB = b - matched.b;

                const distributeError = (nx, ny, weight) => {
                    if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                        const nIdx = (ny * gridWidth + nx) * 3;
                        errorBuffer[nIdx] += errR * weight;
                        errorBuffer[nIdx + 1] += errG * weight;
                        errorBuffer[nIdx + 2] += errB * weight;
                    }
                };

                distributeError(x + 1, y, 7 / 16);
                distributeError(x - 1, y + 1, 3 / 16);
                distributeError(x, y + 1, 5 / 16);
                distributeError(x + 1, y + 1, 1 / 16);
            }
        }
    }

    return pixelData;
}
