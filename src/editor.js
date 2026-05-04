/**
 * 编辑页共享逻辑：暂存数据、调色板、颜色统计与批量替换
 */
import { AppState } from './state.js';
import { getFilteredMardPalette } from './processor.js';
import { renderResult } from './renderer.js';
import { PALETTES } from './constants.js';

let editorActions = {
    enterColorReplaceMode: null,
    updateWorkbenchUI: null
};

let colorMenuDocumentClickBound = false;

export function configureEditorActions(actions) {
    editorActions = { ...editorActions, ...actions };
}

export function deepClonePixels(arr) {
    return arr ? arr.map(p => ({ id: p.id, r: p.r, g: p.g, b: p.b, a: p.a })) : null;
}

export function updateAdjustUndoButton() {
    const undoBtn = document.getElementById('adjust-undo-btn');
    if (!undoBtn) return;
    if (AppState.stagedActions.length > 0) undoBtn.classList.remove('opacity-50', 'pointer-events-none');
    else undoBtn.classList.add('opacity-50', 'pointer-events-none');
}

export function resetBatchReplaceState() {
    AppState.batchReplace.active = false;
    AppState.batchReplace.mode = null;
    AppState.batchReplace.sourceColorId = null;
    AppState.batchReplace.nearCandidates = [];
    AppState.batchReplace.nearBaseline = null;
    AppState.batchReplace.nearCurrentId = null;
}

function redmeanDistance(r1, g1, b1, r2, g2, b2) {
    const rMean = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return (2 + rMean / 256) * (dr * dr) + 4 * (dg * dg) + (2 + (255 - rMean) / 256) * (db * db);
}

export function getCurrentPalette() {
    if (AppState.brand === 'mard') return getFilteredMardPalette(AppState.mardSet);
    return PALETTES[AppState.brand] || PALETTES.perler;
}

export function performBatchReplace(sourceId, target) {
    if (!AppState.stagedPixelData) AppState.stagedPixelData = deepClonePixels(AppState.pixelData);
    const indices = [];
    const prevColors = [];
    for (let i = 0; i < AppState.stagedPixelData.length; i++) {
        const c = AppState.stagedPixelData[i];
        if (c && c.id === sourceId) {
            indices.push(i);
            prevColors.push({ id: c.id, r: c.r, g: c.g, b: c.b });
            AppState.stagedPixelData[i] = { id: target.id, r: target.r, g: target.g, b: target.b };
        }
    }
    if (indices.length > 0) {
        AppState.stagedActions.push({ indices, prevColors, nextColor: { id: target.id, r: target.r, g: target.g, b: target.b } });
    }
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    calculateStats();
    updateAdjustUndoButton();
}

function toggleColorHighlight(colorId) {
    if (AppState.highlightedColorId === colorId) {
        AppState.highlightedColorId = null;
    } else {
        AppState.highlightedColorId = colorId;
    }
    const resultCanvas = document.getElementById('result-canvas');
        const dataToRender = AppState.stagedPixelData
        ? AppState.stagedPixelData
        : AppState.pixelData;
    renderResult(resultCanvas, dataToRender, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
}

function ensureColorMenuDocumentClick() {
    if (colorMenuDocumentClickBound) return;
    document.addEventListener('click', (e) => {
        const container = document.getElementById('color-stats');
        if (container && container.contains(e.target)) return;
        document.querySelectorAll('[id^="color-menu-"]').forEach(el => {
            el.classList.add('hidden');
            if (el.parentElement) el.parentElement.classList.remove('z-50');
        });
    });
    colorMenuDocumentClickBound = true;
}

/**
 * 统计颜色和总颗数
 */
export function calculateStats() {
    const stats = {};
    let total = 0;
    const dataToCount = AppState.stagedPixelData
        ? AppState.stagedPixelData
        : AppState.pixelData;
    dataToCount.forEach(p => {
        if (p.id === 'NONE') return;
        if (!stats[p.id]) stats[p.id] = { ...p, count: 0 };
        stats[p.id].count++;
        total++;
    });

    const sorted = Object.values(stats).sort((a, b) => b.count - a.count);

    document.getElementById('total-beads-count').innerText = `共 ${total} 颗`;
    document.getElementById('color-types-count').innerText = `${sorted.length} 色`;

    const container = document.getElementById('color-stats');
    container.innerHTML = sorted.map(c => {
        const yiq = ((c.r * 299) + (c.g * 587) + (c.b * 114)) / 1000;
        const textColor = yiq >= 128 ? 'text-black/80' : 'text-white/90';
        const isSelected = AppState.highlightedColorId === c.id;
        const bg = `rgb(${c.r},${c.g},${c.b})`;
        const iconColor = yiq >= 128 ? 'text-black' : 'text-white';
        return `
            <div id="color-item-${c.id}" class="relative overflow-visible flex items-center justify-between px-2 py-1.5 rounded-full transition-all cursor-pointer active:scale-95 border-2 ${isSelected ? 'border-primary ring-2 ring-primary/30 shadow-lg' : 'border-transparent opacity-90 hover:opacity-100'}" style="background-color:${bg}; overflow: visible;">
                <div class="flex items-center space-x-2">
                    <span class="text-[11px] font-bold font-mono ${textColor}">${c.id}</span>
                    <span class="text-[10px] font-medium ${textColor}">(${c.count})</span>
                </div>
                <button id="color-menu-btn-${c.id}" aria-label="颜色操作菜单" class="flex items-center justify-center w-7 h-7 rounded-md shrink-0 ring-1 ring-white/40 bg-black/20 hover:bg-black/30 ${iconColor}" style="min-width:28px; min-height:28px; display:flex; align-items:center; justify-content:center; border-radius:6px; background: rgba(0,0,0,0.2); color:#fff;">
                    <svg class="w-3.5 h-3.5 ${iconColor}" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <circle cx="4" cy="10" r="2"></circle>
                        <circle cx="10" cy="10" r="2"></circle>
                        <circle cx="16" cy="10" r="2"></circle>
                    </svg>
                </button>
                <div id="color-menu-${c.id}" class="absolute right-0 top-full mt-1 bg-white text-gray-800 rounded-lg shadow-lg border border-gray-100 hidden z-50" style="z-index: 9999;">
                    <button id="menu-from-canvas-${c.id}" class="block text-left px-3 py-2 hover:bg-gray-50 w-40">从图纸点击替换</button>
                    <button id="menu-nearby-${c.id}" class="block text-left px-3 py-2 hover:bg-gray-50 w-40">替换为相近色</button>
                    <div id="nearby-panel-${c.id}" class="hidden px-3 py-2 border-t border-gray-100">
                        <div class="flex space-x-2 mb-2" id="nearby-swatches-${c.id}"></div>
                        <div class="flex justify-end space-x-2">
                            <button id="nearby-cancel-${c.id}" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm">取消</button>
                            <button id="nearby-confirm-${c.id}" class="px-3 py-1 rounded bg-primary text-white text-sm">确认</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    sorted.forEach(c => {
        const item = document.getElementById(`color-item-${c.id}`);
        const menuBtn = document.getElementById(`color-menu-btn-${c.id}`);
        const menu = document.getElementById(`color-menu-${c.id}`);
        const fromCanvasBtn = document.getElementById(`menu-from-canvas-${c.id}`);
        const nearbyBtn = document.getElementById(`menu-nearby-${c.id}`);
        const nearbyPanel = document.getElementById(`nearby-panel-${c.id}`);
        const swatchesWrap = document.getElementById(`nearby-swatches-${c.id}`);
        const nearbyCancel = document.getElementById(`nearby-cancel-${c.id}`);
        const nearbyConfirm = document.getElementById(`nearby-confirm-${c.id}`);
        if (item) {
            item.addEventListener('click', () => toggleColorHighlight(c.id));
        }
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('[id^="color-menu-"]').forEach(el => {
                    el.classList.add('hidden');
                    if (el.parentElement) el.parentElement.classList.remove('z-50');
                });
                const nowHidden = menu.classList.toggle('hidden');
                if (!nowHidden) {
                    item.classList.add('z-50');
                } else {
                    item.classList.remove('z-50');
                }
            });
        }
        if (menu) menu.addEventListener('click', (e) => e.stopPropagation());
        if (fromCanvasBtn) {
            fromCanvasBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.add('hidden');
                item.classList.remove('z-50');
                if (editorActions.enterColorReplaceMode) editorActions.enterColorReplaceMode();
                AppState.batchReplace.active = true;
                AppState.batchReplace.mode = 'from_canvas';
                AppState.batchReplace.sourceColorId = c.id;
                if (editorActions.updateWorkbenchUI) editorActions.updateWorkbenchUI();
            });
        }
        if (nearbyBtn) {
            nearbyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (editorActions.enterColorReplaceMode) editorActions.enterColorReplaceMode();
                const fullPalette = getCurrentPalette();
                const palette = fullPalette.filter(x => x.id !== c.id);
                const paletteBase = fullPalette.find(x => x.id === c.id);
                const baseR = paletteBase ? paletteBase.r : c.r;
                const baseG = paletteBase ? paletteBase.g : c.g;
                const baseB = paletteBase ? paletteBase.b : c.b;
                const sortedP = palette
                    .map(p => ({ p, d: redmeanDistance(baseR, baseG, baseB, p.r, p.g, p.b) }))
                    .sort((a, b) => a.d - b.d)
                    .slice(0, 3)
                    .map(x => x.p);
                AppState.batchReplace.active = true;
                AppState.batchReplace.mode = 'nearby';
                AppState.batchReplace.sourceColorId = c.id;
                AppState.batchReplace.nearCandidates = sortedP;
                AppState.batchReplace.nearBaseline = deepClonePixels(AppState.stagedPixelData);
                AppState.batchReplace.nearCurrentId = null;
                swatchesWrap.innerHTML = sortedP.map(col => `<button data-id="${col.id}" class="w-8 h-8 rounded border border-gray-200" style="background-color: rgb(${col.r},${col.g},${col.b})"></button>`).join('');
                nearbyPanel.classList.remove('hidden');
                menu.classList.remove('hidden');
                item.classList.add('z-50');
                if (editorActions.updateWorkbenchUI) editorActions.updateWorkbenchUI();
            });
        }
        if (swatchesWrap) {
            swatchesWrap.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-id]');
                if (!btn) return;
                const id = btn.getAttribute('data-id');
                const target = AppState.batchReplace.nearCandidates.find(x => x.id === id);
                if (!target) return;
                AppState.batchReplace.nearCurrentId = id;
                AppState.stagedPixelData = deepClonePixels(AppState.batchReplace.nearBaseline);
                performBatchReplace(AppState.batchReplace.sourceColorId, target);
            });
        }
        if (nearbyCancel) {
            nearbyCancel.addEventListener('click', (e) => {
                e.stopPropagation();
                if (AppState.batchReplace.nearBaseline) {
                    AppState.stagedPixelData = deepClonePixels(AppState.batchReplace.nearBaseline);
                    const resultCanvas = document.getElementById('result-canvas');
                    renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
                    calculateStats();
                }
                resetBatchReplaceState();
                nearbyPanel.classList.add('hidden');
                menu.classList.add('hidden');
                item.classList.remove('z-50');
            });
        }
        if (nearbyConfirm) {
            nearbyConfirm.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = AppState.batchReplace.nearCurrentId;
                const target = AppState.batchReplace.nearCandidates.find(x => x.id === id) || AppState.batchReplace.nearCandidates[0];
                if (target) {
                    AppState.stagedPixelData = deepClonePixels(AppState.batchReplace.nearBaseline);
                    performBatchReplace(AppState.batchReplace.sourceColorId, target);
                }
                resetBatchReplaceState();
                nearbyPanel.classList.add('hidden');
                menu.classList.add('hidden');
                item.classList.remove('z-50');
            });
        }
    });

    ensureColorMenuDocumentClick();
}
