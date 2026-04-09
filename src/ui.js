/**
 * ????????- UI ????
 */
import { AppState } from './state.js';
import { getFilteredMardPalette, removeBackground, cleanTinyFragments, generatePatternData } from './processor.js';
import { renderResult, updateResultTransform, getResetZoomState } from './renderer.js';
import { PALETTES } from './constants.js';
import { toggleDeleteMode as _toggleDeleteMode, handleDeleteClick } from './features/delete.js';
import { resetZoom as _resetZoom } from './features/zoom.js';
export { _toggleDeleteMode as toggleDeleteMode, _resetZoom as resetZoom };

export function deepClonePixels(arr) {
    return arr ? arr.map(p => ({ id: p.id, r: p.r, g: p.g, b: p.b, a: p.a })) : null;
}

function redmeanDistance(r1, g1, b1, r2, g2, b2) {
    const rMean = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return (2 + rMean / 256) * (dr * dr) + 4 * (dg * dg) + (2 + (255 - rMean) / 256) * (db * db);
}

function getCurrentPalette() {
    if (AppState.brand === 'mard') return getFilteredMardPalette(AppState.mardSet);
    return PALETTES[AppState.brand] || PALETTES.perler;
}

function performBatchReplace(sourceId, target) {
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
    const undoBtn = document.getElementById('adjust-undo-btn');
    if (undoBtn) {
        if (AppState.stagedActions.length > 0) undoBtn.classList.remove('opacity-50','pointer-events-none');
        else undoBtn.classList.add('opacity-50','pointer-events-none');
    }
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
        boardSizeDisplay.innerText = '52板';
        boardSizeDisplay.className = 'text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-blue-100 text-blue-600';
    } else {
        boardSizeDisplay.innerText = '104板';
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
        btn.querySelector('span').innerText = '退出移除';
    } else {
        tip.classList.replace('flex', 'hidden');
        tolerancePanel.classList.replace('flex', 'hidden');
        cleanBtn.classList.add('hidden');
        btn.classList.replace('bg-primary', 'bg-white');
        btn.classList.remove('text-white');
        btn.querySelector('span').innerText = '点击图片移除背景';
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
    
    document.getElementById('total-beads-count').innerText = `共${total} 颗`;
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
    document.getElementById('export-meta').innerText = `${AppState.gridWidth}x${AppState.gridHeight} • ${AppState.brand.toUpperCase()}`;
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

export function findAndSelectEdgeBeads() {
    AppState.selectedEdgeBeadsIndices = [];
    if (!AppState.pixelData || AppState.pixelData.length === 0) {
        console.warn("pixelData is empty, cannot find edges.");
        return;
    }

    const gridWidth = AppState.gridWidth;
    const gridHeight = AppState.gridHeight;
    const pixelData = AppState.pixelData;

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const currentIndex = y * gridWidth + x;
            const currentPixel = pixelData[currentIndex];

            if (currentPixel && currentPixel.id !== 'NONE') {
                let isEdge = false;

                // Check 4 neighbors: top, bottom, left, right
                const neighbors = [
                    { nx: x, ny: y - 1 }, // Top
                    { nx: x, ny: y + 1 }, // Bottom
                    { nx: x - 1, ny: y }, // Left
                    { nx: x + 1, ny: y }  // Right
                ];

                for (const neighbor of neighbors) {
                    const { nx, ny } = neighbor;

                    // Check if neighbor is out of bounds
                    if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) {
                        isEdge = true;
                        break;
                    }

                    // Check if neighbor is 'NONE'
                    const neighborIndex = ny * gridWidth + nx;
                    const neighborPixel = pixelData[neighborIndex];
                    if (!neighborPixel || neighborPixel.id === 'NONE') {
                        isEdge = true;
                        break;
                    }
                }

                if (isEdge) {
                    AppState.selectedEdgeBeadsIndices.push(currentIndex);
                }
            }
        }
    }
    console.log(`Found ${AppState.selectedEdgeBeadsIndices.length} edge beads.`);
    // After finding edges, we should re-render to highlight them
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.stagedPixelData || AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
}

export function toggleEdgeAdjustMode() {
    const resultCanvas = document.getElementById('result-canvas');
    const btn = document.getElementById('toggle-edge-adjust-btn');
    const adjustBtn = document.getElementById('toggle-adjust-btn');
    const deleteBtn = document.getElementById('toggle-delete-btn'); // ??????
    const entering = !AppState.edgeSelectionMode;

    if (entering) {
        // ?????????????????????
        if (AppState.editMode !== 'adjust') {
            toggleAdjustMode();
        }
        AppState.edgeSelectionMode = true;
        AppState.deleteMode = false; // ????????
        btn && btn.classList.add('bg-primary','text-white');
        adjustBtn && adjustBtn.classList.remove('bg-primary','text-white'); // ???????????
        deleteBtn && deleteBtn.classList.remove('bg-primary','text-white'); // ?????????
        findAndSelectEdgeBeads(); // ?????????
        // ??????????
    } else {
        AppState.edgeSelectionMode = false;
        AppState.selectedEdgeBeadsIndices = []; // ????
        btn && btn.classList.remove('bg-primary','text-white');
        // ???????????????????????
        if (AppState.editMode === 'adjust') {
            toggleAdjustMode(); // ???? stagedPixelData ??????
        } else {
            // ?????????????????????????????????
            renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
        }
    }
}

export function toggleAdjustMode() {
    const resultCanvas = document.getElementById('result-canvas');
    const undoBtn = document.getElementById('adjust-undo-btn');
    const cancelBtn = document.getElementById('adjust-cancel-btn');
    const applyBtn = document.getElementById('adjust-apply-btn');
    const btn = document.getElementById('toggle-adjust-btn');
    const edgeBtn = document.getElementById('toggle-edge-adjust-btn'); // ????????
    const deleteBtn = document.getElementById('toggle-delete-btn'); // ??????
    const entering = AppState.editMode !== 'adjust';
    if (entering) {
        AppState.editMode = 'adjust';
        AppState.adjustPhase = 'waiting_receiver';
        AppState.receiverIndex = null;
        AppState.stagedPixelData = deepClonePixels(AppState.pixelData);
        AppState.stagedActions = [];
        AppState.selectedEdgeBeadsIndices = []; // ?????????????????
        AppState.edgeSelectionMode = false; // ???????????????????
        AppState.deleteMode = false; // ?????????????????
        AppState.preAdjustZoomState = { ...AppState.zoomState };
        btn && btn.classList.add('bg-primary','text-white');
        edgeBtn && edgeBtn.classList.remove('bg-primary','text-white'); // ???????????
        deleteBtn && deleteBtn.classList.remove('bg-primary','text-white'); // ?????????
        undoBtn && undoBtn.classList.remove('hidden');
        cancelBtn && cancelBtn.classList.remove('hidden');
        applyBtn && applyBtn.classList.remove('hidden');
        if (resultCanvas) {
            resultCanvas.classList.remove('cursor-grab','cursor-grabbing');
            resultCanvas.classList.add('cursor-crosshair');
        }
        renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
        // ???????? calculateStats()??????????????????????
    } else {
        AppState.editMode = 'none';
        AppState.adjustPhase = 'waiting_receiver';
        AppState.receiverIndex = null;
        AppState.stagedPixelData = null;
        AppState.stagedActions = [];
        AppState.selectedEdgeBeadsIndices = []; // ?????????????
        AppState.edgeSelectionMode = false; // ???????????????
        AppState.deleteMode = false; // ?????????????
        btn && btn.classList.remove('bg-primary','text-white');
        edgeBtn && edgeBtn.classList.remove('bg-primary','text-white');
        deleteBtn && deleteBtn.classList.remove('bg-primary','text-white');
        undoBtn && undoBtn.classList.add('hidden');
        cancelBtn && cancelBtn.classList.add('hidden');
        applyBtn && applyBtn.classList.add('hidden');
        if (resultCanvas) {
            resultCanvas.classList.remove('cursor-crosshair');
            resultCanvas.classList.add('cursor-grab');
            renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
            calculateStats();
        }
        if (AppState.preAdjustZoomState) {
            AppState.zoomState = { ...AppState.preAdjustZoomState };
            updateResultTransform(resultCanvas, AppState.zoomState, document.getElementById('zoom-reset-btn'));
        }
    }
}

function drawReceiverOutline(canvas, gx, gy) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scale = 30;
    const gridOffset = scale;
    const minX = AppState.renderedMinX || 0;
    const minY = AppState.renderedMinY || 0;
    const drawX = gridOffset + (gx - minX) * scale;
    const drawY = gridOffset + (gy - minY) * scale;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 127, 80, 0.9)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(drawX + 1, drawY + 1, scale - 2, scale - 2);
    ctx.restore();
}

export function handleResultCanvasClickForAdjust(e) {
    console.log('handleResultCanvasClickForAdjust called');
    console.log('AppState.editMode:', AppState.editMode);
    if (AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') {
        console.log('Not in adjust or delete mode, returning.');
        return;
    }
    const canvas = document.getElementById('result-canvas');
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const canvasX = localX / AppState.zoomState.scale;
    const canvasY = localY / AppState.zoomState.scale;
    console.log(`localX: ${localX}, localY: ${localY}`);
    console.log(`canvasX: ${canvasX}, canvasY: ${canvasY}`);
    console.log(`zoomState.x: ${AppState.zoomState.x}, zoomState.y: ${AppState.zoomState.y}, zoomState.scale: ${AppState.zoomState.scale}`);
    // ?? renderer ??????????????
    const scale = 30;
    const gridOffset = scale; // ????
    const minX = AppState.renderedMinX || 0;
    const minY = AppState.renderedMinY || 0;
    const contentWidth = AppState.renderedContentWidth || AppState.gridWidth;
    const contentHeight = AppState.renderedContentHeight || AppState.gridHeight;

    const xOnRenderedGrid = Math.floor((canvasX - gridOffset) / scale);
    const yOnRenderedGrid = Math.floor((canvasY - gridOffset) / scale);

    // ???????????? gridWidth/gridHeight ??
    const gx = minX + xOnRenderedGrid;
    const gy = minY + yOnRenderedGrid;

    console.log(`xOnRenderedGrid: ${xOnRenderedGrid}, yOnRenderedGrid: ${yOnRenderedGrid}`);
    console.log(`gx: ${gx}, gy: ${gy}`);

    if (xOnRenderedGrid < 0 || yOnRenderedGrid < 0 || xOnRenderedGrid >= contentWidth || yOnRenderedGrid >= contentHeight) {
        console.log('Click outside rendered content bounds, returning.');
        return;
    }
    if (gx < 0 || gy < 0 || gx >= AppState.gridWidth || gy >= AppState.gridHeight) {
        console.log('Calculated gx/gy outside original grid bounds, returning.');
        return;
    }
    const idx = gy * AppState.gridWidth + gx;
    console.log('Calculated idx:', idx);
    console.log('AppState.adjustPhase:', AppState.adjustPhase);

    // ??????????????
    // ??????????? features/delete.js
    if (AppState.deleteMode) {
        handleDeleteClick(idx, canvas);
        return;
    }
    if (AppState.edgeSelectionMode) {
        const donor = AppState.stagedPixelData[idx];
        console.log('Edge adjust mode: Clicked donor pixel:', donor);
        if (!donor || donor.id === 'NONE') {
            console.log('Donor pixel is NONE or null, returning.');
            return;
        }

        const newColor = { id: donor.id, r: donor.r, g: donor.g, b: donor.b };
        const indicesToChange = AppState.selectedEdgeBeadsIndices;
        const prevColors = [];

        if (indicesToChange.length > 0) {
            // ???????????
            for (const edgeIdx of indicesToChange) {
                const prev = AppState.stagedPixelData[edgeIdx];
                if (prev.id !== newColor.id) {
                    prevColors.push({ index: edgeIdx, prevColor: { ...prev } });
                    AppState.stagedPixelData[edgeIdx] = { ...newColor };
                }
            }
            if (prevColors.length > 0) {
                AppState.stagedActions.push({ indices: prevColors.map(p => p.index), prevColors: prevColors.map(p => p.prevColor), nextColor: newColor });
                console.log(`Batch replaced ${prevColors.length} edge pixels to ${newColor.id}`);
            } else {
                console.log('No edge pixels changed color.');
            }
        } else {
            console.log('No edge beads selected for batch replacement.');
        }

        renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
        calculateStats();
        const undoBtn = document.getElementById('adjust-undo-btn');
        if (undoBtn) {
            if (AppState.stagedActions.length > 0) undoBtn.classList.remove('opacity-50','pointer-events-none');
            else undoBtn.classList.add('opacity-50','pointer-events-none');
        }
        return;
    }

    // ????????????????????
    if (AppState.editMode === 'adjust' && AppState.batchReplace.active && AppState.batchReplace.mode === 'from_canvas') {
        const donor = AppState.stagedPixelData[idx];
        if (!donor || donor.id === 'NONE') {
            console.log('Clicked NONE pixel, cannot use as replacement source.');
            return;
        }
        const palette = getCurrentPalette();
        const target = palette.find(p => p.id === donor.id) || donor;
        performBatchReplace(AppState.batchReplace.sourceColorId, target);
        AppState.batchReplace.active = false;
        AppState.batchReplace.mode = null;
        AppState.batchReplace.sourceColorId = null;
        return;
    }

    // ?????????????????????
    if (AppState.editMode === 'adjust' && !AppState.batchReplace.active) {
        if (AppState.adjustPhase === 'waiting_receiver') {
            const pixel = AppState.stagedPixelData[idx];
            if (!pixel || pixel.id === 'NONE') return;
            AppState.receiverIndex = idx;
            AppState.adjustPhase = 'waiting_donor';
            // ?�????????????????????
            renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
            drawReceiverOutline(canvas, gx, gy);
            console.log('Receiver selected at idx: ' + idx + ' color: ' + pixel.id);
            return;
        }
        if (AppState.adjustPhase === 'waiting_donor') {
            const donor = AppState.stagedPixelData[idx];
            if (!donor || donor.id === 'NONE') {
                // ?????????????????�??
                AppState.adjustPhase = 'waiting_receiver';
                AppState.receiverIndex = null;
                renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
                return;
            }
            const receiverPixel = AppState.stagedPixelData[AppState.receiverIndex];
            if (!receiverPixel) {
                AppState.adjustPhase = 'waiting_receiver';
                return;
            }
            const prevColor = { id: receiverPixel.id, r: receiverPixel.r, g: receiverPixel.g, b: receiverPixel.b };
            const newColor = { id: donor.id, r: donor.r, g: donor.g, b: donor.b };
            AppState.stagedActions.push({ index: AppState.receiverIndex, prevColor, nextColor: newColor });
            AppState.stagedPixelData[AppState.receiverIndex] = { ...newColor };
            const undoBtn = document.getElementById('adjust-undo-btn');
            if (undoBtn) undoBtn.classList.remove('opacity-50', 'pointer-events-none');
            AppState.adjustPhase = 'waiting_receiver';
            AppState.receiverIndex = null;
            renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
            calculateStats();
            console.log('Single pixel replaced with: ' + donor.id);
            return;
        }
    }
}
export function adjustUndo() {
    if ((AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') || !AppState.stagedActions.length) return;
    const action = AppState.stagedActions.pop();
    if (Array.isArray(action.indices)) {
        for (let i = 0; i < action.indices.length; i++) {
            const at = action.indices[i];
            AppState.stagedPixelData[at] = { ...action.prevColors[i] };
        }
    } else {
        AppState.stagedPixelData[action.index] = { ...action.prevColor };
    }
    const canvas = document.getElementById('result-canvas');
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    calculateStats();
    const undoBtn = document.getElementById('adjust-undo-btn');
    if (undoBtn) {
        if (AppState.stagedActions.length > 0) undoBtn.classList.remove('opacity-50','pointer-events-none');
        else undoBtn.classList.add('opacity-50','pointer-events-none');
    }
}

export function adjustCancel() {
    if (AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') return;
    const canvas = document.getElementById('result-canvas');
    AppState.stagedPixelData = null;
    AppState.stagedActions = [];
    AppState.receiverIndex = null;
    AppState.adjustPhase = 'waiting_receiver';
    AppState.editMode = 'none';
    renderResult(canvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
    const btn = document.getElementById('toggle-adjust-btn');
    const undoBtn = document.getElementById('adjust-undo-btn');
    const cancelBtn = document.getElementById('adjust-cancel-btn');
    const applyBtn = document.getElementById('adjust-apply-btn');
    btn && btn.classList.remove('bg-primary','text-white');
    const extraDeleteBtn = document.getElementById('toggle-delete-btn');
    const extraEdgeBtn = document.getElementById('toggle-edge-adjust-btn');
    extraDeleteBtn && extraDeleteBtn.classList.remove('bg-primary','text-white');
    extraEdgeBtn && extraEdgeBtn.classList.remove('bg-primary','text-white');
    AppState.deleteMode = false;
    AppState.edgeSelectionMode = false;
    undoBtn && undoBtn.classList.add('hidden');
    cancelBtn && cancelBtn.classList.add('hidden');
    applyBtn && applyBtn.classList.add('hidden');
    if (AppState.preAdjustZoomState) {
        AppState.zoomState = { ...AppState.preAdjustZoomState };
        updateResultTransform(canvas, AppState.zoomState, document.getElementById('zoom-reset-btn'));
    }
}

export function adjustApply() {
    if (AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') return;
    const canvas = document.getElementById('result-canvas');
    if (AppState.stagedPixelData) {
        AppState.pixelData = deepClonePixels(AppState.stagedPixelData);
    }
    AppState.stagedPixelData = null;
    AppState.stagedActions = [];
    AppState.receiverIndex = null;
    AppState.adjustPhase = 'waiting_receiver';
    AppState.editMode = 'none';
    renderResult(canvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
    const btn = document.getElementById('toggle-adjust-btn');
    const undoBtn = document.getElementById('adjust-undo-btn');
    const cancelBtn = document.getElementById('adjust-cancel-btn');
    const applyBtn = document.getElementById('adjust-apply-btn');
    btn && btn.classList.remove('bg-primary','text-white');
    const extraDeleteBtn = document.getElementById('toggle-delete-btn');
    const extraEdgeBtn = document.getElementById('toggle-edge-adjust-btn');
    extraDeleteBtn && extraDeleteBtn.classList.remove('bg-primary','text-white');
    extraEdgeBtn && extraEdgeBtn.classList.remove('bg-primary','text-white');
    AppState.deleteMode = false;
    AppState.edgeSelectionMode = false;
    undoBtn && undoBtn.classList.add('hidden');
    cancelBtn && cancelBtn.classList.add('hidden');
    applyBtn && applyBtn.classList.add('hidden');
    if (AppState.preAdjustZoomState) {
        AppState.zoomState = { ...AppState.preAdjustZoomState };
        updateResultTransform(canvas, AppState.zoomState, document.getElementById('zoom-reset-btn'));
    }
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
