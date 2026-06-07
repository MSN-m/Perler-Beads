/**
 * 拼豆图纸生成器 - UI 与页面流程
 */
import { AppState } from './state.js';
import { removeBackground, cleanTinyFragments, generatePatternData, generatePatternDataOriginal, generatePixelArtData, mapPixelArtToBeads } from './processor.js';
import { renderResult, updateResultTransform, getResetZoomState } from './renderer.js';
import { PALETTES } from './constants.js';
import { calculateStats, configureEditorActions, deepClonePixels, getCurrentPalette, resetBatchReplaceState, updateAdjustUndoButton } from './editor.js';
import { toggleDeleteMode as _toggleDeleteMode } from './features/delete.js';
import { resetZoom as _resetZoom } from './features/zoom.js';
import { toggleEdgeAdjustMode as _toggleEdgeAdjustMode } from './features/edge.js';
import {
    enterEditSession as _enterEditSession,
    toggleFillMode as _toggleFillMode,
    toggleClearBaseMode as _toggleClearBaseMode,
    selectPaletteFillColor as _selectPaletteFillColor,
    handleResultCanvasClickForAdjust as _handleResultCanvasClickForAdjust,
    setFillSourceMode as _setFillSourceMode,
    handleOriginalFillPick as _handleOriginalFillPick,
    startWorkbenchCompareDrag as _startWorkbenchCompareDrag,
    moveWorkbenchCompareDrag as _moveWorkbenchCompareDrag,
    endWorkbenchCompareDrag as _endWorkbenchCompareDrag,
    startFillSelection as _startFillSelection,
    moveFillSelection as _moveFillSelection,
    endFillSelection as _endFillSelection,
    adjustUndo as _adjustUndo,
    adjustCancel as _adjustCancel,
    adjustApply as _adjustApply
} from './features/adjust.js';
configureEditorActions({
    enterColorReplaceMode: _enterEditSession,
    updateWorkbenchUI
});

export {
    _toggleDeleteMode as toggleDeleteMode,
    _resetZoom as resetZoom,
    _toggleEdgeAdjustMode as toggleEdgeAdjustMode,
    _toggleFillMode as toggleFillMode,
    _toggleClearBaseMode as toggleClearBaseMode,
    _selectPaletteFillColor as selectPaletteFillColor,
    _handleResultCanvasClickForAdjust as handleResultCanvasClickForAdjust,
    _setFillSourceMode as setFillSourceMode,
    _handleOriginalFillPick as handleOriginalFillPick,
    _startWorkbenchCompareDrag as startWorkbenchCompareDrag,
    _moveWorkbenchCompareDrag as moveWorkbenchCompareDrag,
    _endWorkbenchCompareDrag as endWorkbenchCompareDrag,
    _startFillSelection as startFillSelection,
    _moveFillSelection as moveFillSelection,
    _endFillSelection as endFillSelection,
    _adjustUndo as adjustUndo,
    _adjustCancel as adjustCancel,
    _adjustApply as adjustApply
};

function isWorkbenchLayout() {
    return document.body.dataset.layout === 'workbench';
}

function setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden', hidden);
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
}

function getWorkbenchSettingsSummary() {
    const brandLabels = {
        mard: 'MARD',
        perler: 'Perler',
        hama: 'Hama',
        artkal: 'Artkal'
    };
    const brand = brandLabels[AppState.brand] || AppState.brand.toUpperCase();
    const setText = AppState.brand === 'mard' ? ` ${AppState.mardSet}色` : '';
    const colorLimitToggle = document.getElementById('color-limit-toggle');
    const maxColorsSlider = document.getElementById('max-colors-slider');
    const colorLimitText = colorLimitToggle && colorLimitToggle.checked
        ? `最多${maxColorsSlider ? maxColorsSlider.value : 24}色`
        : '不限颜色';
    return `${AppState.gridWidth}x${AppState.gridHeight} · ${brand}${setText} · ${colorLimitText}`;
}

function getPaletteTitle() {
    if (AppState.brand === 'mard') return `MARD ${AppState.mardSet} 色`;
    return (AppState.brand || 'perler').toUpperCase();
}

function getPaletteTextColor(color) {
    const yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
    return yiq >= 145 ? '#111827' : '#ffffff';
}

const WORKBENCH_DRAFTS_DB = 'perler_beads_workbench_drafts_db';
const WORKBENCH_DRAFTS_STORE = 'drafts';

function hasWorkbenchPattern() {
    return Array.isArray(AppState.pixelData) && AppState.pixelData.length > 0;
}

function renderPalettePanel() {
    if (!isWorkbenchLayout()) return;
    const panel = document.getElementById('palette-panel');
    const grid = document.getElementById('palette-color-grid');
    const summary = document.getElementById('palette-panel-summary');
    const searchInput = document.getElementById('palette-search-input');
    const toggleBtn = document.getElementById('toggle-palette-panel-btn');
    if (!panel || !grid || !summary) return;

    const hasPattern = hasWorkbenchPattern();
    const shouldShow = hasPattern && AppState.palettePanelOpen;
    panel.classList.toggle('hidden', !shouldShow);
    toggleBtn?.classList.toggle('bg-primary/10', shouldShow);
    toggleBtn?.classList.toggle('text-primary', shouldShow);
    if (!shouldShow) return;

    const query = (AppState.palettePanelQuery || '').trim().toLowerCase();
    const palette = getCurrentPalette();
    const filtered = query
        ? palette.filter((color) => String(color.id).toLowerCase().includes(query))
        : palette;

    summary.textContent = `${getPaletteTitle()} · ${filtered.length}/${palette.length} 色${AppState.fillColorId ? ` · 当前 ${AppState.fillColorId}` : ''}`;
    if (searchInput && searchInput.value !== AppState.palettePanelQuery) {
        searchInput.value = AppState.palettePanelQuery;
    }

    grid.innerHTML = filtered.map((color) => {
        const selected = AppState.fillMode && AppState.fillColorId === color.id;
        const textColor = getPaletteTextColor(color);
        return `
            <button type="button" data-palette-color-id="${color.id}"
                class="h-14 rounded-xl border ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200'} shadow-sm text-[11px] font-bold font-mono active:scale-95 transition"
                title="${color.id} · RGB(${color.r}, ${color.g}, ${color.b})"
                style="background-color: rgb(${color.r},${color.g},${color.b}); color: ${textColor};">
                ${color.id}
            </button>
        `;
    }).join('');
}

export function togglePalettePanel() {
    if (!hasWorkbenchPattern()) return;
    AppState.palettePanelOpen = !AppState.palettePanelOpen;
    renderPalettePanel();
}

export function closePalettePanel() {
    AppState.palettePanelOpen = false;
    renderPalettePanel();
}

export function updatePalettePanelQuery(value) {
    AppState.palettePanelQuery = value || '';
    renderPalettePanel();
}

export function handlePaletteColorSelect(colorId) {
    const color = getCurrentPalette().find((item) => item.id === colorId);
    if (!color) return;
    _selectPaletteFillColor(color);
    AppState.palettePanelOpen = true;
    renderPalettePanel();
    updateWorkbenchUI();
}

function getDraftTimestampLabel(timestamp) {
    try {
        return new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '刚刚';
    }
}

function buildDraftSummary(draft) {
    return `${draft.gridWidth}x${draft.gridHeight} · ${draft.brand.toUpperCase()} · ${draft.colorCount || 0} 色`;
}

function getCurrentDraftSourcePixels() {
    return AppState.stagedPixelData ? deepClonePixels(AppState.stagedPixelData) : deepClonePixels(AppState.pixelData);
}

function getCurrentSourceCanvasSnapshot() {
    const sourceCanvas = document.getElementById('source-canvas');
    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return null;
    try {
        return sourceCanvas.toDataURL('image/png');
    } catch {
        return null;
    }
}

function createDraftThumbnail(pixelData, gridWidth, gridHeight) {
    if (!pixelData || !gridWidth || !gridHeight) return null;
    const maxSize = 96;
    const cellSize = Math.max(1, Math.floor(maxSize / Math.max(gridWidth, gridHeight)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, gridWidth * cellSize);
    canvas.height = Math.max(1, gridHeight * cellSize);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const pixel = pixelData[y * gridWidth + x];
            if (!pixel || pixel.id === 'NONE') continue;
            ctx.fillStyle = `rgb(${pixel.r},${pixel.g},${pixel.b})`;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }

    try {
        return canvas.toDataURL('image/png');
    } catch {
        return null;
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function makeDraftFileName(name, suffix = 'draft') {
    const safeName = String(name || suffix)
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .slice(0, 48) || suffix;
    return `${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
}

function downloadJsonFile(payload, fileName) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
}

function isValidDraftPayload(draft) {
    return Boolean(
        draft &&
        Number.isFinite(Number(draft.gridWidth)) &&
        Number.isFinite(Number(draft.gridHeight)) &&
        Array.isArray(draft.pixelData) &&
        draft.pixelData.length === Number(draft.gridWidth) * Number(draft.gridHeight)
    );
}

function normalizeImportedDraft(draft, index = 0) {
    if (!isValidDraftPayload(draft)) return null;
    const gridWidth = Number(draft.gridWidth);
    const gridHeight = Number(draft.gridHeight);
    const pixelData = draft.pixelData.map((pixel) => ({
        id: pixel?.id || 'NONE',
        r: Number(pixel?.r) || 0,
        g: Number(pixel?.g) || 0,
        b: Number(pixel?.b) || 0,
        a: pixel?.a
    }));
    const colorIds = new Set(pixelData.filter((item) => item && item.id !== 'NONE').map((item) => item.id));
    const importedAt = Date.now();
    return {
        id: `draft_import_${importedAt}_${index}`,
        name: `${draft.name || '导入草稿'}（导入）`,
        updatedAt: new Date(importedAt + index).toISOString(),
        gridWidth,
        gridHeight,
        brand: draft.brand || 'mard',
        mardSet: draft.mardSet || 221,
        colorCount: draft.colorCount || colorIds.size,
        cropRect: draft.cropRect ? { ...draft.cropRect } : null,
        sourceImageDataUrl: draft.sourceImageDataUrl || null,
        thumbnailDataUrl: draft.thumbnailDataUrl || createDraftThumbnail(pixelData, gridWidth, gridHeight),
        pixelData
    };
}

function openDraftsDb() {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(WORKBENCH_DRAFTS_DB, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(WORKBENCH_DRAFTS_STORE)) {
                db.createObjectStore(WORKBENCH_DRAFTS_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadWorkbenchDrafts() {
    try {
        const db = await openDraftsDb();
        const drafts = await new Promise((resolve, reject) => {
            const tx = db.transaction(WORKBENCH_DRAFTS_STORE, 'readonly');
            const store = tx.objectStore(WORKBENCH_DRAFTS_STORE);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
        db.close();
        AppState.drafts = Array.isArray(drafts)
            ? drafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            : [];
    } catch (error) {
        console.warn('Failed to load drafts.', error);
        AppState.drafts = [];
    }
}

async function upsertWorkbenchDraft(draft) {
    const db = await openDraftsDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(WORKBENCH_DRAFTS_STORE, 'readwrite');
        const store = tx.objectStore(WORKBENCH_DRAFTS_STORE);
        const request = store.put(draft);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    db.close();
}

async function removeWorkbenchDraftFromDb(draftId) {
    const db = await openDraftsDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(WORKBENCH_DRAFTS_STORE, 'readwrite');
        const store = tx.objectStore(WORKBENCH_DRAFTS_STORE);
        const request = store.delete(draftId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    db.close();
}

function renderDraftBox() {
    if (!isWorkbenchLayout()) return;
    const empty = document.getElementById('draft-box-empty');
    const list = document.getElementById('draft-box-list');
    const saveBtn = document.getElementById('save-draft-btn');
    const drawer = document.getElementById('draft-drawer');
    const toggleBtn = document.getElementById('toggle-draft-drawer-btn');
    if (!empty || !list || !saveBtn || !drawer || !toggleBtn) return;

    const hasImage = Boolean(AppState.image);
    const hasPattern = hasWorkbenchPattern();
    saveBtn.disabled = !hasImage || !hasPattern;
    saveBtn.classList.toggle('opacity-40', !hasImage || !hasPattern);
    saveBtn.classList.toggle('cursor-not-allowed', !hasImage || !hasPattern);

    const drafts = Array.isArray(AppState.drafts) ? AppState.drafts : [];
    saveBtn.textContent = `保存为草稿（${drafts.length}）`;
    drawer.classList.toggle('hidden', !AppState.draftDrawerOpen);
    toggleBtn.textContent = AppState.draftDrawerOpen ? '↓' : '↑';
    toggleBtn.setAttribute('aria-label', AppState.draftDrawerOpen ? '收起草稿列表' : '展开草稿列表');
    empty.classList.toggle('hidden', drafts.length > 0);
    list.classList.toggle('hidden', drafts.length === 0);

    if (!drafts.length) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = drafts.map((draft) => {
        const thumbnail = draft.thumbnailDataUrl
            ? `<img src="${draft.thumbnailDataUrl}" alt="${escapeHtml(draft.name)}" class="w-full h-full object-contain image-pixelated">`
            : '<span class="text-[10px] text-gray-400">无预览</span>';
        return `
        <div class="rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <div class="flex items-start gap-3">
                <div class="w-16 h-16 shrink-0 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                    ${thumbnail}
                </div>
                <div class="min-w-0 flex-1">
                    <input data-draft-action="rename" data-draft-id="${draft.id}" value="${escapeHtml(draft.name)}"
                        class="w-full bg-transparent text-sm font-bold text-gray-800 truncate border border-transparent rounded-lg px-1 py-0.5 focus:bg-white focus:border-primary focus:outline-none">
                    <div class="text-xs text-gray-500 mt-1">${buildDraftSummary(draft)}</div>
                    <div class="text-[11px] text-gray-400 mt-1">${getDraftTimestampLabel(draft.updatedAt)}</div>
                    <div class="flex items-center gap-2 mt-2">
                        <button data-draft-action="restore" data-draft-id="${draft.id}" class="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary">恢复</button>
                        <button data-draft-action="delete" data-draft-id="${draft.id}" class="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-500 hover:border-red-300 hover:text-red-500">删除</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

function getNextDraftName() {
    const names = (AppState.drafts || []).map((draft) => draft.name || '');
    let maxIndex = 0;
    for (const name of names) {
        const match = /^草稿\s*(\d+)$/.exec(name.trim());
        if (match) {
            maxIndex = Math.max(maxIndex, Number(match[1]));
        }
    }
    return `草稿 ${maxIndex + 1}`;
}

export async function saveWorkbenchDraft() {
    if (!AppState.image || !hasWorkbenchPattern()) return;
    const pixels = getCurrentDraftSourcePixels();
    const colorIds = new Set(pixels.filter((item) => item && item.id !== 'NONE').map((item) => item.id));
    const draft = {
        id: `draft_${Date.now()}`,
        name: getNextDraftName(),
        updatedAt: new Date().toISOString(),
        gridWidth: AppState.gridWidth,
        gridHeight: AppState.gridHeight,
        brand: AppState.brand,
        mardSet: AppState.mardSet,
        colorCount: colorIds.size,
        cropRect: AppState.cropRect ? { ...AppState.cropRect } : null,
        sourceImageDataUrl: getCurrentSourceCanvasSnapshot(),
        thumbnailDataUrl: createDraftThumbnail(pixels, AppState.gridWidth, AppState.gridHeight),
        pixelData: pixels
    };
    await upsertWorkbenchDraft(draft);
    AppState.drafts = [draft, ...(AppState.drafts || [])].slice(0, 12);
    renderDraftBox();
}

export function exportWorkbenchDrafts() {
    const drafts = Array.isArray(AppState.drafts) ? AppState.drafts : [];
    if (!drafts.length) return;
    downloadJsonFile({
        type: 'perler-beads-workbench-drafts',
        version: 1,
        exportedAt: new Date().toISOString(),
        drafts
    }, makeDraftFileName('perler-beads-drafts', 'drafts'));
}

export async function importWorkbenchDraftFile(file) {
    if (!file) return;
    let payload;
    try {
        payload = JSON.parse(await file.text());
    } catch (error) {
        window.alert('导入失败：草稿文件不是有效的 JSON。');
        return;
    }

    const rawDrafts = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.drafts)
            ? payload.drafts
            : payload?.pixelData
                ? [payload]
                : [];
    const importedDrafts = rawDrafts
        .map((draft, index) => normalizeImportedDraft(draft, index))
        .filter(Boolean);

    if (!importedDrafts.length) {
        window.alert('导入失败：没有找到可用的草稿数据。');
        return;
    }

    for (const draft of importedDrafts) {
        await upsertWorkbenchDraft(draft);
    }
    AppState.drafts = [...importedDrafts, ...(AppState.drafts || [])]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    AppState.draftDrawerOpen = true;
    renderDraftBox();
    updateWorkbenchUI();
    window.alert(`已导入 ${importedDrafts.length} 个草稿。`);
}

export function restoreWorkbenchDraft(draftId) {
    const draft = (AppState.drafts || []).find((item) => item.id === draftId);
    if (!draft) return;

    AppState.gridWidth = draft.gridWidth;
    AppState.gridHeight = draft.gridHeight;
    AppState.brand = draft.brand;
    AppState.mardSet = draft.mardSet;
    AppState.pixelArtData = null;
    AppState.pixelData = deepClonePixels(draft.pixelData);
    AppState.generatedPixelData = deepClonePixels(draft.pixelData);
    AppState.stagedPixelData = null;
    AppState.stagedActions = [];
    AppState.cropRect = draft.cropRect ? { ...draft.cropRect } : AppState.cropRect;
    AppState.highlightedColorId = null;
    AppState.editMode = 'none';
    AppState.adjustPhase = 'waiting_receiver';
    AppState.receiverIndex = null;
    AppState.deleteMode = false;
    AppState.edgeSelectionMode = false;
    AppState.clearBaseMode = false;
    AppState.fillMode = false;
    AppState.fillColor = null;
    AppState.fillColorId = null;
    AppState.fillSourceIndex = null;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    AppState.selectedEdgeBeadsIndices = [];
    AppState.comparePreviewScale = 1;
    AppState.comparePreviewOffsetX = 0;
    AppState.comparePreviewOffsetY = 0;
    AppState.comparePreviewDragging = false;
    AppState.comparePreviewDidDrag = false;
    AppState.comparePreviewLastX = 0;
    AppState.comparePreviewLastY = 0;
    AppState.comparePreviewVisible = false;
    AppState.workbenchSettingsCollapsed = true;
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    resetBatchReplaceState();

    const gridSizeSlider = document.getElementById('grid-size-slider');
    if (gridSizeSlider) {
        gridSizeSlider.value = String(Math.max(AppState.gridWidth, AppState.gridHeight));
    }
    const brandSelect = document.getElementById('brand-select');
    if (brandSelect) brandSelect.value = AppState.brand;
    const mardSetSelect = document.getElementById('mard-set-select');
    if (mardSetSelect) mardSetSelect.value = String(AppState.mardSet);

    const finishRestore = () => {
        const sourceCanvas = document.getElementById('source-canvas');
        const sourceCtx = sourceCanvas?.getContext('2d');
        if (sourceCanvas && sourceCtx && draft.sourceImageDataUrl) {
            const restoredImage = new Image();
            restoredImage.onload = () => {
                AppState.image = restoredImage;
                sourceCanvas.width = restoredImage.width;
                sourceCanvas.height = restoredImage.height;
                sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
                sourceCtx.drawImage(restoredImage, 0, 0);
                AppState.originalImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
                AppState.history = [sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)];
                goToStep(3);
            };
            restoredImage.src = draft.sourceImageDataUrl;
            return;
        }
        goToStep(3);
    };

    finishRestore();
}

export async function deleteWorkbenchDraft(draftId) {
    await removeWorkbenchDraftFromDb(draftId);
    AppState.drafts = (AppState.drafts || []).filter((item) => item.id !== draftId);
    renderDraftBox();
}

export async function renameWorkbenchDraft(draftId, nextName) {
    const draft = (AppState.drafts || []).find((item) => item.id === draftId);
    if (!draft) return;
    const trimmedName = nextName.trim();
    if (!trimmedName || trimmedName === draft.name) {
        renderDraftBox();
        return;
    }
    draft.name = trimmedName;
    draft.updatedAt = new Date().toISOString();
    await upsertWorkbenchDraft(draft);
    AppState.drafts = [...(AppState.drafts || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    renderDraftBox();
}

export function toggleDraftDrawer() {
    AppState.draftDrawerOpen = !AppState.draftDrawerOpen;
    renderDraftBox();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function normalizeCropRect(rect, width, height) {
    if (!rect) return null;
    const minSize = 16;
    const left = clamp(Math.min(rect.x, rect.x + rect.width), 0, Math.max(0, width - minSize));
    const top = clamp(Math.min(rect.y, rect.y + rect.height), 0, Math.max(0, height - minSize));
    const right = clamp(Math.max(rect.x, rect.x + rect.width), left + minSize, width);
    const bottom = clamp(Math.max(rect.y, rect.y + rect.height), top + minSize, height);
    return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.max(minSize, Math.round(right - left)),
        height: Math.max(minSize, Math.round(bottom - top))
    };
}

function getDefaultCropRect() {
    if (!AppState.image) return null;
    return {
        x: 0,
        y: 0,
        width: AppState.image.width,
        height: AppState.image.height
    };
}

function ensureCropRect() {
    if (!AppState.image) return null;
    AppState.cropRect = normalizeCropRect(AppState.cropRect || getDefaultCropRect(), AppState.image.width, AppState.image.height);
    return AppState.cropRect;
}

function getActiveSourceRatio() {
    if (!AppState.image) return 1;
    if (isWorkbenchLayout()) {
        const rect = ensureCropRect();
        if (rect && rect.width > 0 && rect.height > 0) {
            return rect.width / rect.height;
        }
    }
    return AppState.image.width / AppState.image.height;
}

function updateCropSummary() {
    if (!isWorkbenchLayout()) return;
    const summary = document.getElementById('crop-summary');
    if (!summary || !AppState.image) return;
    const rect = ensureCropRect();
    const isFullImage = rect.x === 0 && rect.y === 0 && rect.width === AppState.image.width && rect.height === AppState.image.height;
    if (isFullImage) {
        summary.textContent = `当前使用整张图片 (${AppState.image.width} x ${AppState.image.height})`;
        return;
    }
    summary.textContent = `范围 ${rect.width} x ${rect.height}，起点 (${rect.x}, ${rect.y})`;
}

function renderWorkbenchCropOverlay() {
    if (!isWorkbenchLayout()) return;
    const overlay = document.getElementById('workbench-crop-overlay');
    const cropBox = document.getElementById('workbench-crop-box');
    const previewCanvas = document.getElementById('workbench-source-preview');
    const hasPattern = Array.isArray(AppState.pixelData) && AppState.pixelData.length > 0;
    const shouldShow = Boolean(AppState.image) && !hasPattern && !AppState.pixelArtData;
    setHidden('workbench-crop-overlay', !shouldShow);
    if (!overlay || !cropBox || !previewCanvas || !shouldShow) {
        updateCropSummary();
        return;
    }

    const rect = ensureCropRect();
    const scaleX = previewCanvas.clientWidth / previewCanvas.width;
    const scaleY = previewCanvas.clientHeight / previewCanvas.height;
    cropBox.classList.remove('hidden');
    cropBox.style.left = `${previewCanvas.offsetLeft + rect.x * scaleX}px`;
    cropBox.style.top = `${previewCanvas.offsetTop + rect.y * scaleY}px`;
    cropBox.style.width = `${Math.max(24, rect.width * scaleX)}px`;
    cropBox.style.height = `${Math.max(24, rect.height * scaleY)}px`;
    updateCropSummary();
}

function clientPointFromEvent(event) {
    if (event.touches && event.touches[0]) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    if (event.changedTouches && event.changedTouches[0]) {
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
}

function getCropPointerData(event) {
    const overlay = document.getElementById('workbench-crop-overlay');
    const previewCanvas = document.getElementById('workbench-source-preview');
    if (!overlay || !previewCanvas || !AppState.image) return null;
    const point = clientPointFromEvent(event);
    const rect = overlay.getBoundingClientRect();
    const previewLeft = previewCanvas.offsetLeft;
    const previewTop = previewCanvas.offsetTop;
    const localX = clamp(point.x - rect.left - previewLeft, 0, previewCanvas.clientWidth);
    const localY = clamp(point.y - rect.top - previewTop, 0, previewCanvas.clientHeight);
    const imageX = Math.round((localX / previewCanvas.clientWidth) * previewCanvas.width);
    const imageY = Math.round((localY / previewCanvas.clientHeight) * previewCanvas.height);
    return {
        imageX: clamp(imageX, 0, previewCanvas.width),
        imageY: clamp(imageY, 0, previewCanvas.height)
    };
}

function updateCropRectFromInteraction(pointer) {
    const interaction = AppState.cropInteraction;
    if (!interaction || !AppState.image || !pointer) return;
    const minSize = 16;
    let nextRect = { ...interaction.startRect };

    if (interaction.mode === 'move') {
        nextRect.x = interaction.startRect.x + (pointer.imageX - interaction.startPoint.x);
        nextRect.y = interaction.startRect.y + (pointer.imageY - interaction.startPoint.y);
    } else {
        const right = interaction.startRect.x + interaction.startRect.width;
        const bottom = interaction.startRect.y + interaction.startRect.height;
        if (interaction.mode.includes('n')) {
            nextRect.y = pointer.imageY;
            nextRect.height = bottom - pointer.imageY;
        }
        if (interaction.mode.includes('s')) {
            nextRect.height = pointer.imageY - interaction.startRect.y;
        }
        if (interaction.mode.includes('w')) {
            nextRect.x = pointer.imageX;
            nextRect.width = right - pointer.imageX;
        }
        if (interaction.mode.includes('e')) {
            nextRect.width = pointer.imageX - interaction.startRect.x;
        }
    }

    AppState.cropRect = normalizeCropRect(nextRect, AppState.image.width, AppState.image.height);
    if (AppState.cropRect.width < minSize) AppState.cropRect.width = minSize;
    if (AppState.cropRect.height < minSize) AppState.cropRect.height = minSize;
    renderWorkbenchCropOverlay();
}

function stopCropInteraction() {
    AppState.cropInteraction = null;
}

export function resetWorkbenchCropRect() {
    if (!AppState.image) return;
    AppState.cropRect = getDefaultCropRect();
    updateGridDimensions();
}

export function startWorkbenchCropInteraction(event) {
    if (!isWorkbenchLayout()) return;
    if (!AppState.image) return;
    const cropBox = document.getElementById('workbench-crop-box');
    const pointer = getCropPointerData(event);
    if (!pointer || !cropBox) return;
    const handle = event.target.closest('[data-crop-handle]')?.dataset.cropHandle;
    const isInsideBox = event.target === cropBox || cropBox.contains(event.target);
    const rect = ensureCropRect();

    AppState.cropInteraction = {
        mode: handle || (isInsideBox ? 'move' : 'create'),
        startPoint: pointer,
        startRect: { ...rect }
    };

    if (AppState.cropInteraction.mode === 'create') {
        AppState.cropInteraction.startRect = {
            x: pointer.imageX,
            y: pointer.imageY,
            width: 16,
            height: 16
        };
        AppState.cropRect = { ...AppState.cropInteraction.startRect };
        AppState.cropInteraction.mode = 'se';
        renderWorkbenchCropOverlay();
    }

    event.preventDefault();
}

export function moveWorkbenchCropInteraction(event) {
    if (!AppState.cropInteraction) return;
    const pointer = getCropPointerData(event);
    if (!pointer) return;
    updateCropRectFromInteraction(pointer);
    event.preventDefault();
}

export function endWorkbenchCropInteraction() {
    if (!AppState.cropInteraction) return;
    AppState.cropRect = ensureCropRect();
    stopCropInteraction();
    updateGridDimensions();
}

function getSourceImageDataForGeneration() {
    const sourceCanvas = document.getElementById('source-canvas');
    const ctx = sourceCanvas.getContext('2d');
    if (!isWorkbenchLayout() || !AppState.image) {
        return ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    }
    const rect = ensureCropRect();
    return ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
}

function getPixelArtSettingsFromUI() {
    const contrast = Number(document.getElementById('pixel-contrast-slider')?.value || 0);
    const sharpen = Number(document.getElementById('pixel-sharpen-slider')?.value || 0);
    const dominant = Number(document.getElementById('pixel-dominant-slider')?.value || 50);
    AppState.pixelArtSettings = { contrast, sharpen, dominant };
    return AppState.pixelArtSettings;
}

function updateWorkbenchSourcePreview() {
    if (!isWorkbenchLayout() || !AppState.image) return;
    const previewCanvas = document.getElementById('workbench-source-preview');
    const resultContainer = document.getElementById('result-container-single');
    if (!previewCanvas || !resultContainer) return;

    const img = AppState.image;
    const containerWidth = resultContainer.clientWidth || window.innerWidth;
    const containerHeight = resultContainer.clientHeight || window.innerHeight;
    const padding = 96;
    const maxWidth = Math.max(240, containerWidth - padding);
    const maxHeight = Math.max(240, containerHeight - padding);
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const displayWidth = Math.max(1, Math.round(img.width * scale));
    const displayHeight = Math.max(1, Math.round(img.height * scale));

    previewCanvas.width = img.width;
    previewCanvas.height = img.height;
    previewCanvas.style.width = `${displayWidth}px`;
    previewCanvas.style.height = `${displayHeight}px`;
    previewCanvas.style.left = `${(containerWidth - displayWidth) / 2}px`;
    previewCanvas.style.top = `${(containerHeight - displayHeight) / 2}px`;

    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(img, 0, 0);
    renderWorkbenchCropOverlay();
}

function renderPixelArtPreview() {
    if (!isWorkbenchLayout() || !AppState.pixelArtData) return;
    const previewCanvas = document.getElementById('workbench-source-preview');
    const resultContainer = document.getElementById('result-container-single');
    if (!previewCanvas || !resultContainer) return;

    const containerWidth = resultContainer.clientWidth || window.innerWidth;
    const containerHeight = resultContainer.clientHeight || window.innerHeight;
    const padding = 96;
    const maxWidth = Math.max(240, containerWidth - padding);
    const maxHeight = Math.max(240, containerHeight - padding);
    const scale = Math.min(maxWidth / AppState.gridWidth, maxHeight / AppState.gridHeight);
    const displayWidth = Math.max(1, Math.round(AppState.gridWidth * scale));
    const displayHeight = Math.max(1, Math.round(AppState.gridHeight * scale));

    previewCanvas.width = AppState.gridWidth;
    previewCanvas.height = AppState.gridHeight;
    previewCanvas.style.width = `${displayWidth}px`;
    previewCanvas.style.height = `${displayHeight}px`;
    previewCanvas.style.left = `${(containerWidth - displayWidth) / 2}px`;
    previewCanvas.style.top = `${(containerHeight - displayHeight) / 2}px`;

    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.imageSmoothingEnabled = false;
    AppState.pixelArtData.forEach((pixel, index) => {
        if (!pixel || pixel.a < 128) return;
        const x = index % AppState.gridWidth;
        const y = Math.floor(index / AppState.gridWidth);
        ctx.fillStyle = `rgb(${pixel.r},${pixel.g},${pixel.b})`;
        ctx.fillRect(x, y, 1, 1);
    });
    renderWorkbenchCropOverlay();
}

function updateWorkbenchComparePreview(resetScale = false) {
    if (!isWorkbenchLayout() || !AppState.image) return;
    const previewCanvas = document.getElementById('compare-source-preview');
    const frame = document.getElementById('compare-source-frame');
    if (!previewCanvas || !frame) return;

    const sourceCanvas = document.getElementById('source-canvas');
    const sourceCtx = sourceCanvas?.getContext('2d');
    if (!sourceCanvas || !sourceCtx) return;
    const crop = ensureCropRect();
    const sourceImageData = sourceCtx.getImageData(crop.x, crop.y, crop.width, crop.height);
    const frameWidth = frame.clientWidth || 320;
    const frameHeight = frame.clientHeight || 320;
    const padding = 32;
    const fitScale = Math.min(
        (frameWidth - padding) / crop.width,
        (frameHeight - padding) / crop.height,
        1
    );

    if (resetScale || !AppState.comparePreviewScale) {
        AppState.comparePreviewScale = Math.max(fitScale, 0.1);
        AppState.comparePreviewOffsetX = 0;
        AppState.comparePreviewOffsetY = 0;
        AppState.comparePreviewDragging = false;
        AppState.comparePreviewDidDrag = false;
    }

    const displayWidth = Math.max(1, Math.round(crop.width * AppState.comparePreviewScale));
    const displayHeight = Math.max(1, Math.round(crop.height * AppState.comparePreviewScale));

    previewCanvas.width = crop.width;
    previewCanvas.height = crop.height;
    previewCanvas.style.width = `${displayWidth}px`;
    previewCanvas.style.height = `${displayHeight}px`;
    previewCanvas.style.left = `${Math.round((frameWidth - displayWidth) / 2 + AppState.comparePreviewOffsetX)}px`;
    previewCanvas.style.top = `${Math.round((frameHeight - displayHeight) / 2 + AppState.comparePreviewOffsetY)}px`;

    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.putImageData(sourceImageData, 0, 0);
}

export function resetWorkbenchComparePreview() {
    if (!AppState.image) return;
    updateWorkbenchComparePreview(true);
}

export function toggleWorkbenchComparePreview() {
    if (!isWorkbenchLayout() || !hasWorkbenchPattern()) return;
    AppState.comparePreviewVisible = !AppState.comparePreviewVisible;
    if (AppState.comparePreviewVisible) {
        updateWorkbenchComparePreview(true);
    }
    updateWorkbenchUI();
}

export function toggleWorkbenchSettingsPanel() {
    if (!isWorkbenchLayout() || !hasWorkbenchPattern()) return;
    AppState.workbenchSettingsCollapsed = !AppState.workbenchSettingsCollapsed;
    updateWorkbenchUI();
}

export function zoomWorkbenchComparePreview(deltaY) {
    if (!isWorkbenchLayout() || !AppState.image || !hasWorkbenchPattern() || !AppState.comparePreviewVisible) return;
    const nextScale = clamp((AppState.comparePreviewScale || 1) * (deltaY < 0 ? 1.1 : 0.9), 0.1, 8);
    AppState.comparePreviewScale = nextScale;
    updateWorkbenchComparePreview(false);
}

export function updateWorkbenchUI() {
    if (!isWorkbenchLayout()) return;
    const hasImage = Boolean(AppState.image);
    const hasPattern = hasWorkbenchPattern();
    const hasPixelArt = Boolean(AppState.pixelArtData) && !hasPattern;
    const toolbarCollapsed = Boolean(AppState.workbenchToolbarCollapsed);
    const settingsCollapsed = hasPattern && Boolean(AppState.workbenchSettingsCollapsed);
    const compareVisible = hasPattern && AppState.comparePreviewVisible;
    setHidden('workbench-upload-empty', hasImage || hasPattern);
    setHidden('workbench-change-image', !hasImage && !hasPattern);
    setHidden('workbench-preview-empty', !hasImage || hasPattern || hasPixelArt);
    setHidden('workbench-source-preview', !hasImage || hasPattern);
    setHidden('result-canvas', !hasPattern);
    setHidden('workbench-single-stage', hasPattern);
    setHidden('workbench-edit-stage', !hasPattern);
    setHidden('toggle-compare-preview-btn', !hasPattern);
    setHidden('compare-source-pane', !compareVisible);
    setHidden('workbench-edit-toolbar', !hasPattern || AppState.editMode !== 'none' || toolbarCollapsed);
    setHidden('expand-edit-toolbar-btn', !hasPattern || AppState.editMode !== 'none' || !toolbarCollapsed);
    setHidden('workbench-active-toolbar', AppState.editMode === 'none');
    setHidden('workbench-color-panel-empty', hasPattern);
    setHidden('color-stats', !hasPattern);
    setHidden('workbench-settings-content', settingsCollapsed);
    setText('generate-pattern-label', hasPattern ? '更新拼豆图纸' : '生成拼豆图纸');
    setText('pixel-art-status', hasPixelArt ? '预览已生成' : '未生成预览');
    setText('workbench-settings-summary', getWorkbenchSettingsSummary());
    setText('workbench-settings-toggle-label', settingsCollapsed ? '展开' : '收起');
    renderPalettePanel();
    const generateBtn = document.getElementById('generate-pattern-btn');
    if (generateBtn) {
        generateBtn.disabled = !hasImage || !AppState.pixelArtData;
        generateBtn.classList.toggle('opacity-40', !hasImage || !AppState.pixelArtData);
        generateBtn.classList.toggle('cursor-not-allowed', !hasImage || !AppState.pixelArtData);
    }
    const pixelArtBtn = document.getElementById('generate-pixel-art-btn');
    if (pixelArtBtn) {
        pixelArtBtn.disabled = !hasImage;
        pixelArtBtn.textContent = hasPixelArt ? '重新生成像素预览' : '生成像素预览';
        pixelArtBtn.classList.toggle('opacity-40', !hasImage);
        pixelArtBtn.classList.toggle('cursor-not-allowed', !hasImage);
    }
    const legacyGenerateBtn = document.getElementById('legacy-generate-pattern-btn');
    if (legacyGenerateBtn) {
        legacyGenerateBtn.disabled = !hasImage;
        legacyGenerateBtn.classList.toggle('opacity-40', !hasImage);
        legacyGenerateBtn.classList.toggle('cursor-not-allowed', !hasImage);
    }
    const exportBtn = document.getElementById('next-to-step-4');
    if (exportBtn) {
        exportBtn.disabled = !hasPattern;
        exportBtn.classList.toggle('opacity-40', !hasPattern);
        exportBtn.classList.toggle('cursor-not-allowed', !hasPattern);
    }
    const modeLabel = AppState.fillMode
        ? (AppState.fillColorId
            ? (AppState.fillSourceMode === 'original'
                ? '原图取色'
                : AppState.fillSourceMode === 'palette'
                    ? `色盘填色 ${AppState.fillColorId}`
                    : '填色中')
            : '取色填色')
        : AppState.clearBaseMode
            ? '移除底色'
            : AppState.deleteMode
            ? '删除色块'
            : AppState.edgeSelectionMode
                ? '边缘调整'
                : '编辑';
    setText('workbench-active-mode-label', modeLabel);
    setHidden('fill-source-toggle', !AppState.fillMode || AppState.fillSourceMode === 'palette');
    const canvasBtn = document.getElementById('fill-source-canvas-btn');
    const originalBtn = document.getElementById('fill-source-original-btn');
    if (canvasBtn && originalBtn) {
        canvasBtn.classList.toggle('bg-white', AppState.fillSourceMode === 'canvas');
        canvasBtn.classList.toggle('text-gray-800', AppState.fillSourceMode === 'canvas');
        canvasBtn.classList.toggle('text-gray-500', AppState.fillSourceMode !== 'canvas');
        originalBtn.classList.toggle('bg-white', AppState.fillSourceMode === 'original');
        originalBtn.classList.toggle('text-gray-800', AppState.fillSourceMode === 'original');
        originalBtn.classList.toggle('text-gray-500', AppState.fillSourceMode !== 'original');
    }
    const compareSourceFrame = document.getElementById('compare-source-frame');
    const compareSourcePreview = document.getElementById('compare-source-preview');
    const shouldUseOriginalPickerCursor = AppState.fillMode && AppState.fillSourceMode === 'original' && compareVisible;
    if (compareSourceFrame) {
        compareSourceFrame.classList.toggle('cursor-crosshair', shouldUseOriginalPickerCursor);
    }
    if (compareSourcePreview) {
        compareSourcePreview.classList.toggle('cursor-crosshair', shouldUseOriginalPickerCursor);
    }
    const compareBtn = document.getElementById('toggle-compare-preview-btn');
    if (compareBtn) {
        compareBtn.textContent = compareVisible ? '收起原图' : '原图对照';
    }
    const resultPane = document.getElementById('result-pane');
    if (resultPane) {
        resultPane.style.left = compareVisible ? '34%' : '0';
    }
    renderWorkbenchCropOverlay();
    if (hasImage && !hasPattern) {
        if (AppState.pixelArtData) renderPixelArtPreview();
        else updateWorkbenchSourcePreview();
    }
    if (hasImage && compareVisible) {
        updateWorkbenchComparePreview(false);
    }
    renderDraftBox();
}

/**
 * 切换页面步骤
 * @param {number} step - 步骤编号（1-4）
 */
export function goToStep(step) {
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    const stepNames = ['home', 'settings', 'editor', 'export'];
    const targetStep = isWorkbenchLayout() && step === 3 ? 2 : step;
    document.querySelector(`#step-${stepNames[targetStep - 1]}`).classList.add('active');
    AppState.currentStep = step;

    // 根据步骤初始化对应视图
    if (step === 2) initSettingsView();
    if (step === 3) initEditorView();
    if (step === 4) initExportView();
    updateWorkbenchUI();
}

/**
 * 初始化设置页（Step 2）
 */
function initSettingsView() {
    if (!AppState.image) return;
    
    const sourceCanvas = document.getElementById('source-canvas');
    const ctxSource = sourceCanvas.getContext('2d');
    const container = document.getElementById('canvas-container');
    const img = AppState.image;

    // 计算预览区域尺寸
    const maxWidth = isWorkbenchLayout()
        ? Math.max(220, Math.min(container.parentElement.clientWidth - 24, 360))
        : window.innerWidth * 0.9;
    const maxHeight = isWorkbenchLayout() ? 220 : window.innerHeight * 0.65;
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

    // 保存初始图像数据
    AppState.originalImageData = ctxSource.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    AppState.history = [ctxSource.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)];
    AppState.cropRect = getDefaultCropRect();
    AppState.cropInteraction = null;
    AppState.comparePreviewVisible = false;
    updateUndoButton();
    
    updateGridDimensions();
    updateWorkbenchSourcePreview();
    updateWorkbenchUI();
}

/**
 * 更新网格尺寸
 */
export function updateGridDimensions() {
    const slider = document.getElementById('grid-size-slider');
    const sizeDisplay = document.getElementById('grid-size-display');
    const val = parseInt(slider.value);
    const ratio = getActiveSourceRatio();
    
    if (ratio >= 1) {
        AppState.gridWidth = val;
        AppState.gridHeight = Math.round(val / ratio);
    } else {
        AppState.gridHeight = val;
        AppState.gridWidth = Math.round(val * ratio);
    }
    
    sizeDisplay.innerText = `${AppState.gridWidth}x${AppState.gridHeight}`;
    if (!hasWorkbenchPattern()) {
        AppState.pixelArtData = null;
    }
    updateBoardSizeUI();
    updateWorkbenchUI();
}

/**
 * 更新板子尺寸 UI
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
 * 更新背景移除撤回按钮状态
 */
export function updateUndoButton() {
    const btn = document.getElementById('undo-bg-btn');
    if (!btn) return;
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

function getSourceCanvasPoint(event) {
    const sourceCanvas = document.getElementById('source-canvas');
    if (!sourceCanvas) return null;

    const rect = sourceCanvas.getBoundingClientRect();
    const pointer = event.touches ? event.touches[0] : event.changedTouches ? event.changedTouches[0] : event;
    const displayX = pointer.clientX - rect.left;
    const displayY = pointer.clientY - rect.top;
    const scaleX = sourceCanvas.width / rect.width;
    const scaleY = sourceCanvas.height / rect.height;

    return {
        displayX,
        displayY,
        canvasX: Math.max(0, Math.min(sourceCanvas.width - 1, Math.floor(displayX * scaleX))),
        canvasY: Math.max(0, Math.min(sourceCanvas.height - 1, Math.floor(displayY * scaleY)))
    };
}

function getBgSelectionOverlay() {
    const container = document.getElementById('canvas-container');
    if (!container) return null;

    let overlay = document.getElementById('bg-selection-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bg-selection-overlay';
        overlay.className = 'absolute border-2 border-primary bg-primary/20 pointer-events-none hidden z-20';
        container.appendChild(overlay);
    }
    return overlay;
}

function updateBgSelectionOverlay(start, current) {
    const overlay = getBgSelectionOverlay();
    if (!overlay) return;

    const sourceCanvas = document.getElementById('source-canvas');
    const container = document.getElementById('canvas-container');
    const canvasRect = sourceCanvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;
    const left = Math.min(start.displayX, current.displayX);
    const top = Math.min(start.displayY, current.displayY);
    const width = Math.abs(current.displayX - start.displayX);
    const height = Math.abs(current.displayY - start.displayY);

    overlay.style.left = `${left + offsetX}px`;
    overlay.style.top = `${top + offsetY}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    overlay.classList.remove('hidden');
}

function clearBgSelectionOverlay() {
    const overlay = document.getElementById('bg-selection-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.width = '0px';
        overlay.style.height = '0px';
    }
}

function pushSourceCanvasHistory(sourceCanvas) {
    const ctx = sourceCanvas.getContext('2d');
    AppState.history.push(ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height));
    if (AppState.history.length > 10) AppState.history.shift();
    updateUndoButton();
}

function removeSelectedBackgroundRect(start, end) {
    const sourceCanvas = document.getElementById('source-canvas');
    if (!sourceCanvas) return false;

    const x1 = Math.min(start.canvasX, end.canvasX);
    const y1 = Math.min(start.canvasY, end.canvasY);
    const x2 = Math.max(start.canvasX, end.canvasX);
    const y2 = Math.max(start.canvasY, end.canvasY);
    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;
    if (width < 2 || height < 2) return false;

    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imageData.data;

    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            data[(y * sourceCanvas.width + x) * 4 + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    pushSourceCanvasHistory(sourceCanvas);
    return true;
}

/**
 * 撤销背景移除
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
 * 切换背景移除模式
 */
export function toggleBgRemovalMode() {
    AppState.isBgRemoving = !AppState.isBgRemoving;
    AppState.bgRemovalSelection = null;
    clearBgSelectionOverlay();
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

export function startBgRemovalSelection(event) {
    if (!AppState.isBgRemoving) return false;

    const point = getSourceCanvasPoint(event);
    if (!point) return false;

    AppState.bgRemovalSelection = {
        start: point,
        current: point,
        isDragging: true,
        didDrag: false,
        suppressNextClick: false
    };
    clearBgSelectionOverlay();
    return true;
}

export function moveBgRemovalSelection(event) {
    const selection = AppState.bgRemovalSelection;
    if (!AppState.isBgRemoving || !selection || !selection.isDragging) return false;

    const point = getSourceCanvasPoint(event);
    if (!point) return false;

    selection.current = point;
    const dx = Math.abs(point.displayX - selection.start.displayX);
    const dy = Math.abs(point.displayY - selection.start.displayY);
    if (dx >= 6 || dy >= 6) {
        selection.didDrag = true;
        updateBgSelectionOverlay(selection.start, point);
    }
    return true;
}

export function endBgRemovalSelection(event) {
    const selection = AppState.bgRemovalSelection;
    if (!AppState.isBgRemoving || !selection || !selection.isDragging) return false;

    const point = getSourceCanvasPoint(event) || selection.current;
    selection.isDragging = false;
    clearBgSelectionOverlay();

    if (!selection.didDrag) return false;

    const removed = removeSelectedBackgroundRect(selection.start, point);
    AppState.bgRemovalSelection = { suppressNextClick: true };
    if (removed) {
        toggleBgRemovalMode();
    }
    return true;
}

/**
 * 处理原图 Canvas 点击移除背景
 */
export function handleCanvasClick(e) {
    if (!AppState.isBgRemoving) return;
    if (AppState.bgRemovalSelection?.suppressNextClick) {
        AppState.bgRemovalSelection = null;
        return;
    }

    const sourceCanvas = document.getElementById('source-canvas');
    const point = getSourceCanvasPoint(e);
    if (!sourceCanvas || !point) return;

    const ctx = sourceCanvas.getContext('2d');
    const tolerance = parseInt(document.getElementById('tolerance-slider').value);
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

    const resultData = removeBackground(imageData, point.canvasX, point.canvasY, tolerance);
    ctx.putImageData(resultData, 0, 0);

    pushSourceCanvasHistory(sourceCanvas);
    toggleBgRemovalMode();
}

/**
 * 清理细碎残片
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
 * 根据当前设置生成图纸数据
 */
export function updatePixelArtControlDisplays() {
    const settings = getPixelArtSettingsFromUI();
    setText('pixel-contrast-display', String(settings.contrast));
    setText('pixel-sharpen-display', String(settings.sharpen));
    setText('pixel-dominant-display', String(settings.dominant));
}

export function handleGeneratePixelArt() {
    if (!AppState.image) return;
    const sourceImageData = getSourceImageDataForGeneration();
    const precisionMode = document.getElementById('precision-mode-select')?.value || 'standard';
    const settings = getPixelArtSettingsFromUI();

    AppState.pixelArtData = generatePixelArtData({
        sourceImageData,
        gridWidth: AppState.gridWidth,
        gridHeight: AppState.gridHeight,
        precisionMode,
        contrast: settings.contrast,
        sharpen: settings.sharpen,
        dominant: settings.dominant
    });
    AppState.pixelData = [];
    AppState.generatedPixelData = null;
    AppState.highlightedColorId = null;
    AppState.workbenchSettingsCollapsed = false;
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    AppState.comparePreviewVisible = false;
    renderPixelArtPreview();
    updateWorkbenchUI();
}

export function handleGeneratePatternLegacy() {
    if (!AppState.image) return;
    const sourceImageData = getSourceImageDataForGeneration();

    AppState.highlightedColorId = null;
    AppState.pixelArtData = null;
    AppState.pixelData = generatePatternDataOriginal({
        sourceImageData,
        gridWidth: AppState.gridWidth,
        gridHeight: AppState.gridHeight,
        brand: AppState.brand,
        mardSet: AppState.mardSet,
        isColorLimitEnabled: document.getElementById('color-limit-toggle').checked,
        maxColors: parseInt(document.getElementById('max-colors-slider').value),
        palettes: PALETTES
    });
    AppState.generatedPixelData = deepClonePixels(AppState.pixelData);
    AppState.workbenchSettingsCollapsed = isWorkbenchLayout();
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    AppState.comparePreviewVisible = false;
    goToStep(3);
}

export function handleGeneratePattern() {
    if (!AppState.image) return;
    if (!isWorkbenchLayout() || !AppState.pixelArtData) {
        handleGeneratePatternLegacy();
        return;
    }

    AppState.highlightedColorId = null;

    const precisionMode = document.getElementById('precision-mode-select')?.value || 'standard';
    const colorMatchMode = document.getElementById('color-match-mode-select')?.value || 'redmean';
    const sourceImageData = precisionMode === 'high' ? getSourceImageDataForGeneration() : null;
    AppState.pixelData = mapPixelArtToBeads({
        sourceImageData,
        pixelArtData: AppState.pixelArtData,
        gridWidth: AppState.gridWidth,
        gridHeight: AppState.gridHeight,
        brand: AppState.brand,
        mardSet: AppState.mardSet,
        isColorLimitEnabled: document.getElementById('color-limit-toggle').checked,
        maxColors: parseInt(document.getElementById('max-colors-slider').value),
        isDitheringEnabled: document.getElementById('dithering-toggle').checked,
        precisionMode,
        colorMatchMode,
        palettes: PALETTES
    });
    AppState.generatedPixelData = deepClonePixels(AppState.pixelData);
    AppState.workbenchSettingsCollapsed = isWorkbenchLayout();
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    AppState.comparePreviewScale = 1;
    AppState.comparePreviewOffsetX = 0;
    AppState.comparePreviewOffsetY = 0;
    AppState.comparePreviewDragging = false;
    AppState.comparePreviewDidDrag = false;
    AppState.comparePreviewLastX = 0;
    AppState.comparePreviewLastY = 0;
    AppState.comparePreviewVisible = false;

    goToStep(3);
}

function initEditorView() {
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
    updateWorkbenchComparePreview(true);
    
    // 使用 requestAnimationFrame 等待布局完成，再计算适配缩放
    requestAnimationFrame(() => {
        const resultContainer = document.getElementById('result-container');
        const zoomState = getResetZoomState(resultContainer, resultCanvas);
        AppState.zoomState = zoomState; // 保存初始缩放状态
        updateResultTransform(resultCanvas, zoomState, document.getElementById('zoom-reset-btn'));
        updateWorkbenchComparePreview(false);
        updateWorkbenchUI();
    });
}

export function resetPatternToGenerated() {
    if (!AppState.generatedPixelData) return;
    if (!window.confirm('确定要重置当前图纸，放弃所有编辑操作吗？')) return;
    AppState.pixelData = deepClonePixels(AppState.generatedPixelData);
    AppState.pixelArtData = null;
    AppState.stagedPixelData = null;
    AppState.stagedActions = [];
    AppState.editMode = 'none';
    AppState.deleteMode = false;
    AppState.edgeSelectionMode = false;
    AppState.clearBaseMode = false;
    AppState.fillMode = false;
    AppState.fillColor = null;
    AppState.fillColorId = null;
    AppState.fillSourceIndex = null;
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    AppState.comparePreviewVisible = false;
    AppState.selectedEdgeBeadsIndices = [];
    AppState.receiverIndex = null;
    AppState.adjustPhase = 'waiting_receiver';
    resetBatchReplaceState();
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
    updateAdjustUndoButton();
    updateWorkbenchUI();
}

export function collapseWorkbenchEditToolbar() {
    if (!isWorkbenchLayout() || AppState.editMode !== 'none') return;
    AppState.workbenchToolbarCollapsed = true;
    updateWorkbenchUI();
}

export function expandWorkbenchEditToolbar() {
    if (!isWorkbenchLayout() || AppState.editMode !== 'none') return;
    AppState.workbenchToolbarCollapsed = false;
    updateWorkbenchUI();
}

/**
 * 初始化导出页（Step 4）
 */
function initExportView() {
    const resultCanvas = document.getElementById('result-canvas');
    const exportImg = document.getElementById('export-preview');
    exportImg.src = resultCanvas.toDataURL();
    document.getElementById('export-meta').innerText = `${AppState.gridWidth}x${AppState.gridHeight} · ${AppState.brand.toUpperCase()}`;
}

/**
 * 更新容差显示
 */
export function updateTolerance(val) {
    document.getElementById('tolerance-value').innerText = val;
}

/**
 * 切换颜色限制开关
 */
export function toggleColorLimit() {
    const isEnabled = document.getElementById('color-limit-toggle').checked;
    const controls = document.getElementById('color-limit-controls');
    if (isEnabled) {
        controls.classList.remove('opacity-40', 'pointer-events-none');
    } else {
        controls.classList.add('opacity-40', 'pointer-events-none');
    }
    updateWorkbenchUI();
}

/**
 * 更新最大颜色数显示
 */
export function updateMaxColorsDisplay() {
    const val = document.getElementById('max-colors-slider').value;
    document.getElementById('max-colors-display').innerText = val;
    updateWorkbenchUI();
}

loadWorkbenchDrafts().then(() => {
    if (document.readyState !== 'loading') {
        renderDraftBox();
    }
});
