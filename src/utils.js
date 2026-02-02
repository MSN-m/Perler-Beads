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
