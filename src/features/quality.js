import { AppState } from '../state.js';
import { renderResult } from '../renderer.js';

const NONE_ID = 'NONE';
const SMALL_COMPONENT_MAX_SIZE = 3;
const MAX_ISSUES = 24;

function getActivePixels() {
    return AppState.stagedPixelData || AppState.pixelData || [];
}

function makeBounds(indices, gridWidth) {
    let minX = gridWidth;
    let minY = AppState.gridHeight;
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
            label: indices.length === 1 ? '独立色块' : '少量独立色块',
            description: `${start.id} · ${indices.length} 颗`,
            indices,
            bounds: makeBounds(indices, gridWidth),
            severity: indices.length === 1 ? 3 : 2
        });
    }

    return issues;
}

function overlaps(a, b) {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function findFragmentedRegionIssues(pixels, gridWidth, gridHeight) {
    const issues = [];
    const windowSize = Math.min(8, gridWidth, gridHeight);
    if (windowSize < 6) return issues;

    const stride = Math.max(4, Math.floor(windowSize / 2));

    for (let startY = 0; startY <= gridHeight - windowSize; startY += stride) {
        for (let startX = 0; startX <= gridWidth - windowSize; startX += stride) {
            const colorCounts = new Map();
            const indices = [];

            for (let y = startY; y < startY + windowSize; y++) {
                for (let x = startX; x < startX + windowSize; x++) {
                    const idx = y * gridWidth + x;
                    const pixel = pixels[idx];
                    if (!pixel || pixel.id === NONE_ID) continue;
                    indices.push(idx);
                    colorCounts.set(pixel.id, (colorCounts.get(pixel.id) || 0) + 1);
                }
            }

            const coloredCount = indices.length;
            if (coloredCount < Math.floor(windowSize * windowSize * 0.55)) continue;

            const uniqueColors = colorCounts.size;
            const dominantCount = Math.max(...colorCounts.values());
            const dominantRatio = dominantCount / coloredCount;

            if (uniqueColors < 6 || dominantRatio > 0.42) continue;

            const bounds = { minX: startX, minY: startY, maxX: startX + windowSize - 1, maxY: startY + windowSize - 1 };
            if (issues.some(issue => overlaps(issue.bounds, bounds))) continue;

            issues.push({
                type: 'fragmented_region',
                label: '颜色散碎',
                description: `${windowSize}x${windowSize} 区域内 ${uniqueColors} 色`,
                indices,
                bounds,
                severity: uniqueColors >= 8 ? 3 : 2
            });
        }
    }

    return issues;
}

export function analyzeQualityIssues() {
    const pixels = getActivePixels();
    if (!pixels.length || !AppState.gridWidth || !AppState.gridHeight) return [];

    const fragmentedIssues = findFragmentedRegionIssues(pixels, AppState.gridWidth, AppState.gridHeight);
    const smallIssues = findSmallComponentIssues(pixels, AppState.gridWidth, AppState.gridHeight);
    const issues = [...fragmentedIssues, ...smallIssues]
        .sort((a, b) => b.severity - a.severity)
        .slice(0, MAX_ISSUES)
        .map((issue, index) => ({ ...issue, number: index + 1 }));

    return issues;
}

export function refreshQualityIssues() {
    AppState.qualityIssues = analyzeQualityIssues();
    return AppState.qualityIssues;
}

export function renderQualityModal() {
    const modal = document.getElementById('quality-check-modal');
    const list = document.getElementById('quality-check-list');
    const summary = document.getElementById('quality-check-summary');
    if (!modal || !list || !summary) return;

    modal.classList.toggle('hidden', !AppState.qualityModalOpen);

    const issues = AppState.qualityIssues || [];
    summary.textContent = issues.length
        ? `发现 ${issues.length} 个可能影响拼豆效果的问题`
        : '暂未发现明显的颜色散碎或独立色块问题';

    list.innerHTML = issues.length
        ? issues.map(issue => `
            <li class="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">${issue.number}</span>
                <span class="min-w-0">
                    <span class="block text-sm font-bold text-gray-900">${issue.number}. ${issue.label}</span>
                    <span class="mt-1 block text-xs text-gray-500">${issue.description}</span>
                </span>
            </li>
        `).join('')
        : '<li class="rounded-xl bg-green-50 px-4 py-5 text-sm font-bold text-green-700">当前图纸看起来比较干净。</li>';
}

export function openQualityCheckModal() {
    refreshQualityIssues();
    AppState.qualityModalOpen = true;
    AppState.qualityOverlayVisible = true;
    renderQualityModal();

    const resultCanvas = document.getElementById('result-canvas');
    if (resultCanvas) {
        renderResult(resultCanvas, getActivePixels(), AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    }
}

export function closeQualityCheckModal() {
    AppState.qualityModalOpen = false;
    AppState.qualityOverlayVisible = false;
    renderQualityModal();

    const resultCanvas = document.getElementById('result-canvas');
    if (resultCanvas && AppState.pixelData.length) {
        renderResult(resultCanvas, getActivePixels(), AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    }
}
