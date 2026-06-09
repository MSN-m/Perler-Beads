import { AppState } from '../state.js';
import { renderResult } from '../renderer.js';

const NONE_ID = 'NONE';
const SMALL_COMPONENT_MAX_SIZE = 3;
const REGION_SIZE = 8;
const QUALITY_GRID_COLUMNS = 3;
const QUALITY_GRID_ROWS = 3;

function getActivePixels() {
    return AppState.stagedPixelData || AppState.pixelData || [];
}

function getNeighbors(idx, gridWidth, gridHeight) {
    const x = idx % gridWidth;
    const y = Math.floor(idx / gridWidth);
    const neighbors = [];
    if (x > 0) neighbors.push(idx - 1);
    if (x < gridWidth - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - gridWidth);
    if (y < gridHeight - 1) neighbors.push(idx + gridWidth);
    return neighbors;
}

function makeBounds(indices, gridWidth, gridHeight) {
    let minX = gridWidth;
    let minY = gridHeight;
    let maxX = -1;
    let maxY = -1;

    for (const idx of indices) {
        const x = idx % gridWidth;
        const y = Math.floor(idx / gridWidth);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    return { minX, minY, maxX, maxY };
}

function overlaps(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function uniqueIndices(indices) {
    return Array.from(new Set(indices)).sort((a, b) => a - b);
}

function isIndexInsideBounds(idx, bounds, gridWidth) {
    const x = idx % gridWidth;
    const y = Math.floor(idx / gridWidth);
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

function getFixedRegionIndexForCell(idx, gridWidth, gridHeight) {
    const x = idx % gridWidth;
    const y = Math.floor(idx / gridWidth);
    const col = Math.min(QUALITY_GRID_COLUMNS - 1, Math.floor((x / Math.max(gridWidth, 1)) * QUALITY_GRID_COLUMNS));
    const row = Math.min(QUALITY_GRID_ROWS - 1, Math.floor((y / Math.max(gridHeight, 1)) * QUALITY_GRID_ROWS));
    return row * QUALITY_GRID_COLUMNS + col;
}

function findSmallComponentIssues(pixels, gridWidth, gridHeight) {
    const visited = new Uint8Array(gridWidth * gridHeight);
    const issues = [];

    for (let i = 0; i < pixels.length; i++) {
        const start = pixels[i];
        if (!start || start.id === NONE_ID || visited[i]) continue;

        const stack = [i];
        const indices = [];
        visited[i] = 1;

        while (stack.length) {
            const idx = stack.pop();
            indices.push(idx);

            for (const nextIdx of getNeighbors(idx, gridWidth, gridHeight)) {
                const next = pixels[nextIdx];
                if (!next || next.id !== start.id || visited[nextIdx]) continue;
                visited[nextIdx] = 1;
                stack.push(nextIdx);
            }
        }

        if (indices.length > SMALL_COMPONENT_MAX_SIZE) continue;

        issues.push({
            type: 'small_component',
            label: indices.length === 1 ? '\u72ec\u7acb\u8272\u5757' : '\u5c11\u91cf\u72ec\u7acb\u8272\u5757',
            description: `${start.id} \u5171 ${indices.length} \u683c`,
            indices,
            suspectIndices: indices,
            bounds: makeBounds(indices, gridWidth, gridHeight),
            severity: indices.length === 1 ? 3 : 2
        });
    }

    return issues;
}

function findFragmentedRegionIssues(pixels, gridWidth, gridHeight) {
    const issues = [];
    const windowSize = Math.min(REGION_SIZE, gridWidth, gridHeight);
    if (windowSize < 6) return issues;

    const stride = Math.max(4, Math.floor(windowSize / 2));

    for (let startY = 0; startY <= gridHeight - windowSize; startY += stride) {
        for (let startX = 0; startX <= gridWidth - windowSize; startX += stride) {
            const colorCounts = new Map();
            const colorIndices = new Map();
            const indices = [];

            for (let y = startY; y < startY + windowSize; y++) {
                for (let x = startX; x < startX + windowSize; x++) {
                    const idx = y * gridWidth + x;
                    const pixel = pixels[idx];
                    if (!pixel || pixel.id === NONE_ID) continue;
                    indices.push(idx);
                    colorCounts.set(pixel.id, (colorCounts.get(pixel.id) || 0) + 1);
                    const list = colorIndices.get(pixel.id) || [];
                    list.push(idx);
                    colorIndices.set(pixel.id, list);
                }
            }

            const coloredCount = indices.length;
            if (coloredCount < Math.floor(windowSize * windowSize * 0.55)) continue;

            const uniqueColors = colorCounts.size;
            const dominantCount = Math.max(...colorCounts.values());
            const dominantRatio = dominantCount / coloredCount;

            if (uniqueColors < 6 || dominantRatio > 0.42) continue;

            const rareLimit = Math.max(2, Math.floor(coloredCount * 0.08));
            const suspectIndices = [];
            for (const [colorId, count] of colorCounts.entries()) {
                if (count <= rareLimit) {
                    suspectIndices.push(...(colorIndices.get(colorId) || []));
                }
            }

            const bounds = { minX: startX, minY: startY, maxX: startX + windowSize - 1, maxY: startY + windowSize - 1 };
            if (issues.some(issue => overlaps(issue.bounds, bounds))) continue;

            issues.push({
                type: 'fragmented_region',
                label: '\u989c\u8272\u6563\u788e',
                description: `${windowSize}x${windowSize} \u533a\u57df\u5185 ${uniqueColors} \u8272`,
                indices,
                suspectIndices: suspectIndices.length ? uniqueIndices(suspectIndices) : indices,
                bounds,
                severity: uniqueColors >= 8 ? 3 : 2
            });
        }
    }

    return issues;
}

function makeFixedRegion(col, row, gridWidth, gridHeight) {
    const minX = Math.floor((col / QUALITY_GRID_COLUMNS) * gridWidth);
    const maxX = Math.floor(((col + 1) / QUALITY_GRID_COLUMNS) * gridWidth) - 1;
    const minY = Math.floor((row / QUALITY_GRID_ROWS) * gridHeight);
    const maxY = Math.floor(((row + 1) / QUALITY_GRID_ROWS) * gridHeight) - 1;
    return { minX, minY, maxX, maxY };
}

function createFixedRegions(gridWidth, gridHeight) {
    const regions = [];
    for (let row = 0; row < QUALITY_GRID_ROWS; row++) {
        for (let col = 0; col < QUALITY_GRID_COLUMNS; col++) {
            regions.push({
                bounds: makeFixedRegion(col, row, gridWidth, gridHeight),
                col,
                row,
                issues: [],
                suspectIndices: [],
                severity: 0
            });
        }
    }
    return regions;
}

function buildQualityRegions(issues, gridWidth, gridHeight) {
    const regions = createFixedRegions(gridWidth, gridHeight);

    for (const issue of issues) {
        const suspectIndices = uniqueIndices(issue.suspectIndices || issue.indices || []);
        const indicesByRegion = new Map();

        for (const idx of suspectIndices) {
            const regionIndex = getFixedRegionIndexForCell(idx, gridWidth, gridHeight);
            const list = indicesByRegion.get(regionIndex) || [];
            list.push(idx);
            indicesByRegion.set(regionIndex, list);
        }

        for (const [regionIndex, indices] of indicesByRegion.entries()) {
            const region = regions[regionIndex];
            const localIndices = indices.filter(idx => isIndexInsideBounds(idx, region.bounds, gridWidth));
            if (!localIndices.length) continue;
            region.issues.push(issue);
            region.suspectIndices = uniqueIndices([...region.suspectIndices, ...localIndices]);
            region.severity = Math.max(region.severity, issue.severity);
        }
    }

    return regions
        .filter(region => region.suspectIndices.length > 0)
        .sort((a, b) => {
            if (b.severity !== a.severity) return b.severity - a.severity;
            return b.suspectIndices.length - a.suspectIndices.length;
        })
        .map((region, index) => ({
            ...region,
            number: index + 1,
            issueCount: region.suspectIndices.length,
            label: `\u533a\u57df ${region.row + 1}-${region.col + 1}`,
            description: `\u5305\u542b ${region.suspectIndices.length} \u4e2a\u7591\u4f3c\u683c\u5b50`
        }));
}

export function analyzeQualityIssues() {
    const pixels = getActivePixels();
    if (!pixels.length || !AppState.gridWidth || !AppState.gridHeight) return [];

    const issues = [
        ...findFragmentedRegionIssues(pixels, AppState.gridWidth, AppState.gridHeight),
        ...findSmallComponentIssues(pixels, AppState.gridWidth, AppState.gridHeight)
    ];

    return buildQualityRegions(issues, AppState.gridWidth, AppState.gridHeight);
}

export function refreshQualityIssues() {
    AppState.qualityIssues = analyzeQualityIssues();
    return AppState.qualityIssues;
}

function renderQualityLayer() {
    const resultCanvas = document.getElementById('result-canvas');
    if (resultCanvas && AppState.pixelData.length) {
        renderResult(resultCanvas, getActivePixels(), AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    }
}

export function toggleQualityCheck() {
    AppState.qualityOverlayVisible = !AppState.qualityOverlayVisible;
    if (AppState.qualityOverlayVisible) {
        refreshQualityIssues();
    }
    renderQualityLayer();
}

export function openQualityCheckModal() {
    toggleQualityCheck();
}

export function refreshQualityOverlay() {
    if (!AppState.qualityOverlayVisible) return;
    refreshQualityIssues();
    renderQualityLayer();
}
