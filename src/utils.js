/**
 * 拼豆图纸生成器 - 工具函数
 */

/**
 * Redmean 颜色距离算法 (比纯欧几里得距离更符合人眼感知)
 * @param {number} r - R 值
 * @param {number} g - G 值
 * @param {number} b - B 值
 * @param {Array} palette - 色板数组
 * @returns {Object} - 最近的颜色对象
 */
export function findNearestColor(r, g, b, palette) {
    let minDist = Infinity;
    let nearest = palette[0];

    for (let color of palette) {
        const rMean = (r + color.r) / 2;
        const dr = r - color.r;
        const dg = g - color.g;
        const db = b - color.b;
        
        // Redmean 权重公式
        const d = (2 + rMean / 256) * (dr * dr) + 
                  4 * (dg * dg) + 
                  (2 + (255 - rMean) / 256) * (db * db);

        if (d < minDist) {
            minDist = d;
            nearest = color;
        }
    }
    return nearest;
}

/**
 * Reads the semantic primary color token for canvas overlays, which cannot use CSS variables directly.
 * @param {number} alpha - Opacity between 0 and 1
 * @returns {string} CSS rgba() color
 */
function getThemeColor(variableName, fallbackHex, alpha) {
    const token = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    const match = /^#([\da-f]{6})$/i.exec(token);
    const hex = match ? match[1] : fallbackHex;
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getThemePrimaryColor(alpha = 1) {
    return getThemeColor('--pb-color-primary', 'DE5387', alpha);
}

export function getThemeMutedColor(alpha = 1) {
    return getThemeColor('--pb-color-muted', 'A0A6B3', alpha);
}

/** Occupied cells next to transparency or the board boundary, regardless of color. */
export function getEdgeBeadIndices(pixels, width, height) {
    const indices = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            if (!pixels[index] || pixels[index].id === 'NONE') continue;
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1
                || [index - 1, index + 1, index - width, index + width]
                    .some(next => !pixels[next] || pixels[next].id === 'NONE')) indices.push(index);
        }
    }
    return indices;
}
