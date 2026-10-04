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

export function mirrorPixelRows(pixels, gridWidth) {
    if (!Array.isArray(pixels)) return pixels;
    const result = pixels.slice();
    for (let start = 0; start < result.length; start += gridWidth) {
        const row = pixels.slice(start, start + gridWidth).reverse();
        result.splice(start, row.length, ...row);
    }
    return result;
}

export function beginGlobalEditorSession(pixelData) {
    AppState.editor.originalPixelData = deepClonePixels(pixelData);
    AppState.editor.undoStack = [];
    AppState.editor.redoStack = [];
    AppState.editor.hasChanges = false;
    const mostUsed = new Map();
    (Array.isArray(pixelData) ? pixelData : []).forEach((pixel) => {
        if (!pixel || pixel.id === 'NONE') return;
        const entry = mostUsed.get(String(pixel.id));
        if (entry) entry.count += 1;
        else mostUsed.set(String(pixel.id), { ...pixel, count: 1 });
    });
    const defaults = [...mostUsed.values()]
        .sort((a, b) => b.count - a.count || String(a.id).localeCompare(String(b.id)))
        .slice(0, 1);
    if (!AppState.paintColor && defaults[0]) {
        rememberPaintColor(defaults[0]);
    }
    restorePaintColor();
}

export function setActiveEditorTool(tool) {
    if (AppState.eraserStroke) return;
    const wasHovering = AppState.eraserHoverColorId !== null;
    const wasEdge = AppState.edgeSelectionMode;
    // Tool switches must clear every incompatible legacy flag, even with an existing session.
    if (tool !== 'color-eraser') AppState.colorEraseMode = false;
    if (!['eraser', 'color-eraser'].includes(tool)) AppState.deleteMode = false;
    if (tool !== 'area-erase') AppState.clearBaseMode = false;
    if (!['brush', 'bucket'].includes(tool)) AppState.fillMode = false;
    if (tool !== 'eyedropper') AppState.eyedropperMode = false;
    if (tool !== 'edge') {
        AppState.edgeSelectionMode = false;
        AppState.selectedEdgeBeadsIndices = [];
    }
    AppState.eraserHoverColorId = null;
    AppState.operationHoverIndex = null;
    AppState.editor.activeTool = tool || 'brush';
    if (['eraser', 'area-erase', 'color-eraser'].includes(tool)) AppState.lastEraserTool = tool;
    if (wasHovering || wasEdge !== AppState.edgeSelectionMode) {
        const canvas = document.getElementById('result-canvas');
        if (canvas) renderResult(canvas, AppState.stagedPixelData || AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    }
    if (['brush', 'bucket', 'edge'].includes(tool)) {
        AppState.lastBrushTool = tool;
        persistColorSelection();
    }
}

const PALETTE_TOOL_KEYS = ['editMode', 'fillMode', 'eyedropperMode', 'deleteMode', 'colorEraseMode', 'edgeSelectionMode', 'clearBaseMode', 'fillSourceMode', 'fillColor', 'fillColorId', 'fillSourceIndex', 'fillSourceSample', 'adjustPhase', 'receiverIndex', 'lastBrushTool', 'lastEraserTool'];

export function openPaletteToolSession() {
    if (AppState.paintStroke || AppState.eraserStroke) return false;
    if (AppState.batchReplace.origin === 'palette') {
        AppState.highlightedColorId = null;
        restorePaletteToolSession();
    }
    AppState.paletteToolSnapshot = {
        patternId: AppState.colorSelectionPatternId,
        tool: AppState.editor.activeTool,
        state: Object.fromEntries(PALETTE_TOOL_KEYS.map(key => [key, AppState[key]]))
    };
    resetBatchReplaceState();
    setActiveEditorTool('palette');
    return true;
}

export function restorePaletteToolSession() {
    const snapshot = AppState.paletteToolSnapshot;
    AppState.paletteToolSnapshot = null;
    if (!snapshot || snapshot.patternId !== AppState.colorSelectionPatternId) return false;
    resetBatchReplaceState();
    Object.assign(AppState, snapshot.state);
    AppState.editor.activeTool = snapshot.tool;
    AppState.eraserHoverColorId = null;
    AppState.operationHoverIndex = null;
    const canvas = document.getElementById('result-canvas');
    if (canvas) renderResult(canvas, AppState.stagedPixelData || AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    return true;
}

const COLOR_SELECTION_KEY = 'perler_beads_color_selection_v1';

export function getColorSelectionSnapshot() {
    if (!AppState.colorSelectionPatternId) AppState.colorSelectionPatternId = `pattern_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return {
        patternId: AppState.colorSelectionPatternId,
        recentColorIds: AppState.recentColors.map(color => String(color.id)).slice(0, 5),
        currentColorId: AppState.paintColor?.id || null,
        lastBrushTool: AppState.lastBrushTool,
        updatedAt: AppState.colorSelectionUpdatedAt
    };
}

function readColorSelections() {
    try {
        const entries = JSON.parse(globalThis.localStorage?.getItem(COLOR_SELECTION_KEY) || '{}');
        return entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {};
    } catch { return {}; }
}

function persistColorSelection() {
    if (!AppState.colorSelectionPatternId) return;
    AppState.colorSelectionUpdatedAt = Math.max(Date.now(), AppState.colorSelectionUpdatedAt + 1);
    try {
        const entries = readColorSelections();
        entries[AppState.colorSelectionPatternId] = getColorSelectionSnapshot();
        const latest = Object.entries(entries).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 50);
        globalThis.localStorage?.setItem(COLOR_SELECTION_KEY, JSON.stringify(Object.fromEntries(latest)));
    } catch (error) { console.warn('最近颜色暂时无法保存到本地，当前选色仍然有效。', error); }
}

export function resetPatternColorSelection(snapshot = null, fallbackId = null) {
    const patternId = typeof snapshot?.patternId === 'string' ? snapshot.patternId : fallbackId;
    const cached = patternId ? readColorSelections()[patternId] : null;
    const source = cached && Number(cached.updatedAt) > Number(snapshot?.updatedAt || 0) ? cached : snapshot;
    const palette = new Map(getCurrentPalette().map(color => [String(color.id), color]));
    const ids = Array.isArray(source?.recentColorIds) ? source.recentColorIds : [];
    AppState.recentColors = [...new Set(ids.filter(id => typeof id === 'string'))]
        .map(id => palette.get(id)).filter(Boolean).slice(0, 5);
    AppState.paintColor = palette.get(String(source?.currentColorId)) || null;
    AppState.colorSelectionPatternId = patternId || `pattern_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    AppState.colorSelectionUpdatedAt = Number(source?.updatedAt) || 0;
    AppState.lastBrushTool = ['brush', 'bucket', 'edge'].includes(source?.lastBrushTool) ? source.lastBrushTool : 'brush';
    AppState.paletteToolSnapshot = null;
    AppState.paletteDismissClickUntil = 0;
    AppState.lastEraserTool = 'eraser';
    AppState.eraserStroke = null;
    AppState.eraserHoverColorId = null;
    AppState.operationHoverIndex = null;
    AppState.eraserClickSuppressedUntil = 0;
    AppState.lastRecentColorId = AppState.recentColors[0]?.id || null;
    AppState.fillColor = null;
    AppState.fillColorId = null;
    AppState.editor.activeTool = 'brush';
}

export function restorePaintColor() {
    AppState.fillColor = AppState.paintColor ? { ...AppState.paintColor } : null;
    AppState.fillColorId = AppState.paintColor?.id || null;
}

export function rememberPaintColor(color) {
    if (!color || color.id === 'NONE') return;
    AppState.paintColor = { id: color.id, r: color.r, g: color.g, b: color.b };
    restorePaintColor();
    AppState.recentColors = [AppState.paintColor, ...AppState.recentColors.filter(item => String(item.id) !== String(color.id))].slice(0, 5);
    AppState.lastRecentColorId = color.id;
    getColorSelectionSnapshot();
    persistColorSelection();
}

function applyPixelAction(pixels, action, useNextColor) {
    if (!pixels || !action) return;
    if (Array.isArray(action.indices)) {
        const colors = useNextColor
            ? action.indices.map(() => action.nextColor)
            : action.prevColors;
        action.indices.forEach((index, i) => {
            pixels[index] = { ...colors[i] };
        });
        return;
    }
    pixels[action.index] = { ...(useNextColor ? action.nextColor : action.prevColor) };
}

function syncCurrentPixelData() {
    if (AppState.stagedPixelData) AppState.pixelData = deepClonePixels(AppState.stagedPixelData);
}

// Existing tools apply their pixel change before recording it. The operation
// therefore applies only on redo and reverts on undo.
export function recordPixelAction(action) {
    if (!action) return false;
    AppState.stagedActions.push(action);
    AppState.editor.undoStack.push({
        pixelAction: action,
        apply() {
            applyPixelAction(AppState.stagedPixelData, action, true);
            syncCurrentPixelData();
            AppState.stagedActions.push(action);
        },
        revert() {
            applyPixelAction(AppState.stagedPixelData, action, false);
            syncCurrentPixelData();
            AppState.stagedActions.pop();
        }
    });
    AppState.editor.redoStack = [];
    AppState.editor.hasChanges = true;
    syncCurrentPixelData();
    return true;
}

// A mirror toggle is a view orientation, not an undoable edit. Rebase every
// recorded edit so undo/redo continues to address the same bead after a flip.
export function mirrorEditorHistory(gridWidth) {
    const mirrorIndex = (index) => {
        const row = Math.floor(index / gridWidth);
        return row * gridWidth + gridWidth - 1 - (index % gridWidth);
    };
    const actions = new Set([
        ...AppState.stagedActions,
        ...AppState.editor.undoStack.map((operation) => operation.pixelAction),
        ...AppState.editor.redoStack.map((operation) => operation.pixelAction)
    ]);
    actions.forEach((action) => {
        if (!action) return;
        if (Array.isArray(action.indices)) action.indices = action.indices.map(mirrorIndex);
        else if (Number.isInteger(action.index)) action.index = mirrorIndex(action.index);
    });
}

export function applyGlobalEditorOperation(operation) {
    if (!operation || typeof operation.apply !== 'function' || typeof operation.revert !== 'function') return false;
    operation.apply();
    AppState.editor.undoStack.push(operation);
    AppState.editor.redoStack = [];
    AppState.editor.hasChanges = true;
    return true;
}

export function undoGlobalEditorOperation() {
    const operation = AppState.editor.undoStack.pop();
    if (!operation) return false;
    operation.revert();
    AppState.editor.redoStack.push(operation);
    AppState.editor.hasChanges = AppState.editor.undoStack.length > 0;
    return true;
}

export function redoGlobalEditorOperation() {
    const operation = AppState.editor.redoStack.pop();
    if (!operation) return false;
    operation.apply();
    AppState.editor.undoStack.push(operation);
    AppState.editor.hasChanges = true;
    return true;
}

export function resetGlobalEditorSession() {
    AppState.editor.undoStack = [];
    AppState.editor.redoStack = [];
    AppState.editor.originalPixelData = null;
    AppState.editor.hasChanges = false;
    AppState.editor.activeTool = 'brush';
}

export function updateAdjustUndoButton() {
    const undoBtn = document.getElementById('workbench-top-undo-btn');
    const redoBtn = document.getElementById('workbench-top-redo-btn');
    if (undoBtn) {
        undoBtn.disabled = AppState.editor.undoStack.length === 0;
        undoBtn.classList.toggle('is-disabled', undoBtn.disabled);
    }
    if (redoBtn) {
        redoBtn.disabled = AppState.editor.redoStack.length === 0;
        redoBtn.classList.toggle('is-disabled', redoBtn.disabled);
    }
}

export function resetBatchReplaceState() {
    AppState.batchReplace.origin = null;
    AppState.batchReplace.active = false;
    AppState.batchReplace.mode = null;
    AppState.batchReplace.sourceColorId = null;
    AppState.batchReplace.nearCandidates = [];
    AppState.batchReplace.nearBaseline = null;
    AppState.batchReplace.nearCurrentId = null;
}

export function redmeanDistance(r1, g1, b1, r2, g2, b2) {
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
    if (!target || String(sourceId) === String(target.id)) return;
    const indices = [];
    const prevColors = [];
    for (let i = 0; i < AppState.stagedPixelData.length; i++) {
        const c = AppState.stagedPixelData[i];
        if (c && c.id === sourceId) {
            indices.push(i);
            prevColors.push({ ...c });
            AppState.stagedPixelData[i] = { ...target };
        }
    }
    if (indices.length > 0) {
        recordPixelAction({ indices, prevColors, nextColor: { ...target } });
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
