/** Eight-neighbor singleton checks; all suggestions read the same immutable snapshot. */
export const isOccupied = color => Boolean(color?.id && color.id !== 'NONE');
export function neighborIndices(index, width, height) {
    const x = index % width, y = Math.floor(index / width), result = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        result.push((y + dy) * width + x + dx);
    }
    return result;
}
export function isSingleton(pixels, index, width, height) {
    return isOccupied(pixels[index]) && !neighborIndices(index, width, height).some(next => pixels[next]?.id === pixels[index].id);
}
export function findSingletons(pixels, width, height) {
    if (!width || !height || pixels.length !== width * height) return [];
    const result = [];
    pixels.forEach((color, index) => {
        if (!isSingleton(pixels, index, width, height)) return;
        const x = index % width, y = Math.floor(index / width);
        result.push({ index, colorId: color.id, bounds: { minX: x, maxX: x, minY: y, maxY: y }, suspectIndices: [index], number: result.length + 1 });
    });
    return result;
}
export const pixelSignature = pixels => JSON.stringify(pixels.map(color => [color?.id, color?.r, color?.g, color?.b, color?.a]));
export function suggestRepairs(pixels, width, height, items) {
    const occupied = pixels.filter(isOccupied).length;
    const plans = items.filter(item => !item.ignored && pixels[item.index]?.id === item.colorId && isSingleton(pixels, item.index, width, height)).map(item => {
        const counts = new Map();
        for (const index of neighborIndices(item.index, width, height)) {
            const color = pixels[index];
            if (!isOccupied(color)) continue;
            const entry = counts.get(color.id) || { color, count: 0 };
            entry.count++; counts.set(color.id, entry);
        }
        const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
        if (!sorted.length) return { ...item, kind: 'erase', nextColor: { id: 'NONE', r: 0, g: 0, b: 0, a: 0 }, recommended: true, reason: '周围无有效颜色，建议擦除' };
        if (sorted[1]?.count === sorted[0].count) return { ...item, kind: 'manual', recommended: false, reason: '邻色并列，需手动处理' };
        const total = sorted.reduce((sum, entry) => sum + entry.count, 0);
        const recommended = sorted[0].count > total / 2;
        return { ...item, kind: 'recolor', nextColor: { ...sorted[0].color }, recommended,
            reason: recommended ? `邻色过半（${sorted[0].count}/${total}）` : `邻色未过半（${sorted[0].count}/${total}），默认不选` };
    });
    // If every remaining bead would be erased, leave one for the user to inspect.
    if (plans.filter(plan => plan.kind === 'erase').length === occupied && occupied) {
        const last = plans.findLast(plan => plan.kind === 'erase');
        last.blocked = true; last.recommended = false; last.reason = '至少保留一颗豆子，不自动擦除此格';
    }
    return plans;
}
