/**
 * 拼豆图纸生成器 - 图像处理算法
 */
import { findNearestColor } from './utils.js';
import { PALETTES } from './constants.js';

function srgbToLinear(value) {
    const normalized = value / 255;
    return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function rgbToLab(r, g, b) {
    const linearR = srgbToLinear(r);
    const linearG = srgbToLinear(g);
    const linearB = srgbToLinear(b);

    const x = linearR * 0.4124564 + linearG * 0.3575761 + linearB * 0.1804375;
    const y = linearR * 0.2126729 + linearG * 0.7151522 + linearB * 0.0721750;
    const z = linearR * 0.0193339 + linearG * 0.1191920 + linearB * 0.9503041;

    const normalize = (value) => {
        const epsilon = 216 / 24389;
        const kappa = 24389 / 27;
        return value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116;
    };

    const fx = normalize(x / 0.95047);
    const fy = normalize(y / 1.00000);
    const fz = normalize(z / 1.08883);

    return {
        l: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz)
    };
}

function deltaE76(lab1, lab2) {
    const dl = lab1.l - lab2.l;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return dl * dl + da * da + db * db;
}

function buildLabPalette(palette) {
    return palette.map(color => ({
        color,
        lab: rgbToLab(color.r, color.g, color.b)
    }));
}

function findNearestColorDeltaE(r, g, b, labPalette) {
    const lab = rgbToLab(r, g, b);
    let minDist = Infinity;
    let nearest = labPalette[0]?.color;

    for (const item of labPalette) {
        const dist = deltaE76(lab, item.lab);
        if (dist < minDist) {
            minDist = dist;
            nearest = item.color;
        }
    }

    return nearest;
}

/**
 * 判断两个颜色是否相同（或非常接近）
 * @param {Object} color1 - 颜色对象 {id, r, g, b}
 * @param {Object} color2 - 颜色对象 {id, r, g, b}
 * @returns {boolean} - 是否相同
 */
function isSameColor(color1, color2) {
    if (!color1 || !color2) return false;
    // 优先判断 ID 相同
    if (color1.id === color2.id) return true;
    // 如果 ID 不同，判断 RGB 距离是否 < 30（允许轻微色差）
    const dr = color1.r - color2.r;
    const dg = color1.g - color2.g;
    const db = color1.b - color2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db) < 30;
}

/**
 * 判断当前格子是否应该启用抖动（基于局部颜色一致性）
 * @param {number} x - 格子 X 坐标
 * @param {number} y - 格子 Y 坐标
 * @param {number} gridWidth - 网格宽度
 * @param {number} gridHeight - 网格高度
 * @param {Array} pixelData - 像素数据数组
 * @returns {boolean} - 是否应该抖动
 */
function shouldEnableDithering(x, y, gridWidth, gridHeight, pixelData) {
    // 8 个邻居的相对位置
    const neighbors = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0],          [1,  0],
        [-1,  1], [0,  1], [1,  1]
    ];
    
    let sameColorCount = 0;
    const currentIdx = y * gridWidth + x;
    const currentColor = pixelData[currentIdx];
    
    // 跳过透明格子
    if (!currentColor || currentColor.id === 'NONE') {
        return false;
    }
    
    // 检测周围邻居
    for (let [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        
        // 边界检查
        if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) {
            continue;
        }
        
        const neighborIdx = ny * gridWidth + nx;
        const neighborColor = pixelData[neighborIdx];
        
        if (isSameColor(currentColor, neighborColor)) {
            sameColorCount++;
        }
    }
    
    // 如果 8 个邻居中有 6 个以上同色 → 纯色区域 → 不抖动
    // 否则 → 渐变区域 → 抖动
    return sameColorCount < 6;
}

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
export function generatePixelArtData({
    sourceImageData,
    gridWidth,
    gridHeight,
    precisionMode = 'standard'
}) {
    const { data: sourceData, width: sourceWidth, height: sourceHeight } = sourceImageData;
    const useHighPrecisionSampling = precisionMode === 'high';
    const pixelArtData = [];

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const startX = Math.floor((x / gridWidth) * sourceWidth);
            const startY = Math.floor((y / gridHeight) * sourceHeight);
            const endX = Math.max(startX + 1, Math.floor(((x + 1) / gridWidth) * sourceWidth));
            const endY = Math.max(startY + 1, Math.floor(((y + 1) / gridHeight) * sourceHeight));
            const centerX = (startX + endX - 1) / 2;
            const centerY = (startY + endY - 1) / 2;
            const maxDistance = Math.max(1, Math.hypot(endX - startX, endY - startY) / 2);
            const colorBuckets = new Map();
            let rSum = 0, gSum = 0, bSum = 0, opaqueCount = 0, totalCount = 0;
            let weightedR = 0, weightedG = 0, weightedB = 0, weightSum = 0;

            for (let sy = startY; sy < endY; sy++) {
                for (let sx = startX; sx < endX; sx++) {
                    const idx = (sy * sourceWidth + sx) * 4;
                    totalCount++;
                    if (sourceData[idx + 3] <= 128) continue;

                    const r = sourceData[idx];
                    const g = sourceData[idx + 1];
                    const b = sourceData[idx + 2];
                    rSum += r;
                    gSum += g;
                    bSum += b;
                    opaqueCount++;

                    if (useHighPrecisionSampling) {
                        const distance = Math.hypot(sx - centerX, sy - centerY);
                        const weight = 1 + Math.max(0, 1 - distance / maxDistance);
                        weightedR += r * weight;
                        weightedG += g * weight;
                        weightedB += b * weight;
                        weightSum += weight;

                        const bucketKey = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
                        const bucket = colorBuckets.get(bucketKey) || { r: 0, g: 0, b: 0, count: 0 };
                        bucket.r += r;
                        bucket.g += g;
                        bucket.b += b;
                        bucket.count++;
                        colorBuckets.set(bucketKey, bucket);
                    }
                }
            }

            const opaqueRatio = opaqueCount / Math.max(totalCount, 1);
            const alphaThreshold = useHighPrecisionSampling ? 0.22 : 0.3;
            if (opaqueRatio <= alphaThreshold) {
                pixelArtData.push({ r: 255, g: 255, b: 255, a: 0 });
                continue;
            }

            if (!useHighPrecisionSampling || weightSum === 0) {
                pixelArtData.push({
                    r: opaqueCount > 0 ? rSum / opaqueCount : 255,
                    g: opaqueCount > 0 ? gSum / opaqueCount : 255,
                    b: opaqueCount > 0 ? bSum / opaqueCount : 255,
                    a: 255
                });
                continue;
            }

            const weightedAvg = {
                r: weightedR / weightSum,
                g: weightedG / weightSum,
                b: weightedB / weightSum
            };
            let dominantBucket = null;
            for (const bucket of colorBuckets.values()) {
                if (!dominantBucket || bucket.count > dominantBucket.count) {
                    dominantBucket = bucket;
                }
            }

            if (dominantBucket && dominantBucket.count / opaqueCount >= 0.42) {
                const dominantAvg = {
                    r: dominantBucket.r / dominantBucket.count,
                    g: dominantBucket.g / dominantBucket.count,
                    b: dominantBucket.b / dominantBucket.count
                };
                pixelArtData.push({
                    r: dominantAvg.r * 0.65 + weightedAvg.r * 0.35,
                    g: dominantAvg.g * 0.65 + weightedAvg.g * 0.35,
                    b: dominantAvg.b * 0.65 + weightedAvg.b * 0.35,
                    a: 255
                });
                continue;
            }

            pixelArtData.push({ ...weightedAvg, a: 255 });
        }
    }

    return pixelArtData;
}

export function mapPixelArtToBeads({
    pixelArtData,
    gridWidth,
    gridHeight,
    brand,
    mardSet,
    isColorLimitEnabled,
    maxColors,
    isDitheringEnabled,
    precisionMode = 'standard',
    colorMatchMode = 'redmean',
    palettes
}) {
    let palette = palettes[brand] || palettes.perler;

    if (brand === 'mard') {
        palette = getFilteredMardPalette(mardSet);
    }

    const useDeltaE = colorMatchMode === 'deltae';
    const baseLabPalette = useDeltaE ? buildLabPalette(palette) : null;
    const matchNearestColor = (r, g, b, activePalette, labPalette = null) => {
        if (!useDeltaE) return findNearestColor(r, g, b, activePalette);
        return findNearestColorDeltaE(r, g, b, labPalette || buildLabPalette(activePalette));
    };

    let finalPalette = palette;
    if (isColorLimitEnabled) {
        const sampledPixels = pixelArtData
            .filter(pixel => pixel.a > 128)
            .map(pixel => ({ r: pixel.r, g: pixel.g, b: pixel.b }));

        if (sampledPixels.length > 0) {
            const representativeColors = medianCut(sampledPixels, maxColors);
            const reducedPaletteMap = new Map();
            representativeColors.forEach(rep => {
                const nearest = matchNearestColor(rep.r, rep.g, rep.b, palette, baseLabPalette);
                reducedPaletteMap.set(nearest.id, nearest);
            });
            finalPalette = Array.from(reducedPaletteMap.values());
        }
    }

    const finalLabPalette = useDeltaE ? buildLabPalette(finalPalette) : null;
    const matchFinalPaletteColor = (r, g, b) => {
        return useDeltaE
            ? findNearestColorDeltaE(r, g, b, finalLabPalette)
            : findNearestColor(r, g, b, finalPalette);
    };

    const pixelData = pixelArtData.map(pixel => {
        if (pixel.a < 128) return { id: 'NONE', r: 255, g: 255, b: 255, a: 0 };
        return matchFinalPaletteColor(pixel.r, pixel.g, pixel.b);
    });

    if (isDitheringEnabled) {
        const errorBuffer = new Float32Array(gridWidth * gridHeight * 3);
        let ditheredCount = 0, skippedCount = 0;
        const pixelDataSnapshot = pixelData.slice();

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const idx = y * gridWidth + x;
                const avgColor = pixelArtData[idx];

                if (avgColor.a < 128) continue;

                const needsDithering = shouldEnableDithering(x, y, gridWidth, gridHeight, pixelDataSnapshot);

                if (needsDithering) {
                    ditheredCount++;
                    const errIdx = idx * 3;
                    const r = Math.max(0, Math.min(255, avgColor.r + errorBuffer[errIdx]));
                    const g = Math.max(0, Math.min(255, avgColor.g + errorBuffer[errIdx + 1]));
                    const b = Math.max(0, Math.min(255, avgColor.b + errorBuffer[errIdx + 2]));

                    const matched = matchFinalPaletteColor(r, g, b);
                    pixelData[idx] = matched;

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
                } else {
                    skippedCount++;
                }
            }
        }
        console.log('[SmartDither] dithered:', ditheredCount, 'skipped:', skippedCount);
    }

    if (precisionMode === 'high') {
        unifySmallRegions(pixelData, gridWidth, gridHeight, 2, 45, 2);
    } else {
        unifySmallRegions(pixelData, gridWidth, gridHeight, 2);
    }

    return pixelData;
}

export function generatePatternData({
    sourceImageData,
    gridWidth,
    gridHeight,
    brand,
    mardSet,
    isColorLimitEnabled,
    maxColors,
    isDitheringEnabled,
    precisionMode = 'standard',
    colorMatchMode = 'redmean',
    palettes
}) {
    const { data: sourceData, width: sourceWidth, height: sourceHeight } = sourceImageData;
    let palette = palettes[brand] || palettes.perler;

    // MARD 品牌过滤
    if (brand === 'mard') {
        palette = getFilteredMardPalette(mardSet);
    }

    const useDeltaE = colorMatchMode === 'deltae';
    const matchNearestColor = (r, g, b, activePalette) => {
        if (!useDeltaE) return findNearestColor(r, g, b, activePalette);
        return findNearestColorDeltaE(r, g, b, buildLabPalette(activePalette));
    };

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
                const nearest = matchNearestColor(rep.r, rep.g, rep.b, palette);
                reducedPaletteMap.set(nearest.id, nearest);
            });
            finalPalette = Array.from(reducedPaletteMap.values());
        }
    }

    const finalLabPalette = useDeltaE ? buildLabPalette(finalPalette) : null;
    const matchFinalPaletteColor = (r, g, b) => {
        return useDeltaE
            ? findNearestColorDeltaE(r, g, b, finalLabPalette)
            : findNearestColor(r, g, b, finalPalette);
    };

    const pixelData = [];
    const avgColors = [];

    const useHighPrecisionSampling = precisionMode === 'high';

    function sampleCellColor(startX, startY, endX, endY) {
        let rSum = 0, gSum = 0, bSum = 0, opaqueCount = 0, totalCount = 0;
        let weightedR = 0, weightedG = 0, weightedB = 0, weightSum = 0;
        const colorBuckets = new Map();
        const centerX = (startX + endX - 1) / 2;
        const centerY = (startY + endY - 1) / 2;
        const maxDistance = Math.max(1, Math.hypot(endX - startX, endY - startY) / 2);

        for (let sy = startY; sy < endY; sy++) {
            for (let sx = startX; sx < endX; sx++) {
                const idx = (sy * sourceWidth + sx) * 4;
                totalCount++;
                if (sourceData[idx + 3] > 128) {
                    const r = sourceData[idx];
                    const g = sourceData[idx + 1];
                    const b = sourceData[idx + 2];
                    rSum += r;
                    gSum += g;
                    bSum += b;
                    opaqueCount++;

                    if (useHighPrecisionSampling) {
                        const distance = Math.hypot(sx - centerX, sy - centerY);
                        const weight = 1 + Math.max(0, 1 - distance / maxDistance);
                        weightedR += r * weight;
                        weightedG += g * weight;
                        weightedB += b * weight;
                        weightSum += weight;

                        const bucketKey = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
                        const bucket = colorBuckets.get(bucketKey) || { r: 0, g: 0, b: 0, count: 0 };
                        bucket.r += r;
                        bucket.g += g;
                        bucket.b += b;
                        bucket.count++;
                        colorBuckets.set(bucketKey, bucket);
                    }
                }
            }
        }

        const opaqueRatio = opaqueCount / Math.max(totalCount, 1);
        const alphaThreshold = useHighPrecisionSampling ? 0.22 : 0.3;
        if (opaqueRatio <= alphaThreshold) {
            return { r: 255, g: 255, b: 255, a: 0 };
        }

        if (!useHighPrecisionSampling || weightSum === 0) {
            return {
                r: opaqueCount > 0 ? rSum / opaqueCount : 255,
                g: opaqueCount > 0 ? gSum / opaqueCount : 255,
                b: opaqueCount > 0 ? bSum / opaqueCount : 255,
                a: 255
            };
        }

        const weightedAvg = {
            r: weightedR / weightSum,
            g: weightedG / weightSum,
            b: weightedB / weightSum
        };
        let dominantBucket = null;
        for (const bucket of colorBuckets.values()) {
            if (!dominantBucket || bucket.count > dominantBucket.count) {
                dominantBucket = bucket;
            }
        }

        if (dominantBucket && dominantBucket.count / opaqueCount >= 0.42) {
            const dominantAvg = {
                r: dominantBucket.r / dominantBucket.count,
                g: dominantBucket.g / dominantBucket.count,
                b: dominantBucket.b / dominantBucket.count
            };
            return {
                r: dominantAvg.r * 0.65 + weightedAvg.r * 0.35,
                g: dominantAvg.g * 0.65 + weightedAvg.g * 0.35,
                b: dominantAvg.b * 0.65 + weightedAvg.b * 0.35,
                a: 255
            };
        }

        return { ...weightedAvg, a: 255 };
    }

    // Phase 1: sample and match colors (no dithering)
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const startX = Math.floor((x / gridWidth) * sourceWidth);
            const startY = Math.floor((y / gridHeight) * sourceHeight);
            const endX = Math.floor(((x + 1) / gridWidth) * sourceWidth);
            const endY = Math.floor(((y + 1) / gridHeight) * sourceHeight);

            const { r, g, b, a } = sampleCellColor(startX, startY, endX, endY);

            avgColors.push({ r, g, b, a });

            if (a < 128) {
                pixelData.push({ id: 'NONE', r: 255, g: 255, b: 255, a: 0 });
            } else {
                const matched = matchFinalPaletteColor(r, g, b);
                pixelData.push(matched);
            }
        }
    }

    // Phase 2: smart dithering (only for gradient areas)
    if (isDitheringEnabled) {
        const errorBuffer = new Float32Array(gridWidth * gridHeight * 3);
        let ditheredCount = 0, skippedCount = 0;
        // 快照 Phase 1 的结果，判断时始终用快照，不受本阶段修改影响
        const pixelDataSnapshot = pixelData.slice();

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const idx = y * gridWidth + x;
                const avgColor = avgColors[idx];

                if (avgColor.a < 128) continue;

                const needsDithering = shouldEnableDithering(x, y, gridWidth, gridHeight, pixelDataSnapshot);

                if (needsDithering) {
                    ditheredCount++;
                    const errIdx = idx * 3;
                    let r = Math.max(0, Math.min(255, avgColor.r + errorBuffer[errIdx]));
                    let g = Math.max(0, Math.min(255, avgColor.g + errorBuffer[errIdx + 1]));
                    let b = Math.max(0, Math.min(255, avgColor.b + errorBuffer[errIdx + 2]));

                    const matched = matchFinalPaletteColor(r, g, b);
                    pixelData[idx] = matched;

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
                } else {
                    skippedCount++;
                }
            }
        }
        console.log('[SmartDither] dithered:', ditheredCount, 'skipped:', skippedCount);
    }

    // Phase 3: 色块连通性后处理 - 忠实模式只清理非常接近的孤立噪点
    if (useHighPrecisionSampling) {
        unifySmallRegions(pixelData, gridWidth, gridHeight, 2, 45, 2);
    } else {
        unifySmallRegions(pixelData, gridWidth, gridHeight, 2);
    }

    return pixelData;
}

/**
 * 色块连通性后处理：把面积小于 minSize 的孤立色块归并到周围主色
 * @param {Array} pixelData - 像素数据（直接修改）
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} minSize - 小于此格数的色块会被归并
 * @param {number} maxColorDiff - 允许归并的最大 RGB 色差
 * @param {number} minNeighborContacts - 至少接触多少个同类邻居才归并
 */
function unifySmallRegions(pixelData, gridWidth, gridHeight, minSize, maxColorDiff = 80, minNeighborContacts = 1) {
    const visited = new Uint8Array(gridWidth * gridHeight);

    for (let startY = 0; startY < gridHeight; startY++) {
        for (let startX = 0; startX < gridWidth; startX++) {
            const startIdx = startY * gridWidth + startX;
            if (visited[startIdx]) continue;
            const color = pixelData[startIdx];
            if (!color || color.id === 'NONE') { visited[startIdx] = 1; continue; }

            // BFS 找出同色连通区域
            const region = [];
            const queue = [startIdx];
            visited[startIdx] = 1;

            while (queue.length > 0) {
                const idx = queue.shift();
                region.push(idx);
                const cx = idx % gridWidth;
                const cy = Math.floor(idx / gridWidth);
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                for (const [dx, dy] of dirs) {
                    const nx = cx + dx, ny = cy + dy;
                    if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
                    const nIdx = ny * gridWidth + nx;
                    if (visited[nIdx]) continue;
                    if (pixelData[nIdx] && pixelData[nIdx].id === color.id) {
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }
            }

            // 如果色块面积太小，归并到周围最多的颜色
            if (region.length < minSize) {
                const neighborCount = {};
                for (const idx of region) {
                    const cx = idx % gridWidth;
                    const cy = Math.floor(idx / gridWidth);
                    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                    for (const [dx, dy] of dirs) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
                        const nIdx = ny * gridWidth + nx;
                        const nc = pixelData[nIdx];
                        if (!nc || nc.id === color.id || nc.id === 'NONE') continue;
                        neighborCount[nc.id] = (neighborCount[nc.id] || { color: nc, count: 0 });
                        neighborCount[nc.id].count++;
                    }
                }
                // 找出接触最多的邻居色
                let bestColor = null, bestCount = 0;
                for (const entry of Object.values(neighborCount)) {
                    if (entry.count > bestCount) { bestCount = entry.count; bestColor = entry.color; }
                }
                if (bestColor && bestCount >= minNeighborContacts) {
                    // 只有当小色块与最多邻居色差异很小时才归并（避免消除有意义的细节）
                    const dr = color.r - bestColor.r;
                    const dg = color.g - bestColor.g;
                    const db = color.b - bestColor.b;
                    const colorDiff = Math.sqrt(dr*dr + dg*dg + db*db);
                    // 色差足够接近才归并：差异太大说明可能是有意义的细节（如黑色眼睛在粉色脸上）
                    if (colorDiff < maxColorDiff) {
                        for (const idx of region) {
                            pixelData[idx] = bestColor;
                        }
                    }
                }
            }
        }
    }
}
