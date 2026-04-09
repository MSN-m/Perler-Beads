/**
 * ????????- UI ????
 */
import { AppState } from './state.js';
import { getFilteredMardPalette, removeBackground, cleanTinyFragments, generatePatternData } from './processor.js';
import { renderResult, updateResultTransform, getResetZoomState } from './renderer.js';
import { PALETTES } from './constants.js';
import { toggleDeleteMode as _toggleDeleteMode, handleDeleteClick } from './features/delete.js';
import { resetZoom as _resetZoom } from './features/zoom.js';
import { toggleEdgeAdjustMode as _toggleEdgeAdjustMode } from './features/edge.js';
import {
    toggleAdjustMode as _toggleAdjustMode,
    handleResultCanvasClickForAdjust as _handleResultCanvasClickForAdjust,
    adjustUndo as _adjustUndo,
    adjustCancel as _adjustCancel,
    adjustApply as _adjustApply
} from './features/adjust.js';
export {
    _toggleDeleteMode as toggleDeleteMode,
    _resetZoom as resetZoom,
    _toggleEdgeAdjustMode as toggleEdgeAdjustMode,
    _toggleAdjustMode as toggleAdjustMode,
    _handleResultCanvasClickForAdjust as handleResultCanvasClickForAdjust,
    _adjustUndo as adjustUndo,
    _adjustCancel as adjustCancel,
    _adjustApply as adjustApply
};

export function deepClonePixels(arr) {
    return arr ? arr.map(p => ({ id: p.id, r: p.r, g: p.g, b: p.b, a: p.a })) : null;
}

export function updateAdjustUndoButton() {
    const undoBtn = document.getElementById('adjust-undo-btn');
    if (!undoBtn) return;
    if (AppState.stagedActions.length > 0) undoBtn.classList.remove('opacity-50','pointer-events-none');
    else undoBtn.classList.add('opacity-50','pointer-events-none');
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

/**
 * ????
 * @param {number} step - ???? (1-4)
 */
export function goToStep(step) {
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    const stepNames = ['home', 'settings', 'editor', 'export'];
    document.querySelector(`#step-${stepNames[step - 1]}`).classList.add('active');
    AppState.currentStep = step;

    // ????????
    if (step === 2) initSettingsView();
    if (step === 3) initEditorView();
    if (step === 4) initExportView();
}

/**
 * ????????(Step 2)
 */
function initSettingsView() {
    if (!AppState.image) return;
    
    const sourceCanvas = document.getElementById('source-canvas');
    const ctxSource = sourceCanvas.getContext('2d');
    const container = document.getElementById('canvas-container');
    const img = AppState.image;

    // ??????
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.65;
    const imgRatio = img.width / img.height;
    const containerRatio = maxWidth / maxHeight;
    
    let finalWidth, finalHeight;
    if (imgRatio > containerRatio) {
        finalWidth = maxWidth;
        finalHeight = maxWidth / imgRatio;
    } else {
        finalHeight = maxHeight;
        finalWidth = maxHeight * imgRatio;
    }

    container.style.width = `${finalWidth}px`;
    container.style.height = `${finalHeight}px`;
    sourceCanvas.width = img.width;
    sourceCanvas.height = img.height;
    ctxSource.drawImage(img, 0, 0);

    // ??????
    AppState.originalImageData = ctxSource.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    AppState.history = [ctxSource.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)];
    updateUndoButton();
    
    updateGridDimensions();
}

/**
 * ??????
 */
export function updateGridDimensions() {
    const slider = document.getElementById('grid-size-slider');
    const sizeDisplay = document.getElementById('grid-size-display');
    const val = parseInt(slider.value);
    const ratio = AppState.image ? AppState.image.width / AppState.image.height : 1;
    
    if (ratio >= 1) {
        AppState.gridWidth = val;
        AppState.gridHeight = Math.round(val / ratio);
    } else {
        AppState.gridHeight = val;
        AppState.gridWidth = Math.round(val * ratio);
    }
    
    sizeDisplay.innerText = `${AppState.gridWidth}x${AppState.gridHeight}`;
    updateBoardSizeUI();
}

/**
 * ????????UI
 */
function updateBoardSizeUI() {
    const boardSizeDisplay = document.getElementById('board-size-display');
    const maxDim = Math.max(AppState.gridWidth, AppState.gridHeight);
    if (maxDim <= 52) {
        boardSizeDisplay.innerText = '52鏉?;
        boardSizeDisplay.className = 'text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-blue-100 text-blue-600';
    } else {
        boardSizeDisplay.innerText = '104鏉?;
        boardSizeDisplay.className = 'text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-purple-100 text-purple-600';
    }
}

/**
 * ?????????
 */
export function updateUndoButton() {
    const btn = document.getElementById('undo-bg-btn');
    if (AppState.history.length > 1) {
        btn.disabled = false;
        btn.classList.remove('text-gray-400');
        btn.classList.add('text-gray-700');
    } else {
        btn.disabled = true;
        btn.classList.add('text-gray-400');
        btn.classList.remove('text-gray-700');
    }
}

/**
 * ??????
 */
export function undoBgRemoval() {
    if (AppState.history.length > 1) {
        AppState.history.pop();
        const lastData = AppState.history[AppState.history.length - 1];
        const sourceCanvas = document.getElementById('source-canvas');
        sourceCanvas.getContext('2d').putImageData(lastData, 0, 0);
        updateUndoButton();
    }
}

/**
 * ????????
 */
export function toggleBgRemovalMode() {
    AppState.isBgRemoving = !AppState.isBgRemoving;
    const tip = document.getElementById('bg-remove-tip');
    const btn = document.getElementById('remove-bg-btn');
    const tolerancePanel = document.getElementById('tolerance-panel');
    const cleanBtn = document.getElementById('clean-fragments-btn');
    
    if (AppState.isBgRemoving) {
        tip.classList.replace('hidden', 'flex');
        tolerancePanel.classList.replace('hidden', 'flex');
        cleanBtn.classList.remove('hidden');
        btn.classList.add('bg-primary', 'text-white');
        btn.classList.remove('bg-white');
        btn.querySelector('span').innerText = '閫€鍑虹Щ闄?;
    } else {
        tip.classList.replace('flex', 'hidden');
        tolerancePanel.classList.replace('flex', 'hidden');
        cleanBtn.classList.add('hidden');
        btn.classList.replace('bg-primary', 'bg-white');
        btn.classList.remove('text-white');
        btn.querySelector('span').innerText = '鐐瑰嚮鍥剧墖绉婚櫎鑳屾櫙';
    }
}

/**
 * ?? Canvas ????????
 */
export function handleCanvasClick(e) {
    if (!AppState.isBgRemoving) return;

    const sourceCanvas = document.getElementById('source-canvas');
    const rect = sourceCanvas.getBoundingClientRect();
    let x, y;
    
    if (e.touches) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }

    // ??????????
    const scaleX = sourceCanvas.width / rect.width;
    const scaleY = sourceCanvas.height / rect.height;
    const startX = Math.floor(x * scaleX);
    const startY = Math.floor(y * scaleY);

    const ctx = sourceCanvas.getContext('2d');
    const tolerance = parseInt(document.getElementById('tolerance-slider').value);
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    
    const resultData = removeBackground(imageData, startX, startY, tolerance);
    ctx.putImageData(resultData, 0, 0);

    AppState.history.push(ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height));
    if (AppState.history.length > 10) AppState.history.shift();
    updateUndoButton();
    toggleBgRemovalMode(); // ?????
}

/**
 * ??????
 */
export function handleCleanFragments() {
    const sourceCanvas = document.getElementById('source-canvas');
    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const resultData = cleanTinyFragments(imageData);
    ctx.putImageData(resultData, 0, 0);
    
    AppState.history.push(ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height));
    if (AppState.history.length > 10) AppState.history.shift();
    updateUndoButton();
}

/**
 * ????????
 */
export function handleGeneratePattern() {
    const sourceCanvas = document.getElementById('source-canvas');
    const ctx = sourceCanvas.getContext('2d');
    const sourceImageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

    // ???????
    AppState.highlightedColorId = null;

    AppState.pixelData = generatePatternData({
        sourceImageData,
        gridWidth: AppState.gridWidth,
        gridHeight: AppState.gridHeight,
        brand: AppState.brand,
        mardSet: AppState.mardSet,
        isColorLimitEnabled: document.getElementById('color-limit-toggle').checked,
        maxColors: parseInt(document.getElementById('max-colors-slider').value),
        isDitheringEnabled: document.getElementById('dithering-toggle').checked,
        palettes: PALETTES
    });

    goToStep(3);
}

/**
 * ???????? (Step 3)
 */
function initEditorView() {
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
    
    // ?? requestAnimationFrame ???????????? Flexbox ????????????
    requestAnimationFrame(() => {
        const resultContainer = document.getElementById('result-container');
        const zoomState = getResetZoomState(resultContainer, resultCanvas);
        AppState.zoomState = zoomState; // ??????
        updateResultTransform(resultCanvas, zoomState, document.getElementById('zoom-reset-btn'));
    });
}

/**
 * ??????
 */
export function calculateStats() {
    const stats = {};
    let total = 0;
    // ????????????????????????????
    const dataToCount = (AppState.stagedPixelData && (AppState.editMode === 'adjust' || AppState.editMode === 'delete'))
        ? AppState.stagedPixelData
        : AppState.pixelData;
    dataToCount.forEach(p => {
        if (p.id === 'NONE') return;
        if (!stats[p.id]) stats[p.id] = { ...p, count: 0 };
        stats[p.id].count++;
        total++;
    });

    const sorted = Object.values(stats).sort((a, b) => b.count - a.count);
    
    document.getElementById('total-beads-count').innerText = `鍏?{total} 棰梎;
    document.getElementById('color-types-count').innerText = `${sorted.length} 鑹瞏;

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
                <button id="color-menu-btn-${c.id}" aria-label="棰滆壊鎿嶄綔鑿滃崟" class="flex items-center justify-center w-7 h-7 rounded-md shrink-0 ring-1 ring-white/40 bg-black/20 hover:bg-black/30 ${iconColor}" style="min-width:28px; min-height:28px; display:flex; align-items:center; justify-content:center; border-radius:6px; background: rgba(0,0,0,0.2); color:#fff;">
                    <svg class="w-3.5 h-3.5 ${iconColor}" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <circle cx="4" cy="10" r="2"></circle>
                        <circle cx="10" cy="10" r="2"></circle>
                        <circle cx="16" cy="10" r="2"></circle>
                    </svg>
                </button>
                <div id="color-menu-${c.id}" class="absolute right-0 top-full mt-1 bg-white text-gray-800 rounded-lg shadow-lg border border-gray-100 hidden z-50" style="z-index: 9999;">
                    <button id="menu-from-canvas-${c.id}" class="block text-left px-3 py-2 hover:bg-gray-50 w-40">浠庡浘绾哥偣鍑绘浛鎹?/button>
                    <button id="menu-nearby-${c.id}" class="block text-left px-3 py-2 hover:bg-gray-50 w-40">鏇挎崲涓虹浉杩戣壊</button>
                    <div id="nearby-panel-${c.id}" class="hidden px-3 py-2 border-t border-gray-100">
                        <div class="flex space-x-2 mb-2" id="nearby-swatches-${c.id}"></div>
                        <div class="flex justify-end space-x-2">
                            <button id="nearby-cancel-${c.id}" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm">鍙栨秷</button>
                            <button id="nearby-confirm-${c.id}" class="px-3 py-1 rounded bg-primary text-white text-sm">纭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // ????????????
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
                if (AppState.editMode !== 'adjust') toggleAdjustMode();
                AppState.batchReplace.active = true;
                AppState.batchReplace.mode = 'from_canvas';
                AppState.batchReplace.sourceColorId = c.id;
            });
        }
        if (nearbyBtn) {
            nearbyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // ????????????????
                if (AppState.editMode !== 'adjust') toggleAdjustMode();
                const fullPalette = getCurrentPalette();
                const palette = fullPalette.filter(x => x.id !== c.id);
                const paletteBase = fullPalette.find(x => x.id === c.id);
                const baseR = paletteBase ? paletteBase.r : c.r;
                const baseG = paletteBase ? paletteBase.g : c.g;
                const baseB = paletteBase ? paletteBase.b : c.b;
                const sortedP = palette
                    .map(p => ({ p, d: redmeanDistance(baseR, baseG, baseB, p.r, p.g, p.b) }))
                    .sort((a,b) => a.d - b.d)
                    .slice(0,3)
                    .map(x => x.p);
                AppState.batchReplace.active = true;
                AppState.batchReplace.mode = 'nearby';
                AppState.batchReplace.sourceColorId = c.id;
                AppState.batchReplace.nearCandidates = sortedP;
                AppState.batchReplace.nearBaseline = deepClonePixels(AppState.stagedPixelData);
                AppState.batchReplace.nearCurrentId = null;
                swatchesWrap.innerHTML = sortedP.map(col => `<button data-id="${col.id}" class="w-8 h-8 rounded border border-gray-200" style="background-color: rgb(${col.r},${col.g},${col.b})"></button>`).join('');
                nearbyPanel.classList.remove('hidden');
                // ???????????
                menu.classList.remove('hidden');
                item.classList.add('z-50');
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
                AppState.batchReplace.active = false;
                AppState.batchReplace.mode = null;
                AppState.batchReplace.sourceColorId = null;
                AppState.batchReplace.nearCandidates = [];
                AppState.batchReplace.nearBaseline = null;
                AppState.batchReplace.nearCurrentId = null;
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
                AppState.batchReplace.active = false;
                AppState.batchReplace.mode = null;
                AppState.batchReplace.sourceColorId = null;
                AppState.batchReplace.nearCandidates = [];
                AppState.batchReplace.nearBaseline = null;
                AppState.batchReplace.nearCurrentId = null;
                nearbyPanel.classList.add('hidden');
                menu.classList.add('hidden');
                item.classList.remove('z-50');
            });
        }
    });
    document.addEventListener('click', (e) => {
        if (container.contains(e.target)) return;
        document.querySelectorAll('[id^="color-menu-"]').forEach(el => {
            el.classList.add('hidden');
            if (el.parentElement) el.parentElement.classList.remove('z-50');
        });
    });
}

/**
 * ??????
 */
export function toggleColorHighlight(colorId) {
    if (AppState.highlightedColorId === colorId) {
        AppState.highlightedColorId = null;
    } else {
        AppState.highlightedColorId = colorId;
    }
    const resultCanvas = document.getElementById('result-canvas');
    // ??????????????????????????
    const dataToRender = (AppState.stagedPixelData && (AppState.editMode === 'adjust' || AppState.editMode === 'delete'))
        ? AppState.stagedPixelData
        : AppState.pixelData;
    renderResult(resultCanvas, dataToRender, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
}

/**
 * ????????(Step 4)
 */
function initExportView() {
    const resultCanvas = document.getElementById('result-canvas');
    const exportImg = document.getElementById('export-preview');
    exportImg.src = resultCanvas.toDataURL();
    document.getElementById('export-meta').innerText = `${AppState.gridWidth}x${AppState.gridHeight} 鈥?${AppState.brand.toUpperCase()}`;
}

/**
 * ??????
 */
export function updateTolerance(val) {
    document.getElementById('tolerance-value').innerText = val;
}

/**
 * ??????
 */
export function toggleColorLimit() {
    const isEnabled = document.getElementById('color-limit-toggle').checked;
    const controls = document.getElementById('color-limit-controls');
    if (isEnabled) {
        controls.classList.remove('opacity-40', 'pointer-events-none');
    } else {
        controls.classList.add('opacity-40', 'pointer-events-none');
    }
}

/**
 * ?????????
 */
export function updateMaxColorsDisplay() {
    const val = document.getElementById('max-colors-slider').value;
    document.getElementById('max-colors-display').innerText = val;
}

export function handleResultCanvasClickForEdit(e) {
    if (AppState.editMode !== 'eyedropper') return;
    const canvas = document.getElementById('result-canvas');
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const canvasX = localX / AppState.zoomState.scale;
    const canvasY = localY / AppState.zoomState.scale;
    const boardSize = Math.max(AppState.gridWidth, AppState.gridHeight) <= 52 ? 52 : 104;
    const scale = 30;
    const gridOffset = scale;
    const offsetX = Math.floor((boardSize - AppState.gridWidth) / 2);
    const offsetY = Math.floor((boardSize - AppState.gridHeight) / 2);
    const xOnBoard = Math.floor((canvasX - gridOffset) / scale);
    const yOnBoard = Math.floor((canvasY - gridOffset) / scale);
    if (xOnBoard < 0 || yOnBoard < 0 || xOnBoard >= boardSize || yOnBoard >= boardSize) return;
    const gx = xOnBoard - offsetX;
    const gy = yOnBoard - offsetY;
    if (gx < 0 || gy < 0 || gx >= AppState.gridWidth || gy >= AppState.gridHeight) return;
    const idx = gy * AppState.gridWidth + gx;
    const src = AppState.pixelData[idx];
    if (!src || src.id === 'NONE') return;
    AppState.sourceColorId = src.id;
    AppState.lastHitIndex = idx;
    if (!AppState.targetColorId || AppState.targetColorId === src.id) {
        const resultCanvas = document.getElementById('result-canvas');
        AppState.highlightedColorId = src.id;
        renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
        calculateStats();
        return;
    }
    let target = null;
    for (const p of AppState.pixelData) {
        if (p.id === AppState.targetColorId) {
            target = p;
            break;
        }
    }
    if (!target) return;
    AppState.pixelData[idx] = { id: target.id, r: target.r, g: target.g, b: target.b };
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
}
