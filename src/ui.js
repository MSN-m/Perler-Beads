/**
 * 拼豆图纸生成器 - UI 与页面流程
 */
import { AppState } from './state.js';
import { removeBackground, cleanTinyFragments, generatePatternData, generatePatternDataOriginal, generatePixelArtData, mapPixelArtToBeads } from './processor.js';
import { renderResult, updateResultTransform, getResetZoomState } from './renderer.js';
import { PALETTES } from './constants.js';
import { calculateStats, configureEditorActions, deepClonePixels, getCurrentPalette, resetBatchReplaceState, updateAdjustUndoButton } from './editor.js';
import { toggleDeleteMode as _toggleDeleteMode, toggleColorEraseMode as _toggleColorEraseMode } from './features/delete.js';
import { resetZoom as _resetZoom } from './features/zoom.js';
import { toggleEdgeAdjustMode as _toggleEdgeAdjustMode } from './features/edge.js';
import {
    refreshQualityIssues,
    openQualityCheckModal as _openQualityCheckModal,
    refreshQualityOverlay as _refreshQualityOverlay
} from './features/quality.js';
import {
    enterEditSession as _enterEditSession,
    toggleFillMode as _toggleFillMode,
    toggleClearBaseMode as _toggleClearBaseMode,
    selectPaletteFillColor as _selectPaletteFillColor,
    handleResultCanvasClickForAdjust as _handleResultCanvasClickForAdjust,
    handleOriginalFillPick as _handleOriginalFillPick,
    activateEyedropper as _activateEyedropper,
    startWorkbenchCompareDrag as _startWorkbenchCompareDrag,
    moveWorkbenchCompareDrag as _moveWorkbenchCompareDrag,
    endWorkbenchCompareDrag as _endWorkbenchCompareDrag,
    startFillSelection as _startFillSelection,
    moveFillSelection as _moveFillSelection,
    endFillSelection as _endFillSelection,
    adjustUndo as _adjustUndo,
    adjustRedo as _adjustRedo,
    adjustCancel as _adjustCancel,
    startPaletteBatchReplace as _startPaletteBatchReplace,
} from './features/adjust.js';
configureEditorActions({
    enterColorReplaceMode: _enterEditSession,
    updateWorkbenchUI
});

export {
    _toggleDeleteMode as toggleDeleteMode,
    _toggleColorEraseMode as toggleColorEraseMode,
    _resetZoom as resetZoom,
    _toggleEdgeAdjustMode as toggleEdgeAdjustMode,
    _toggleFillMode as toggleFillMode,
    _toggleClearBaseMode as toggleClearBaseMode,
    _selectPaletteFillColor as selectPaletteFillColor,
    _handleResultCanvasClickForAdjust as handleResultCanvasClickForAdjust,
    _handleOriginalFillPick as handleOriginalFillPick,
    _activateEyedropper as activateEyedropper,
    _startWorkbenchCompareDrag as startWorkbenchCompareDrag,
    _moveWorkbenchCompareDrag as moveWorkbenchCompareDrag,
    _endWorkbenchCompareDrag as endWorkbenchCompareDrag,
    _startFillSelection as startFillSelection,
    _moveFillSelection as moveFillSelection,
    _endFillSelection as endFillSelection,
    _adjustUndo as adjustUndo,
    _adjustRedo as adjustRedo,
    _adjustCancel as adjustCancel,
    _openQualityCheckModal as openQualityCheckModal,
    _refreshQualityOverlay as refreshQualityOverlay
};

function isWorkbenchLayout() {
    return document.body.dataset.layout === 'workbench';
}

function isWorkbenchTabletLayout() {
    const width = window.innerWidth;
    const isTouchTablet = width <= 1180 && window.matchMedia?.('(pointer: coarse)').matches;
    return width >= 768 && (width < 1024 || isTouchTablet);
}

function isWorkbenchMobileLayout() {
    return window.innerWidth < 768;
}

function getWorkbenchViewportMode() {
    if (isWorkbenchMobileLayout()) return 'mobile';
    if (isWorkbenchTabletLayout()) return 'tablet';
    return 'desktop';
}

function ensureWorkbenchShell(layout, viewportMode) {
    if (!layout) return null;
    const shellModes = ['desktop', 'tablet', 'mobile'];
    for (const mode of shellModes) {
        if (document.getElementById(`workbench-${mode}-shell`)) continue;
        const shell = document.createElement('div');
        shell.id = `workbench-${mode}-shell`;
        shell.className = 'workbench-shell';
        shell.dataset.workbenchShell = mode;
        layout.appendChild(shell);
    }

    const activeShell = document.getElementById(`workbench-${viewportMode}-shell`);
    for (const mode of shellModes) {
        const shell = document.getElementById(`workbench-${mode}-shell`);
        if (!shell) continue;
        const active = mode === viewportMode;
        shell.classList.toggle('is-active', active);
        shell.hidden = !active;
    }
    return activeShell;
}

function mountWorkbenchSharedNodes(activeShell) {
    if (!activeShell) return;
    ['workbench-top-actions', 'workbench-stage', 'workbench-side-panel'].forEach((id) => {
        const node = document.getElementById(id);
        if (node && node.parentElement !== activeShell) activeShell.appendChild(node);
    });
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

function getBrandLabel(brand) {
    return {
        mard: 'MARD',
        perler: 'Perler',
        hama: 'Hama',
        artkal: 'Artkal'
    }[brand] || String(brand || '').toUpperCase();
}

function syncBrandControls() {
    const brandSelect = document.getElementById('brand-select');
    const mardSetSelect = document.getElementById('mard-set-select');
    const mardSetContainer = document.getElementById('mard-set-container');
    if (brandSelect) brandSelect.value = AppState.brand;
    if (mardSetSelect) mardSetSelect.value = String(AppState.mardSet);
    if (mardSetContainer) mardSetContainer.classList.toggle('hidden', AppState.brand !== 'mard');
}

function syncMobileColorLimitDisplay() {
    if (!isWorkbenchMobileLayout()) return;
    const display = document.getElementById('max-colors-display');
    const toggle = document.getElementById('color-limit-toggle');
    const header = toggle?.closest('.flex.justify-between.items-center');
    const title = header?.querySelector('label.text-sm.font-bold');
    if (!display || !header || !title || display.parentElement === header) return;
    title.insertAdjacentElement('afterend', display);
}

function renderMobileSettingsModal() {
    const modal = document.getElementById('mobile-settings-modal');
    if (!modal) return;
    const isOpen = isWorkbenchMobileLayout() && Boolean(AppState.mobileSettingsModal);
    modal.classList.toggle('hidden', !isOpen);
    modal.classList.toggle('flex', isOpen);
    document.getElementById('mobile-name-panel')?.classList.toggle('hidden', AppState.mobileSettingsModal !== 'name');
    document.getElementById('mobile-scheme-panel')?.classList.toggle('hidden', AppState.mobileSettingsModal !== 'scheme');

    const nameInput = document.getElementById('mobile-pattern-name-input');
    if (nameInput && document.activeElement !== nameInput) {
        nameInput.value = AppState.patternName || '';
    }

    const brandOptions = document.getElementById('mobile-brand-options');
    if (brandOptions) {
        const brands = ['mard', 'perler', 'hama', 'artkal'];
        brandOptions.innerHTML = brands.map((brand) => {
            const active = AppState.brand === brand;
            return `<button type="button" data-mobile-brand="${brand}" class="py-3 rounded-2xl text-sm font-bold border ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-700 border-gray-100'}">${getBrandLabel(brand)}</button>`;
        }).join('');
    }

    const setWrap = document.getElementById('mobile-mard-set-options-wrap');
    if (setWrap) setWrap.classList.toggle('hidden', AppState.brand !== 'mard');
    const setOptions = document.getElementById('mobile-mard-set-options');
    if (setOptions) {
        const sets = [264, 221, 216, 144, 120, 96, 72, 48, 24];
        setOptions.innerHTML = sets.map((set) => {
            const active = Number(AppState.mardSet) === set;
            return `<button type="button" data-mobile-mard-set="${set}" class="py-3 rounded-2xl text-sm font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-700 border-gray-100'}">${set}色</button>`;
        }).join('');
    }
}

export function openMobileSettingsModal(type) {
    if (!isWorkbenchMobileLayout() || !['name', 'scheme'].includes(type)) return false;
    AppState.mobileSettingsModal = type;
    updateWorkbenchUI();
    if (type === 'name') {
        window.setTimeout(() => document.getElementById('mobile-pattern-name-input')?.focus(), 30);
    }
    return true;
}

export function closeMobileSettingsModal() {
    AppState.mobileSettingsModal = null;
    updateWorkbenchUI();
}

export function applyMobilePatternName() {
    const input = document.getElementById('mobile-pattern-name-input');
    AppState.patternName = input?.value || '';
    closeMobileSettingsModal();
}

export function selectMobileBrand(brand) {
    if (!['mard', 'perler', 'hama', 'artkal'].includes(brand)) return;
    AppState.brand = brand;
    syncBrandControls();
    updateWorkbenchUI();
}

export function selectMobileMardSet(value) {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    AppState.mardSet = nextValue;
    syncBrandControls();
    updateWorkbenchUI();
}

const WORKBENCH_CURSORS = {
    eyedropper: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23111827%22 stroke-width=%222.4%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M14.5 4.5 19.5 9.5%22 stroke=%22white%22 stroke-width=%224.8%22/%3E%3Cpath d=%22M14.5 4.5 19.5 9.5%22/%3E%3Cpath d=%22M13 6 18 11 9.5 19.5 5 21 6.5 16.5 15 8%22 fill=%22white%22/%3E%3Cpath d=%22M13 6 18 11 9.5 19.5 5 21 6.5 16.5 15 8%22/%3E%3C/svg%3E") 5 20, crosshair',
    brush: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23111827%22 stroke-width=%222.4%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M15 4 20 9%22 stroke=%22white%22 stroke-width=%224.8%22/%3E%3Cpath d=%22M15 4 20 9 12 17 7 12 15 4Z%22 fill=%22white%22/%3E%3Cpath d=%22M15 4 20 9 12 17 7 12 15 4Z%22/%3E%3Cpath d=%22M7 12C4.8 12.6 3.8 14.2 4 17.2 5.7 16.2 7.1 16.1 8.5 16.9%22 fill=%22white%22/%3E%3Cpath d=%22M7 12C4.8 12.6 3.8 14.2 4 17.2 5.7 16.2 7.1 16.1 8.5 16.9%22/%3E%3C/svg%3E") 5 20, crosshair',
    eraser: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23111827%22 stroke-width=%222.4%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M7 15 14 8 20 14 13 21H7L4 18 7 15Z%22 fill=%22white%22/%3E%3Cpath d=%22M7 15 14 8 20 14 13 21H7L4 18 7 15Z%22/%3E%3Cpath d=%22M10 12 16 18%22/%3E%3C/svg%3E") 5 20, crosshair'
};

const PATTERN_PREVIEW_STYLES = {
    original: {
        label: '原图',
        contrast: 0,
        sharpen: 0,
        dominant: 50,
        precisionMode: 'high',
        colorMatchMode: 'deltae',
        dithering: true
    },
    cartoon: {
        label: '卡通',
        contrast: 32,
        sharpen: 80,
        dominant: 88,
        precisionMode: 'high',
        colorMatchMode: 'deltae',
        dithering: false
    },
    photo: {
        label: '照片',
        contrast: 4,
        sharpen: 8,
        dominant: 22,
        precisionMode: 'high',
        colorMatchMode: 'deltae',
        dithering: true
    }
};

function setCursor(id, cursor) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cursor = cursor || '';
}

function getResultCanvasCursor() {
    if (!hasWorkbenchPattern()) return '';
    if (AppState.deleteMode || AppState.clearBaseMode) return WORKBENCH_CURSORS.eraser;
    if (AppState.fillMode) {
        if (AppState.fillColor) return WORKBENCH_CURSORS.brush;
        return WORKBENCH_CURSORS.eyedropper;
    }
    if (AppState.edgeSelectionMode) return 'crosshair';
    if (AppState.editMode === 'adjust') return WORKBENCH_CURSORS.eyedropper;
    return '';
}

function updateWorkbenchCursors(compareVisible = false) {
    setCursor('result-canvas', getResultCanvasCursor());
    const originalPickerActive = AppState.fillMode && compareVisible;
    const compareCursor = AppState.comparePreviewDragging
        ? 'grabbing'
        : originalPickerActive
            ? WORKBENCH_CURSORS.eyedropper
            : '';
    setCursor('compare-source-frame', compareCursor);
    setCursor('compare-source-preview', compareCursor);
    setCursor('source-canvas', AppState.isBgRemoving ? WORKBENCH_CURSORS.eraser : '');
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
    const gridWidth = AppState.pendingGridWidth || AppState.gridWidth;
    const gridHeight = AppState.pendingGridHeight || AppState.gridHeight;
    return `${gridWidth}x${gridHeight} · ${brand}${setText} · ${colorLimitText}`;
}

function getPaletteTitle() {
    if (AppState.brand === 'mard') return `MARD ${AppState.mardSet} 色`;
    return (AppState.brand || 'perler').toUpperCase();
}

function getPaletteTextColor(color) {
    const yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
    return yiq >= 145 ? '#111827' : '#ffffff';
}

function getPaletteGroupKey(color) {
    const id = String(color.id || '').trim();
    const match = id.match(/[A-Za-z]/);
    return match ? match[0].toUpperCase() : '#';
}

function getPaletteColorButtonHtml(color) {
    const selected = String(AppState.highlightedColorId || '') === String(color.id);
    const textColor = getPaletteTextColor(color);
    return `
        <button type="button" data-palette-color-id="${color.id}"
            class="h-10 flex items-center justify-between gap-2 px-2 rounded-full border ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'} bg-white text-[11px] font-bold font-mono active:scale-95 transition"
            title="${color.id} · RGB(${color.r}, ${color.g}, ${color.b})"
            style="color: #242935;">
            <span class="palette-used-color-chip" style="background-color: rgb(${color.r},${color.g},${color.b}); color: ${textColor};"><span>${color.id}</span><span class="opacity-75 font-normal">${color.count ? `(${color.count})` : ''}</span></span>
            <span class="palette-row-actions"><span role="button" tabindex="0" data-palette-action="pick" aria-label="吸色替换"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 3 2 2-9.5 9.5-3 1 1-3L19 3Z"/><path d="m14 6 4 4M5 19h4"/></svg></span><span role="button" tabindex="0" data-palette-action="secondary" aria-label="其他颜色操作"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h5v5H5zM14 4h5v5h-5zM5 15h5v5H5zM14 15h5v5h-5z"/><path d="M10 6.5h4M10 17.5h4M6.5 10v5M17.5 10v5"/></svg></span></span>
        </button>
    `;
}

function applyPalettePanelPosition(panel) {
    const position = AppState.palettePanelPosition;
    if (!position) {
        panel.style.left = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';
        panel.style.transform = '';
        return;
    }

    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
}

function resetPalettePanelPosition() {
    AppState.palettePanelPosition = null;
    AppState.palettePanelDrag = null;
}

const WORKBENCH_DRAFTS_DB = 'perler_beads_workbench_drafts_db';
const WORKBENCH_DRAFTS_STORE = 'drafts';

function hasWorkbenchPattern() {
    return Array.isArray(AppState.pixelData)
        && AppState.pixelData.length === AppState.gridWidth * AppState.gridHeight
        && AppState.pixelData.length > 0;
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
    toggleBtn?.setAttribute('aria-expanded', String(shouldShow));
    if (!shouldShow) return;
    applyPalettePanelPosition(panel);

    const query = (AppState.palettePanelQuery || '').trim().toLowerCase();
    const source = AppState.stagedPixelData || AppState.pixelData;
    const usedColors = new Map();
    (Array.isArray(source) ? source : []).forEach((pixel) => {
        if (!pixel || pixel.id === 'NONE') return;
        const existing = usedColors.get(String(pixel.id));
        if (existing) existing.count += 1;
        else usedColors.set(String(pixel.id), { ...pixel, count: 1 });
    });
    const palette = [...usedColors.values()].sort((a, b) => b.count - a.count || String(a.id).localeCompare(String(b.id)));
    const filtered = query
        ? palette.filter((color) => String(color.id).toLowerCase().includes(query))
        : palette;

    const totalUsed = palette.reduce((total, color) => total + color.count, 0);
    summary.textContent = `${palette.length}色 · ${totalUsed}颗`;
    if (searchInput && searchInput.value !== AppState.palettePanelQuery) {
        searchInput.value = AppState.palettePanelQuery;
    }

    grid.innerHTML = filtered.length
        ? filtered.map(getPaletteColorButtonHtml).join('')
        : '<p class="col-span-full py-8 text-center text-xs text-gray-400">当前图纸未使用匹配颜色</p>';
}

export function togglePalettePanel() {
    if (!hasWorkbenchPattern()) return;
    AppState.palettePanelOpen = !AppState.palettePanelOpen;
    if (AppState.palettePanelOpen) AppState.allColorsPanelOpen = false;
    renderPalettePanel();
    renderAllColorsPanel();
}

export function closePalettePanel() {
    AppState.palettePanelOpen = false;
    AppState.palettePanelDrag = null;
    renderPalettePanel();
}

function getAllColorsButtonHtml(color) {
    const textColor = getPaletteTextColor(color);
    const selected = String(AppState.fillColorId || '') === String(color.id);
    return `<button type="button" data-all-color-id="${color.id}" class="all-colors-swatch ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}" title="${color.id} · RGB(${color.r}, ${color.g}, ${color.b})" style="background-color: rgb(${color.r}, ${color.g}, ${color.b}); color: ${textColor};">${color.id}</button>`;
}

function positionAllColorsPanel(panel, toggleBtn) {
    if (!toggleBtn) return;
    const toggleRect = toggleBtn.getBoundingClientRect();
    const gap = 12;
    const panelHeight = panel.getBoundingClientRect().height;
    const centerX = toggleRect.left + toggleRect.width / 2;
    const top = toggleRect.top - panelHeight - gap;
    panel.style.setProperty('position', 'fixed', 'important');
    panel.style.setProperty('left', `${centerX}px`, 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('transform', 'translateX(-50%)', 'important');
    if (top >= 12) {
        panel.style.setProperty('top', `${top}px`, 'important');
        panel.style.setProperty('bottom', 'auto', 'important');
    } else {
        panel.style.setProperty('top', '12px', 'important');
        panel.style.setProperty('bottom', 'auto', 'important');
    }
}

function renderAllColorsPanel() {
    if (!isWorkbenchLayout()) return;
    const panel = document.getElementById('all-colors-panel');
    const grid = document.getElementById('all-colors-grid');
    const summary = document.getElementById('all-colors-panel-summary');
    const searchInput = document.getElementById('all-colors-search-input');
    const toggleBtn = document.getElementById('toggle-all-colors-panel-btn');
    if (!panel || !grid || !summary) return;

    const shouldShow = hasWorkbenchPattern() && AppState.allColorsPanelOpen;
    panel.classList.toggle('hidden', !shouldShow);
    toggleBtn?.classList.toggle('is-active', shouldShow);
    toggleBtn?.setAttribute('aria-expanded', String(shouldShow));
    if (!shouldShow) return;

    const query = (AppState.allColorsPanelQuery || '').trim().toLowerCase();
    const palette = getCurrentPalette().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const filtered = query
        ? palette.filter((color) => String(color.id).toLowerCase().includes(query))
        : palette;
    summary.textContent = `${getPaletteTitle()} · ${palette.length} 色`;
    if (searchInput && searchInput.value !== AppState.allColorsPanelQuery) {
        searchInput.value = AppState.allColorsPanelQuery;
    }
    grid.innerHTML = filtered.length
        ? filtered.map(getAllColorsButtonHtml).join('')
        : '<p class="col-span-full py-8 text-center text-xs text-gray-400">未找到匹配颜色</p>';
    positionAllColorsPanel(panel, toggleBtn);
    requestAnimationFrame(() => {
        if (AppState.allColorsPanelOpen) positionAllColorsPanel(panel, toggleBtn);
    });

    let suppressAllColorsClickUntil = 0;
    grid.querySelectorAll('button[data-all-color-id]').forEach((button) => {
        const selectColor = (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleAllColorsSelect(button.dataset.allColorId);
        };
        button.onpointerdown = (event) => {
            suppressAllColorsClickUntil = Date.now() + 600;
            selectColor(event);
        };
        button.onclick = (event) => {
            if (Date.now() < suppressAllColorsClickUntil) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            selectColor(event);
        };
    });
}

export function toggleAllColorsPanel() {
    if (!hasWorkbenchPattern()) return;
    AppState.allColorsPanelOpen = !AppState.allColorsPanelOpen;
    if (AppState.allColorsPanelOpen) {
        AppState.palettePanelOpen = false;
        AppState.editor.activeTool = 'palette';
    }
    updateWorkbenchUI();
}

export function closeAllColorsPanel() {
    AppState.allColorsPanelOpen = false;
    if (AppState.editor.activeTool === 'palette') AppState.editor.activeTool = 'brush';
    document.getElementById('toggle-all-colors-panel-btn')?.classList.remove('is-active');
    document.getElementById('toggle-all-colors-panel-btn')?.setAttribute('aria-expanded', 'false');
    renderAllColorsPanel();
}

export function updateAllColorsPanelQuery(value) {
    AppState.allColorsPanelQuery = value || '';
    renderAllColorsPanel();
}

export function handleAllColorsSelect(colorId) {
    const color = getCurrentPalette().find((item) => String(item.id) === String(colorId));
    if (!color) return false;
    AppState.allColorsPanelOpen = false;
    AppState.palettePanelOpen = false;
    AppState.editor.activeTool = 'brush';
    _selectPaletteFillColor(color);
    updateWorkbenchUI();
    return true;
}

export function updatePalettePanelQuery(value) {
    AppState.palettePanelQuery = value || '';
    renderPalettePanel();
}

export function handlePaletteColorSelect(colorId) {
    const color = getCurrentPalette().find((item) => String(item.id) === String(colorId));
    if (!color) return false;
    AppState.highlightedColorId = String(color.id);
    const canvas = document.getElementById('result-canvas');
    if (canvas) renderResult(canvas, AppState.stagedPixelData || AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    updateWorkbenchUI();
    return true;
}

export function handlePaletteAction(colorId, action) {
    if (action !== 'pick') return false;
    const color = getCurrentPalette().find((item) => String(item.id) === String(colorId));
    if (!color) return false;
    AppState.highlightedColorId = String(color.id);
    _startPaletteBatchReplace(color.id);
    const canvas = document.getElementById('result-canvas');
    if (canvas) renderResult(canvas, AppState.stagedPixelData || AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    updateWorkbenchUI();
    return true;
}

export function handleRecentColorSelect(index) {
    const color = AppState.recentColors?.[index];
    if (!color) return false;
    _selectPaletteFillColor(color);
    AppState.palettePanelOpen = false;
    updateWorkbenchUI();
    return true;
}

function syncRecentColorChips() {
    const colors = Array.isArray(AppState.recentColors) ? AppState.recentColors : [];
    const currentId = AppState.fillColorId;
    if (currentId && AppState.lastRecentColorId !== currentId) {
        const current = getCurrentPalette().find((color) => String(color.id) === String(currentId));
        if (current) {
            AppState.recentColors = [current, ...colors.filter((color) => String(color.id) !== String(current.id))].slice(0, 3);
            AppState.lastRecentColorId = currentId;
        }
    }

    document.querySelectorAll('[data-recent-color]').forEach((button) => {
        const color = AppState.recentColors?.[Number(button.dataset.recentColor)];
        button.classList.toggle('is-empty', !color);
        button.classList.toggle('is-current', Boolean(color && String(color.id) === String(currentId)));
        button.textContent = color?.id || '';
        button.title = color ? `${color.id} · 选择颜色` : '暂无颜色';
        if (color) {
            button.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
            button.style.color = getPaletteTextColor(color);
        } else {
            button.style.backgroundColor = '';
            button.style.color = '';
        }
    });
}

function syncEditorToolVisualState() {
    const tool = AppState.editor?.activeTool || 'brush';
    const toolButton = document.getElementById('toggle-fill-btn');
    const eraserButton = document.getElementById('toggle-delete-btn');
    const buttons = {
        brush: {
            button: toolButton,
            label: '画笔工具',
            viewBox: '0 0 16 16',
            icon: '<path d="M6.6666 2H5.3333M10.0046 3.3389l2.658 2.6573M13.3333 10v2.6667M14.1161 4.5417a1.3333 1.3333 0 0 0-1.8824-1.8824L2.5615 10.783a1.3333 1.3333 0 0 0-.3333.553l-.8807 2.901a.6667.6667 0 0 0 .8295.8295l2.902-0.88a1.3333 1.3333 0 0 0 .553-.3333zM14.6667 11.333H12M2.6667 3.333v2.6667M4 4.667H1.3333M6 1.333v1.333"/>'
        },
        bucket: {
            button: toolButton,
            label: '油漆桶',
            icon: '<path d="m7 3 10 10M5 6l5-3 7 7-3 5-7-7 3-5"/><path d="M17 16c0 2-1.3 3-3 3s-3-1-3-3c0-1.6 3-4 3-4s3 2.4 3 4Z"/>'
        },
        edge: {
            button: toolButton,
            label: '边框上色',
            icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v3M12 4v3M16 4v3M8 17v3M12 17v3M16 17v3M4 8h3M4 12h3M4 16h3M17 8h3M17 12h3M17 16h3"/>'
        },
        eraser: {
            button: eraserButton,
            label: '橡皮工具',
            viewBox: '0 0 16 16',
            icon: '<path d="M13.9999 14H5.33321C5.15741 14.0004 4.98327 13.9661 4.8208 13.8989C4.65833 13.8318 4.51075 13.7331 4.38654 13.6087L1.72388 10.9427C1.47392 10.6927 1.3335 10.3536 1.3335 10C1.3335 9.6465 1.47392 9.30742 1.72388 9.05738L8.39055 2.39072C8.51436 2.26685 8.66137 2.16859 8.82318 2.10155C8.98498 2.03451 9.1584 2 9.33354 2C9.50869 2 9.68211 2.03451 9.84391 2.10155C10.0057 2.16859 10.1527 2.26685 10.2765 2.39072L14.2759 6.39072C14.5258 6.64075 14.6663 6.97983 14.6663 7.33338C14.6663 7.68693 14.5258 8.02601 14.2759 8.27605L8.55588 14M3.38794 7.39355L9.27327 13.2789"/>'
        },
        'area-erase': {
            button: eraserButton,
            label: '区域擦除',
            icon: '<path d="M4 4h16v16H4z"/><path d="M8 8h8v8H8z"/><path d="m4 4 4 4M20 4l-4 4M4 20l4-4M20 20l-4-4"/>'
        },
        'color-eraser': {
            button: eraserButton,
            label: '按颜色擦除',
            icon: '<path d="m7 16 8.5-8.5a2.12 2.12 0 0 1 3 0l1 1a2.12 2.12 0 0 1 0 3L11 20H6l-3-3 4-4Z"/><path d="M15 15h5M17.5 12.5v5"/>'
        }
    };
    [toolButton, eraserButton].forEach((button) => {
        if (!button) return;
        button.dataset.activeTool = tool;
        button.classList.toggle('is-active', button === buttons[tool]?.button);
        button.style.backgroundColor = '';
    });
    const renderButton = (button, definition) => {
        if (!button || !definition) return;
        const caret = button.querySelector('.workbench-tool-caret')?.outerHTML || '';
        button.innerHTML = `<svg viewBox="${definition.viewBox || '0 0 24 24'}" aria-hidden="true">${definition.icon}</svg>${caret}`;
        button.setAttribute('aria-label', definition.label);
        button.title = definition.label;
    };
    renderButton(toolButton, buttons[tool] && buttons[tool].button === toolButton ? buttons[tool] : buttons.brush);
    renderButton(eraserButton, buttons[tool] && buttons[tool].button === eraserButton ? buttons[tool] : buttons.eraser);
    document.querySelectorAll('[data-tool-action]').forEach((menuButton) => {
        menuButton.classList.toggle('is-active', menuButton.dataset.toolAction === tool);
    });
}

export function startPalettePanelDrag(event) {
    const panel = document.getElementById('palette-panel');
    if (!panel || !AppState.palettePanelOpen) return false;
    if (event.target.closest('button, input, select, textarea')) return false;

    const rect = panel.getBoundingClientRect();
    const stage = document.getElementById('workbench-stage');
    const stageRect = stage?.getBoundingClientRect();
    const point = event.touches && event.touches[0] ? event.touches[0] : event;
    if (!stageRect || typeof point.clientX !== 'number') return false;

    AppState.palettePanelDrag = {
        startX: point.clientX,
        startY: point.clientY,
        originX: rect.left,
        originY: rect.top
    };
    AppState.palettePanelPosition = { x: rect.left - stageRect.left, y: rect.top - stageRect.top };
    applyPalettePanelPosition(panel);
    return true;
}

export function movePalettePanelDrag(event) {
    const drag = AppState.palettePanelDrag;
    if (!drag) return false;

    const panel = document.getElementById('palette-panel');
    const stage = document.getElementById('workbench-stage');
    const point = event.touches && event.touches[0] ? event.touches[0] : event;
    if (!panel || !stage || typeof point.clientX !== 'number') return false;

    const stageRect = stage.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const padding = 12;
    const maxX = Math.max(padding, stageRect.width - panelRect.width - padding);
    const maxY = Math.max(padding, stageRect.height - panelRect.height - padding);
    const nextX = Math.min(Math.max(drag.originX - stageRect.left + point.clientX - drag.startX, padding), maxX);
    const nextY = Math.min(Math.max(drag.originY - stageRect.top + point.clientY - drag.startY, padding), maxY);

    AppState.palettePanelPosition = { x: nextX, y: nextY };
    applyPalettePanelPosition(panel);
    return true;
}

export function endPalettePanelDrag() {
    if (!AppState.palettePanelDrag) return false;
    AppState.palettePanelDrag = null;
    return true;
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
        patternName: draft.patternName || draft.name || '',
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

    const hasPattern = hasWorkbenchPattern();
    const isMobileTopBar = AppState.workbenchViewportMode === 'mobile' && hasPattern;
    saveBtn.disabled = false;
    saveBtn.classList.toggle('opacity-40', false);
    saveBtn.classList.toggle('cursor-not-allowed', false);

    const drafts = Array.isArray(AppState.drafts) ? AppState.drafts : [];
    const draftLabel = hasPattern
        ? (isMobileTopBar ? `草稿（${drafts.length}）` : `保存为草稿（${drafts.length}）`)
        : `草稿箱（${drafts.length}）`;
    saveBtn.innerHTML = `<svg class="draft-save-icon" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.88333 0.75C9.23503 0.755009 9.57049 0.898781 9.81667 1.15L12.35 3.68333C12.6012 3.92951 12.745 4.26497 12.75 4.61667V11.4167C12.75 11.7703 12.6095 12.1094 12.3595 12.3595C12.1094 12.6095 11.7703 12.75 11.4167 12.75H2.08333C1.72971 12.75 1.39057 12.6095 1.14052 12.3595C0.890476 12.1094 0.75 11.7703 0.75 11.4167V2.08333C0.75 1.72971 0.890476 1.39057 1.14052 1.14052C1.39057 0.890476 1.72971 0.75 2.08333 0.75H8.88333Z"/><path d="M10.0833 12.7503V8.08366C10.0833 7.90685 10.0131 7.73728 9.88803 7.61225C9.76301 7.48723 9.59344 7.41699 9.41663 7.41699H4.08329C3.90648 7.41699 3.73691 7.48723 3.61189 7.61225C3.48686 7.73728 3.41663 7.90685 3.41663 8.08366V12.7503"/><path d="M3.41663 0.75V3.41667C3.41663 3.59348 3.48686 3.76305 3.61189 3.88807C3.73691 4.0131 3.90648 4.08333 4.08329 4.08333H8.74996"/></svg><span class="draft-save-label">${draftLabel}</span>`;
    drawer.classList.toggle('hidden', !AppState.draftDrawerOpen);
    toggleBtn.innerHTML = '<svg class="draft-toggle-caret" viewBox="0 0 5 3" aria-hidden="true"><path d="M4.5 2.5L2.5 0.5L0.5 2.5"/></svg>';
    toggleBtn.classList.toggle('is-open', AppState.draftDrawerOpen);
    toggleBtn.setAttribute('aria-label', AppState.draftDrawerOpen ? '收起草稿列表' : '展开草稿列表');
    toggleBtn.classList.toggle('hidden', !hasPattern);
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
                    <input id="draft-name-${escapeHtml(draft.id)}" name="draft-name" type="text" autocomplete="off"
                        data-draft-action="rename" data-draft-id="${draft.id}" value="${escapeHtml(draft.name)}"
                        class="w-full bg-transparent text-sm font-bold text-gray-800 truncate border border-transparent rounded-lg px-1 py-0.5 focus:bg-white focus:border-primary focus:outline-none">
                    <div class="text-xs text-gray-500 mt-1">${buildDraftSummary(draft)}</div>
                    <div class="text-[11px] text-gray-400 mt-1">${getDraftTimestampLabel(draft.updatedAt)}</div>
                    <div class="flex items-center gap-2 mt-2">
                        <button type="button" data-draft-action="restore" data-draft-id="${draft.id}" class="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary">恢复</button>
                        <button type="button" data-draft-action="export" data-draft-id="${draft.id}" class="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary">导出</button>
                        <button type="button" data-draft-action="delete" data-draft-id="${draft.id}" class="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-500 hover:border-red-300 hover:text-red-500">删除</button>
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
    const patternName = String(AppState.patternName || '').trim();
    const draft = {
        id: `draft_${Date.now()}`,
        name: patternName || getNextDraftName(),
        patternName,
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

export function exportWorkbenchDraft(draftId) {
    const draft = (AppState.drafts || []).find((item) => item.id === draftId);
    if (!draft) return;
    downloadJsonFile({
        type: 'perler-beads-workbench-draft',
        version: 1,
        exportedAt: new Date().toISOString(),
        ...draft
    }, makeDraftFileName(draft.name || 'perler-beads-draft', 'draft'));
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

    if (!isValidDraftPayload(draft)) {
        window.alert('恢复失败：草稿数据不完整。');
        return;
    }

    AppState.gridWidth = Number(draft.gridWidth);
    AppState.gridHeight = Number(draft.gridHeight);
    AppState.pendingGridWidth = null;
    AppState.pendingGridHeight = null;
    AppState.patternName = draft.patternName || draft.name || '';
    AppState.brand = draft.brand || 'mard';
    AppState.mardSet = draft.mardSet || 221;
    AppState.pixelArtData = null;
    AppState.pixelData = deepClonePixels(draft.pixelData);
    AppState.generatedPixelData = deepClonePixels(draft.pixelData);
    AppState.stagedPixelData = null;
    AppState.stagedActions = [];
    AppState.cropRect = draft.cropRect ? { ...draft.cropRect } : AppState.cropRect;
    AppState.cropInteraction = null;
    AppState.bgRemovalSelection = null;
    AppState.isBgRemoving = false;
    AppState.highlightedColorId = null;
    AppState.editMode = 'none';
    AppState.adjustPhase = 'waiting_receiver';
    AppState.receiverIndex = null;
    AppState.deleteMode = false;
    AppState.edgeSelectionMode = false;
    AppState.clearBaseMode = false;
    AppState.fillMode = false;
    AppState.fillSourceMode = 'canvas';
    AppState.fillColor = null;
    AppState.fillColorId = null;
    AppState.fillSourceIndex = null;
    AppState.fillSourceSample = null;
    AppState.fillSelection = null;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    resetPalettePanelPosition();
    AppState.qualityIssues = [];
    AppState.qualityOverlayVisible = false;
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
    AppState.workbenchTabletPanel = null;
    AppState.workbenchToolbarCollapsed = false;
    AppState.draftDrawerOpen = false;
    resetBatchReplaceState();

    const gridSizeSlider = document.getElementById('grid-size-slider');
    if (gridSizeSlider) {
        gridSizeSlider.value = String(Math.max(AppState.gridWidth, AppState.gridHeight));
    }
    const brandSelect = document.getElementById('brand-select');
    if (brandSelect) brandSelect.value = AppState.brand;
    const mardSetSelect = document.getElementById('mard-set-select');
    if (mardSetSelect) mardSetSelect.value = String(AppState.mardSet);
    const patternNameInput = document.getElementById('pattern-name-input');
    if (patternNameInput) patternNameInput.value = AppState.patternName;

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
            restoredImage.onerror = () => {
                AppState.image = null;
                AppState.originalImageData = null;
                AppState.history = [];
                goToStep(3);
            };
            restoredImage.src = draft.sourceImageDataUrl;
            return;
        }
        if (!draft.sourceImageDataUrl) {
            AppState.image = null;
            AppState.originalImageData = null;
            AppState.history = [];
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
    draft.patternName = trimmedName;
    draft.updatedAt = new Date().toISOString();
    await upsertWorkbenchDraft(draft);
    AppState.drafts = [...(AppState.drafts || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    renderDraftBox();
}

export function toggleDraftDrawer() {
    AppState.draftDrawerOpen = !AppState.draftDrawerOpen;
    updateWorkbenchUI();
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

function colorDistanceSq(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return dr * dr + dg * dg + db * db;
}

function getImageDataColor(data, width, x, y) {
    const index = (y * width + x) * 4;
    return {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
        a: data[index + 3]
    };
}

function getPixelLuminance(data, width, x, y) {
    const index = (y * width + x) * 4;
    return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
}

function padCropRect(rect, width, height, ratio = 0.04) {
    if (!rect) return null;
    const padding = Math.max(1, Math.round(Math.max(rect.width, rect.height) * ratio));
    return normalizeCropRect({
        x: rect.x - padding,
        y: rect.y - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
    }, width, height);
}

function detectEdgeCropRect(data, width, height) {
    const scores = [];
    const step = Math.max(1, Math.floor(Math.max(width, height) / 360));
    let sum = 0;
    let sumSq = 0;

    for (let y = step; y < height - step; y += step) {
        for (let x = step; x < width - step; x += step) {
            const centerIndex = (y * width + x) * 4;
            if (data[centerIndex + 3] < 24) continue;
            const lx = Math.abs(getPixelLuminance(data, width, x + step, y) - getPixelLuminance(data, width, x - step, y));
            const ly = Math.abs(getPixelLuminance(data, width, x, y + step) - getPixelLuminance(data, width, x, y - step));
            const score = lx + ly;
            scores.push({ x, y, score });
            sum += score;
            sumSq += score * score;
        }
    }

    if (scores.length < 16) return null;
    const mean = sum / scores.length;
    const variance = Math.max(0, sumSq / scores.length - mean * mean);
    const threshold = Math.max(42, mean + Math.sqrt(variance) * 2.2);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let hitCount = 0;

    for (const point of scores) {
        if (point.score < threshold) continue;
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
        hitCount++;
    }

    if (hitCount < Math.max(12, scores.length * 0.002)) return null;
    const rect = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
    if (rect.width < width * 0.08 || rect.height < height * 0.08) return null;
    if (rect.width >= width * 0.96 && rect.height >= height * 0.96) return null;
    return padCropRect(rect, width, height, 0.06);
}

function mixColor(a, b, ratio) {
    return {
        r: a.r + (b.r - a.r) * ratio,
        g: a.g + (b.g - a.g) * ratio,
        b: a.b + (b.b - a.b) * ratio
    };
}

function getBorderAverageColor(data, width, height, side, index, radius) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    const half = Math.max(1, Math.floor(radius / 2));

    for (let offset = -half; offset <= half; offset++) {
        let x = 0;
        let y = 0;
        if (side === 'left' || side === 'right') {
            x = side === 'left' ? 0 : width - 1;
            y = clamp(index + offset, 0, height - 1);
        } else {
            x = clamp(index + offset, 0, width - 1);
            y = side === 'top' ? 0 : height - 1;
        }
        const color = getImageDataColor(data, width, x, y);
        if (color.a < 24) continue;
        sumR += color.r;
        sumG += color.g;
        sumB += color.b;
        count++;
    }

    if (!count) return { r: 0, g: 0, b: 0 };
    return {
        r: sumR / count,
        g: sumG / count,
        b: sumB / count
    };
}

function detectBorderModeledCropRect(data, width, height) {
    const step = Math.max(1, Math.floor(Math.max(width, height) / 420));
    const borderRadius = Math.max(3, Math.round(Math.min(width, height) * 0.015));
    const threshold = 34 * 34;
    const rowLeft = new Array(height);
    const rowRight = new Array(height);
    const colTop = new Array(width);
    const colBottom = new Array(width);
    for (let y = 0; y < height; y += step) {
        rowLeft[y] = getBorderAverageColor(data, width, height, 'left', y, borderRadius);
        rowRight[y] = getBorderAverageColor(data, width, height, 'right', y, borderRadius);
    }
    for (let x = 0; x < width; x += step) {
        colTop[x] = getBorderAverageColor(data, width, height, 'top', x, borderRadius);
        colBottom[x] = getBorderAverageColor(data, width, height, 'bottom', x, borderRadius);
    }
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let hitCount = 0;

    for (let y = 0; y < height; y += step) {
        const left = rowLeft[y];
        const right = rowRight[y];
        const yRatio = height > 1 ? y / (height - 1) : 0;

        for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4;
            if (data[index + 3] < 24) continue;
            const top = colTop[x];
            const bottom = colBottom[x];
            const xRatio = width > 1 ? x / (width - 1) : 0;
            const horizontalBg = mixColor(left, right, xRatio);
            const verticalBg = mixColor(top, bottom, yRatio);
            const background = {
                r: (horizontalBg.r + verticalBg.r) / 2,
                g: (horizontalBg.g + verticalBg.g) / 2,
                b: (horizontalBg.b + verticalBg.b) / 2
            };
            const distance = colorDistanceSq({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            }, background);
            if (distance < threshold) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            hitCount++;
        }
    }

    if (hitCount < Math.max(16, (width / step) * (height / step) * 0.003)) return null;
    const rect = {
        x: minX,
        y: minY,
        width: maxX - minX + step,
        height: maxY - minY + step
    };
    if (rect.width < width * 0.08 || rect.height < height * 0.08) return null;
    if (rect.width >= width * 0.96 && rect.height >= height * 0.96) return null;
    return padCropRect(rect, width, height, 0.025);
}

function detectInsetCropRect(data, width, height) {
    const step = Math.max(1, Math.floor(Math.max(width, height) / 420));
    const edgeBand = Math.max(2, Math.round(Math.min(width, height) * 0.025));
    const threshold = 38 * 38;
    const minRowHits = Math.max(3, Math.round((width / step) * 0.045));
    const minColHits = Math.max(3, Math.round((height / step) * 0.045));

    const rowHits = new Array(height).fill(0);
    const colHits = new Array(width).fill(0);

    for (let y = 0; y < height; y += step) {
        const left = getBorderAverageColor(data, width, height, 'left', y, edgeBand);
        const right = getBorderAverageColor(data, width, height, 'right', y, edgeBand);
        for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4;
            if (data[index + 3] < 24) continue;
            const background = mixColor(left, right, width > 1 ? x / (width - 1) : 0);
            const distance = colorDistanceSq({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            }, background);
            if (distance > threshold) {
                rowHits[y]++;
            }
        }
    }

    for (let x = 0; x < width; x += step) {
        const top = getBorderAverageColor(data, width, height, 'top', x, edgeBand);
        const bottom = getBorderAverageColor(data, width, height, 'bottom', x, edgeBand);
        for (let y = 0; y < height; y += step) {
            const index = (y * width + x) * 4;
            if (data[index + 3] < 24) continue;
            const background = mixColor(top, bottom, height > 1 ? y / (height - 1) : 0);
            const distance = colorDistanceSq({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            }, background);
            if (distance > threshold) {
                colHits[x]++;
            }
        }
    }

    const findStart = (hits, minHits) => {
        for (let i = 0; i < hits.length; i += step) {
            if (hits[i] >= minHits) return i;
        }
        return -1;
    };
    const findEnd = (hits, minHits) => {
        for (let i = hits.length - 1; i >= 0; i -= step) {
            if (hits[i] >= minHits) return i;
        }
        return -1;
    };

    const top = findStart(rowHits, minRowHits);
    const bottom = findEnd(rowHits, minRowHits);
    const left = findStart(colHits, minColHits);
    const right = findEnd(colHits, minColHits);
    if (top < 0 || bottom < 0 || left < 0 || right < 0) return null;

    const rect = {
        x: left,
        y: top,
        width: right - left + step,
        height: bottom - top + step
    };
    if (rect.width < width * 0.08 || rect.height < height * 0.08) return null;
    if (rect.width >= width * 0.96 && rect.height >= height * 0.96) return null;
    return padCropRect(rect, width, height, 0.025);
}

function detectTransparentCropRect(data, width, height) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let transparentCount = 0;
    let opaqueCount = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha <= 24) {
                transparentCount++;
                continue;
            }
            if (alpha < 245) transparentCount++;
            opaqueCount++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (opaqueCount < Math.max(32, width * height * 0.002)) return null;
    if (transparentCount < width * height * 0.01) return null;
    const rect = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
    if (rect.width >= width * 0.98 && rect.height >= height * 0.98) return null;
    return padCropRect(rect, width, height, 0.012);
}

function detectContentCropRect() {
    const sourceCanvas = document.getElementById('source-canvas');
    if (!sourceCanvas || !AppState.image) return null;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (!width || !height) return null;

    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const transparentRect = detectTransparentCropRect(data, width, height);
    if (transparentRect) return transparentRect;

    const corners = [
        getImageDataColor(data, width, 0, 0),
        getImageDataColor(data, width, width - 1, 0),
        getImageDataColor(data, width, 0, height - 1),
        getImageDataColor(data, width, width - 1, height - 1)
    ];
    const background = {
        r: Math.round(corners.reduce((sum, color) => sum + color.r, 0) / corners.length),
        g: Math.round(corners.reduce((sum, color) => sum + color.g, 0) / corners.length),
        b: Math.round(corners.reduce((sum, color) => sum + color.b, 0) / corners.length)
    };
    const backgroundAlpha = corners.reduce((sum, color) => sum + color.a, 0) / corners.length;
    const hasTransparentBackground = backgroundAlpha < 32;
    const cornerVariance = corners.reduce((sum, color) => sum + colorDistanceSq(color, background), 0) / corners.length;
    const backgroundThreshold = Math.max(28 * 28, cornerVariance * 3.5);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let hitCount = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const alpha = data[index + 3];
            const visibleByAlpha = hasTransparentBackground ? alpha > 24 : (alpha > 24 && alpha < 245);
            const visibleOpaque = alpha >= 245 && colorDistanceSq({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            }, background) > backgroundThreshold;
            if (!visibleByAlpha && !visibleOpaque) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            hitCount++;
        }
    }

    const fallbackRect = () => detectInsetCropRect(data, width, height) || detectBorderModeledCropRect(data, width, height) || detectEdgeCropRect(data, width, height);
    if (hitCount < Math.max(32, width * height * 0.002)) return fallbackRect();
    const detectedWidth = maxX - minX + 1;
    const detectedHeight = maxY - minY + 1;
    if (detectedWidth * detectedHeight >= width * height * 0.72 || detectedWidth >= width * 0.92 || detectedHeight >= height * 0.92) return fallbackRect();

    return padCropRect({
        x: minX,
        y: minY,
        width: detectedWidth,
        height: detectedHeight
    }, width, height, 0.02);
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
    const shouldShowMobileCrop = !isWorkbenchMobileLayout() || AppState.mobileSetupStep !== 'settings';
    const shouldShow = Boolean(AppState.image) && !hasPattern && !AppState.pixelArtData && shouldShowMobileCrop;
    setHidden('workbench-crop-overlay', !shouldShow);
    if (!overlay || !cropBox || !previewCanvas || !shouldShow) {
        updateCropSummary();
        return;
    }

    const rect = ensureCropRect();
    const scaleX = previewCanvas.clientWidth / previewCanvas.width;
    const scaleY = previewCanvas.clientHeight / previewCanvas.height;
    const overlayRect = overlay.getBoundingClientRect();
    const previewRect = previewCanvas.getBoundingClientRect();
    const previewLeft = previewRect.left - overlayRect.left;
    const previewTop = previewRect.top - overlayRect.top;
    cropBox.classList.remove('hidden');
    cropBox.style.left = `${previewLeft + rect.x * scaleX}px`;
    cropBox.style.top = `${previewTop + rect.y * scaleY}px`;
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
    const previewRect = previewCanvas.getBoundingClientRect();
    const localX = clamp(point.x - previewRect.left, 0, previewRect.width);
    const localY = clamp(point.y - previewRect.top, 0, previewRect.height);
    const imageX = Math.round((localX / previewRect.width) * previewCanvas.width);
    const imageY = Math.round((localY / previewRect.height) * previewCanvas.height);
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
    AppState.cropRect = detectContentCropRect() || getDefaultCropRect();
    updateGridDimensions();
}

export function autoFitWorkbenchCropRect() {
    if (!AppState.image) return false;
    const detected = detectContentCropRect();
    AppState.cropRect = detected || getDefaultCropRect();
    AppState.cropInteraction = null;
    updateGridDimensions();
    return Boolean(detected);
}

export function startWorkbenchCropInteraction(event) {
    if (!isWorkbenchLayout()) return;
    if (!AppState.image) return;
    const cropBox = document.getElementById('workbench-crop-box');
    const pointer = getCropPointerData(event);
    if (!pointer || !cropBox) return;
    const handle = event.target.closest('[data-crop-handle]')?.dataset.cropHandle;
    const isInsideBox = event.target === cropBox || cropBox.contains(event.target);
    const isMobileCropStep = isWorkbenchMobileLayout() && AppState.mobileSetupStep === 'crop';
    if (isMobileCropStep && !handle && !isInsideBox) return;
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
    const isMobileSettingsPreview = isWorkbenchMobileLayout() && AppState.mobileSetupStep === 'settings' && !hasWorkbenchPattern();
    const crop = isMobileSettingsPreview ? ensureCropRect() : null;
    const sourceWidth = crop ? crop.width : img.width;
    const sourceHeight = crop ? crop.height : img.height;
    const containerWidth = resultContainer.clientWidth || window.innerWidth;
    const containerHeight = resultContainer.clientHeight || window.innerHeight;
    const padding = isMobileSettingsPreview ? 24 : 96;
    const minPreviewSize = isMobileSettingsPreview ? 72 : 240;
    const maxWidth = Math.max(minPreviewSize, containerWidth - padding);
    const maxHeight = Math.max(minPreviewSize, containerHeight - padding);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
    const displayWidth = Math.max(1, Math.round(sourceWidth * scale));
    const displayHeight = Math.max(1, Math.round(sourceHeight * scale));

    previewCanvas.width = sourceWidth;
    previewCanvas.height = sourceHeight;
    previewCanvas.style.width = `${displayWidth}px`;
    previewCanvas.style.height = `${displayHeight}px`;
    previewCanvas.style.left = `${(containerWidth - displayWidth) / 2}px`;
    previewCanvas.style.top = `${(containerHeight - displayHeight) / 2}px`;

    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (crop) {
        ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    } else {
        ctx.drawImage(img, 0, 0);
    }
    renderWorkbenchCropOverlay();
}

function renderMobileSettingsThumbnail() {
    const card = document.getElementById('mobile-settings-preview-card');
    const canvas = document.getElementById('mobile-settings-thumbnail');
    const summary = document.getElementById('mobile-settings-thumbnail-summary');
    const shouldShow = isWorkbenchMobileLayout()
        && AppState.image
        && !hasWorkbenchPattern()
        && AppState.mobileSetupStep === 'settings';
    if (card) card.classList.toggle('hidden', !shouldShow);
    if (!shouldShow || !canvas || !AppState.image) return;

    const crop = ensureCropRect();
    const maxSize = 120;
    const scale = Math.min(maxSize / crop.width, maxSize / crop.height, 1);
    const width = Math.max(1, Math.round(crop.width * scale));
    const height = Math.max(1, Math.round(crop.height * scale));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(AppState.image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    if (summary) {
        const gridWidth = AppState.pendingGridWidth || AppState.gridWidth;
        const gridHeight = AppState.pendingGridHeight || AppState.gridHeight;
        summary.textContent = `${gridWidth}x${gridHeight} · 裁剪范围已确认`;
    }
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

function getWorkbenchGenerationSummary() {
    const brandLabel = AppState.brand === 'mard' ? `MARD ${AppState.mardSet}色` : AppState.brand.toUpperCase();
    const colorLimitToggle = document.getElementById('color-limit-toggle');
    const maxColorsSlider = document.getElementById('max-colors-slider');
    const colorText = colorLimitToggle?.checked ? `最多 ${maxColorsSlider?.value || 36} 色` : '不限颜色';
    return `${AppState.gridWidth} x ${AppState.gridHeight} · ${brandLabel} · ${colorText}`;
}

function renderPatternPreviewCanvas() {
    const canvas = document.getElementById('pattern-preview-canvas');
    const data = AppState.patternPreviewPixelData;
    if (!canvas || !Array.isArray(data) || !data.length) return;

    canvas.width = AppState.gridWidth;
    canvas.height = AppState.gridHeight;
    const layer = document.getElementById('pattern-preview-layer');
    const availableWidth = Math.max(240, (layer?.clientWidth || window.innerWidth) - 420);
    const availableHeight = Math.max(240, (layer?.clientHeight || window.innerHeight) - 64);
    const isNarrow = window.innerWidth < 1024;
    const maxWidth = isNarrow ? Math.max(240, window.innerWidth - 24) : availableWidth;
    const maxHeight = isNarrow ? Math.max(220, Math.floor(window.innerHeight * 0.55)) : availableHeight;
    const scale = Math.max(1, Math.floor(Math.min(maxWidth / AppState.gridWidth, maxHeight / AppState.gridHeight)));
    canvas.style.width = `${AppState.gridWidth * scale}px`;
    canvas.style.height = `${AppState.gridHeight * scale}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    data.forEach((pixel, index) => {
        if (!pixel || pixel.id === 'NONE' || pixel.a === 0) return;
        const x = index % AppState.gridWidth;
        const y = Math.floor(index / AppState.gridWidth);
        ctx.fillStyle = `rgb(${pixel.r},${pixel.g},${pixel.b})`;
        ctx.fillRect(x, y, 1, 1);
    });
}

function renderPatternPreviewLayer() {
    const visible = AppState.patternPreviewVisible && Array.isArray(AppState.patternPreviewPixelData);
    setHidden('pattern-preview-layer', !visible);
    if (!visible) return;

    setText('pattern-preview-summary', `${PATTERN_PREVIEW_STYLES[AppState.patternPreviewStyle]?.label || '预览'} · ${getWorkbenchGenerationSummary()}`);
    document.querySelectorAll('.pattern-preview-style-btn').forEach((btn) => {
        const active = btn.dataset.previewStyle === AppState.patternPreviewStyle;
        btn.classList.toggle('bg-primary', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('border-primary', active);
        btn.classList.toggle('shadow-sm', active);
    });
    renderPatternPreviewCanvas();
}

function buildPatternPreview(style = 'photo') {
    const config = PATTERN_PREVIEW_STYLES[style] || PATTERN_PREVIEW_STYLES.photo;
    const sourceImageData = getSourceImageDataForGeneration();
    const pixelArtData = generatePixelArtData({
        sourceImageData,
        gridWidth: AppState.gridWidth,
        gridHeight: AppState.gridHeight,
        precisionMode: config.precisionMode,
        contrast: config.contrast,
        sharpen: config.sharpen,
        dominant: config.dominant
    });
    const pixelData = mapPixelArtToBeads({
        sourceImageData: null,
        pixelArtData,
        gridWidth: AppState.gridWidth,
        gridHeight: AppState.gridHeight,
        brand: AppState.brand,
        mardSet: AppState.mardSet,
        isColorLimitEnabled: document.getElementById('color-limit-toggle').checked,
        maxColors: parseInt(document.getElementById('max-colors-slider').value),
        isDitheringEnabled: config.dithering,
        precisionMode: 'standard',
        colorMatchMode: config.colorMatchMode,
        palettes: PALETTES
    });

    AppState.patternPreviewStyle = style;
    AppState.patternPreviewPixelArtData = pixelArtData;
    AppState.patternPreviewPixelData = pixelData;
    AppState.patternPreviewVisible = true;
    renderPatternPreviewLayer();
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
    AppState.workbenchTabletPanel = AppState.workbenchTabletPanel === 'settings' ? null : 'settings';
    updateWorkbenchUI();
}

export function selectWorkbenchTabletPanel(panel) {
    if (!['settings', 'colors'].includes(panel)) return;
    AppState.workbenchTabletPanel = AppState.workbenchTabletPanel === panel ? null : panel;
    updateWorkbenchUI();
}

export function recropMobileWorkbenchImage() {
    if (!isWorkbenchLayout() || !AppState.image) return;
    AppState.mobileSetupStep = 'crop';
    AppState.pixelArtData = null;
    updateWorkbenchSourcePreview();
    updateWorkbenchUI();
}

export function removeWorkbenchImage() {
    if (!isWorkbenchLayout()) return;
    AppState.patternName = '';
    AppState.pendingGridWidth = null;
    AppState.pendingGridHeight = null;
    AppState.image = null;
    AppState.originalImageData = null;
    AppState.history = [];
    AppState.pixelData = [];
    AppState.pixelArtData = null;
    AppState.generatedPixelData = null;
    AppState.patternPreviewVisible = false;
    AppState.patternPreviewPixelData = null;
    AppState.patternPreviewPixelArtData = null;
    AppState.cropRect = null;
    AppState.cropInteraction = null;
    AppState.mobileSetupStep = 'crop';
    AppState.draftDrawerOpen = false;
    const sourceCanvas = document.getElementById('source-canvas');
    const sourceCtx = sourceCanvas?.getContext('2d');
    if (sourceCanvas && sourceCtx) {
        sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
        sourceCanvas.width = 0;
        sourceCanvas.height = 0;
    }
    updateWorkbenchUI();
}

function applyWorkbenchLayoutMode(hasPattern) {
    const layout = document.getElementById('workbench-layout');
    if (!layout) return;
    const viewportMode = getWorkbenchViewportMode();
    const activeShell = ensureWorkbenchShell(layout, viewportMode);
    mountWorkbenchSharedNodes(activeShell);
    const sidePanel = document.getElementById('workbench-side-panel');
    const topActions = document.getElementById('workbench-top-actions');
    const tabletTabs = document.getElementById('workbench-tablet-panel-tabs');
    const topDraftSlot = document.getElementById('workbench-top-draft-slot');
    const settingsPanel = document.getElementById('workbench-settings-panel');
    const settingsContent = document.getElementById('workbench-settings-content');
    const colorListPanel = document.getElementById('workbench-color-list-panel');
    const setupDraftSlot = document.getElementById('workbench-setup-draft-slot');
    const sideDraftSlot = document.getElementById('workbench-side-draft-slot');
    const draftActions = document.getElementById('workbench-draft-actions');
    const draftPrimaryControl = document.getElementById('draft-primary-control');
    const draftDrawer = document.getElementById('draft-drawer');
    if (!activeShell || !sidePanel || !setupDraftSlot || !sideDraftSlot || !draftActions) return;

    const isMobile = viewportMode === 'mobile';
    const isTablet = viewportMode === 'tablet';
    if (AppState.workbenchViewportMode !== viewportMode) {
        AppState.workbenchViewportMode = viewportMode;
        AppState.draftDrawerOpen = false;
        AppState.workbenchTabletPanel = null;
        AppState.palettePanelOpen = false;
        AppState.palettePanelPosition = null;
        AppState.palettePanelDrag = null;
        AppState.comparePreviewDragging = false;
    }
    const hasImage = Boolean(AppState.image);
    layout.dataset.mode = hasPattern ? 'editor' : 'setup';
    layout.dataset.viewport = viewportMode;
    layout.dataset.mobileStep = isMobile && hasImage && !hasPattern ? AppState.mobileSetupStep : '';
    layout.classList.toggle('draft-modal-open', AppState.draftDrawerOpen);
    activeShell.dataset.mode = hasPattern ? 'editor' : 'setup';
    if (hasPattern) {
        const editorDraftParent = topDraftSlot || sideDraftSlot;
        if (draftActions.parentElement !== editorDraftParent) editorDraftParent.appendChild(draftActions);
        draftActions.classList.remove('hidden');
        activeShell.style.gridTemplateColumns = 'minmax(0, 1fr)';
        activeShell.style.gridTemplateRows = 'auto minmax(0, 1fr)';
        activeShell.style.gap = isMobile ? '12px' : (isTablet ? '16px' : '20px');
        sidePanel.style.display = 'block';
        sidePanel.style.gridTemplateColumns = '';
        sidePanel.style.gridTemplateRows = '';
        sidePanel.style.alignItems = '';
        sidePanel.style.minHeight = '';
        sidePanel.style.position = 'fixed';
        sidePanel.style.top = isMobile ? 'auto' : (isTablet ? '76px' : '84px');
        sidePanel.style.left = isMobile ? '0' : '';
        sidePanel.style.right = isMobile ? '0' : (isTablet ? '16px' : '24px');
        sidePanel.style.bottom = isMobile ? '0' : (isTablet ? '16px' : '24px');
        sidePanel.style.width = isMobile ? 'auto' : (isTablet ? 'min(720px, calc(100vw - 32px))' : '420px');
        sidePanel.style.height = isMobile ? 'min(72dvh, 620px)' : '';
        sidePanel.style.zIndex = '60';
        sidePanel.style.pointerEvents = 'auto';
        if (topActions) {
            topActions.style.display = 'flex';
            topActions.style.gridColumn = '1 / -1';
            topActions.style.margin = isMobile ? '-12px -12px 0' : (isTablet ? '-16px -16px 0' : '0');
            topActions.style.borderRadius = '0';
            topActions.style.position = isMobile || isTablet ? 'relative' : 'fixed';
            topActions.style.top = isMobile || isTablet ? '' : '0';
            topActions.style.left = isMobile || isTablet ? '' : '0';
            topActions.style.right = isMobile || isTablet ? '' : '0';
            topActions.style.zIndex = isMobile && AppState.draftDrawerOpen ? '240' : '80';
        }
        if (tabletTabs) tabletTabs.style.display = isTablet ? 'flex' : 'none';
        if (settingsPanel) {
            settingsPanel.style.maxHeight = '100%';
            settingsPanel.style.overflowY = 'auto';
        }
        if (settingsContent) {
            settingsContent.style.display = isTablet ? 'grid' : '';
            settingsContent.style.gridTemplateColumns = isTablet ? 'minmax(220px, 1fr) minmax(240px, 1fr)' : '';
            settingsContent.style.alignItems = isTablet ? 'start' : '';
            settingsContent.style.gap = isTablet ? '16px' : '';
        }
        if (colorListPanel) {
            colorListPanel.style.maxHeight = '100%';
            colorListPanel.style.overflowY = 'auto';
        }
        draftActions.style.width = isMobile ? 'auto' : (isTablet ? 'min(260px, 42vw)' : '100%');
        draftActions.style.margin = '';
        draftActions.style.gridColumn = '';
        draftActions.style.gridTemplateColumns = isMobile ? 'minmax(0, 1fr) 72px' : 'minmax(0, 1fr) 96px';
        if (draftPrimaryControl) draftPrimaryControl.style.gridTemplateColumns = 'minmax(0, 1fr) 48px';
        if (draftDrawer) {
            draftDrawer.style.position = isMobile ? 'fixed' : '';
            draftDrawer.style.top = isMobile ? 'auto' : 'calc(100% + 12px)';
            draftDrawer.style.bottom = isMobile ? '76px' : 'auto';
            draftDrawer.style.left = isMobile ? '12px' : 'auto';
            draftDrawer.style.right = isMobile ? '12px' : '104px';
            draftDrawer.style.width = isMobile ? 'auto' : 'min(420px, calc(100vw - 48px))';
            draftDrawer.style.transform = '';
            draftDrawer.style.maxHeight = isMobile ? 'calc(100dvh - 132px)' : '';
            draftDrawer.style.overflowY = isMobile ? 'auto' : '';
            draftDrawer.style.overscrollBehavior = isMobile ? 'contain' : '';
            draftDrawer.style.zIndex = isMobile ? '240' : '';
        }
        return;
    }

    const setupDraftParent = hasImage ? sideDraftSlot : setupDraftSlot;
    if (draftActions.parentElement !== setupDraftParent) setupDraftParent.appendChild(draftActions);
    const hideSetupDraftActions = isMobile && hasImage;
    draftActions.classList.toggle('hidden', hideSetupDraftActions);
    if (hideSetupDraftActions) AppState.draftDrawerOpen = false;
    const isCompactSetup = isMobile || isTablet;
    const isMobileCropStep = isMobile && hasImage && AppState.mobileSetupStep === 'crop';
    const isMobileSettingsStep = isMobile && hasImage && AppState.mobileSetupStep === 'settings';
    activeShell.style.gridTemplateColumns = isCompactSetup ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 380px';
    activeShell.style.gridTemplateRows = isMobileCropStep
        ? 'minmax(360px, 1fr)'
        : (isMobileSettingsStep ? 'minmax(180px, 30dvh) auto' : (isCompactSetup ? 'minmax(360px, 42dvh) auto' : ''));
    activeShell.style.gap = isMobile ? '12px' : (isTablet ? '16px' : '20px');
    sidePanel.style.display = isMobileCropStep ? 'none' : (isCompactSetup ? 'grid' : '');
    sidePanel.style.gridTemplateColumns = isTablet && hasImage ? 'minmax(0, 1fr) 280px' : '';
    sidePanel.style.gridTemplateRows = '';
    sidePanel.style.alignItems = isMobileSettingsStep ? 'stretch' : (isCompactSetup ? 'start' : '');
    sidePanel.style.minHeight = isCompactSetup ? '0' : '';
    sidePanel.style.position = '';
    sidePanel.style.top = '';
    sidePanel.style.left = '';
    sidePanel.style.right = '';
    sidePanel.style.bottom = '';
    sidePanel.style.width = isMobile ? '100%' : '';
    sidePanel.style.height = '';
    sidePanel.style.zIndex = '';
    sidePanel.style.pointerEvents = '';
    sidePanel.style.overflow = isMobile ? 'visible' : '';
    if (topActions) {
        topActions.style.display = 'none';
        topActions.style.gridColumn = '';
        topActions.style.margin = '';
        topActions.style.borderRadius = '';
        topActions.style.position = '';
        topActions.style.zIndex = '';
    }
    if (tabletTabs) tabletTabs.style.display = 'none';
    if (settingsPanel) {
        settingsPanel.style.maxHeight = isMobile ? '' : (isTablet ? '47vh' : '');
        settingsPanel.style.overflow = isMobile ? 'visible' : '';
        settingsPanel.style.overflowY = !isMobile && isCompactSetup ? 'auto' : '';
    }
    if (settingsContent) {
        settingsContent.style.display = isTablet ? 'grid' : '';
        settingsContent.style.gridTemplateColumns = isTablet ? 'minmax(220px, 1fr) minmax(240px, 1fr)' : '';
        settingsContent.style.alignItems = isTablet ? 'start' : '';
        settingsContent.style.gap = isTablet ? '16px' : '';
    }
    if (colorListPanel) {
        colorListPanel.style.maxHeight = '';
        colorListPanel.style.overflowY = '';
    }
    draftActions.style.width = hasImage ? '' : '280px';
    draftActions.style.margin = hasImage ? '' : '0 auto';
    draftActions.style.gridColumn = '';
    draftActions.style.gridTemplateColumns = 'minmax(0, 1fr)';
    if (draftPrimaryControl) draftPrimaryControl.style.gridTemplateColumns = 'minmax(0, 1fr)';
    if (draftDrawer) {
        draftDrawer.style.position = isMobile ? 'fixed' : '';
        draftDrawer.style.top = isMobile ? 'auto' : 'calc(100% + 12px)';
        draftDrawer.style.bottom = isMobile ? '24px' : 'auto';
        draftDrawer.style.left = isMobile ? '12px' : '50%';
        draftDrawer.style.right = isMobile ? '12px' : 'auto';
        draftDrawer.style.width = isMobile ? 'auto' : 'min(420px, calc(100vw - 48px))';
        draftDrawer.style.transform = isMobile ? '' : 'translateX(-50%)';
        draftDrawer.style.maxHeight = isMobile ? 'calc(100dvh - 72px)' : '';
        draftDrawer.style.overflowY = isMobile ? 'auto' : '';
        draftDrawer.style.overscrollBehavior = isMobile ? 'contain' : '';
        draftDrawer.style.zIndex = isMobile ? '240' : '';
    }
}

export function zoomWorkbenchComparePreview(deltaY) {
    if (!isWorkbenchLayout() || !AppState.image || !hasWorkbenchPattern() || !AppState.comparePreviewVisible) return;
    const nextScale = clamp((AppState.comparePreviewScale || 1) * (deltaY < 0 ? 1.1 : 0.9), 0.1, 8);
    AppState.comparePreviewScale = nextScale;
    updateWorkbenchComparePreview(false);
}

export function updateWorkbenchUI() {
    if (!isWorkbenchLayout()) return;
    document.getElementById('precision-mode-select')?.closest('div')?.classList.add('hidden');
    document.getElementById('color-match-mode-select')?.closest('div')?.classList.add('hidden');
    document.getElementById('dithering-toggle')?.closest('label')?.classList.add('hidden');
    const hasImage = Boolean(AppState.image);
    const hasPattern = hasWorkbenchPattern();
    const hasPixelArt = Boolean(AppState.pixelArtData) && !hasPattern;
    const isMobile = isWorkbenchMobileLayout();
    const isMobileCropStep = isMobile && hasImage && !hasPattern && AppState.mobileSetupStep === 'crop';
    const isMobileSettingsStep = isMobile && hasImage && !hasPattern && AppState.mobileSetupStep === 'settings';
    applyWorkbenchLayoutMode(hasPattern);
    const isTablet = isWorkbenchTabletLayout();
    const toolbarCollapsed = false;
    const tabletPanel = ['settings', 'colors'].includes(AppState.workbenchTabletPanel)
        ? AppState.workbenchTabletPanel
        : null;
    const settingsCollapsed = false;
    const showSettingsPanel = hasPattern ? tabletPanel === 'settings' : !(isMobileCropStep || (isMobile && !hasImage));
    const showColorListPanel = hasPattern && tabletPanel === 'colors';
    const compareVisible = hasPattern && AppState.comparePreviewVisible;
    setHidden('workbench-upload-empty', hasImage || hasPattern);
    setHidden('workbench-change-image', isMobile || (!hasImage && !hasPattern));
    setHidden('workbench-preview-empty', !hasImage || hasPattern || hasPixelArt || isMobile);
    setHidden('workbench-stage', false);
    setHidden('workbench-source-preview', !hasImage || hasPattern);
    setHidden('result-canvas', !hasPattern);
    setHidden('workbench-single-stage', hasPattern);
    setHidden('workbench-edit-stage', !hasPattern);
    setHidden('toggle-compare-preview-btn', !hasPattern);
    setHidden('compare-source-pane', !compareVisible);
    // The tool palette stays available while editing; only the active tool changes.
    setHidden('workbench-edit-toolbar', !hasPattern || toolbarCollapsed);
    setHidden('collapse-edit-toolbar-btn', true);
    setHidden('expand-edit-toolbar-btn', true);
    setHidden('workbench-active-toolbar', true);
    setHidden('workbench-color-panel-empty', hasPattern);
    setHidden('color-stats', !hasPattern);
    setHidden('workbench-side-panel', (hasPattern && !tabletPanel) || isMobileCropStep);
    setHidden('workbench-top-actions', !hasPattern);
    setHidden('workbench-top-edit-actions', !hasPattern);
    const sidePanel = document.getElementById('workbench-side-panel');
    if (sidePanel && hasPattern) {
        sidePanel.style.display = tabletPanel ? 'block' : 'none';
        sidePanel.style.pointerEvents = tabletPanel ? 'auto' : 'none';
    }
    if (sidePanel && isMobileCropStep) {
        sidePanel.style.display = 'none';
        sidePanel.style.pointerEvents = 'none';
    }
    setHidden('workbench-settings-panel', !showSettingsPanel);
    setHidden('workbench-color-list-panel', !showColorListPanel);
    setHidden('mobile-crop-actions', !isMobileSettingsStep);
    setHidden('mobile-crop-confirm-actions', !isMobileCropStep);
    setHidden('next-to-step-4', !hasPattern);
    setHidden('workbench-generate-actions', hasPattern || (isMobile && (!hasImage || isMobileCropStep)));
    setHidden('legacy-generate-pattern-btn', true);
    setHidden('apply-workbench-settings-btn', !hasPattern);
    setHidden('toggle-workbench-settings-btn', isMobileCropStep);
    setHidden('workbench-settings-content', settingsCollapsed || isMobileCropStep);
    setText('generate-pattern-label', isWorkbenchLayout() ? '生成预览' : (hasPattern ? '更新拼豆图纸' : '生成拼豆图纸'));
    setText('pixel-art-status', hasPixelArt ? '预览已生成' : '未生成预览');
    setText('workbench-settings-summary', getWorkbenchSettingsSummary());
    setText('workbench-settings-toggle-label', settingsCollapsed ? '展开' : '收起');
    setText('workbench-pattern-title', String(AppState.patternName || '').trim() || '未命名图纸');
    setText('workbench-pattern-meta', `${AppState.gridWidth}x${AppState.gridHeight} · ${AppState.brand === 'mard' ? `MARD ${AppState.mardSet}色` : AppState.brand.toUpperCase()}`);
    const patternNameInput = document.getElementById('pattern-name-input');
    if (patternNameInput && document.activeElement !== patternNameInput) {
        patternNameInput.value = AppState.patternName || '';
    }
    syncBrandControls();
    syncMobileColorLimitDisplay();
    renderMobileSettingsModal();
    const settingsTab = document.getElementById('show-workbench-settings-panel-btn');
    const colorsTab = document.getElementById('show-workbench-colors-panel-btn');
    if (settingsTab) {
        const active = tabletPanel === 'settings';
        settingsTab.classList.toggle('bg-gray-900', active);
        settingsTab.classList.toggle('text-white', active);
        settingsTab.classList.toggle('bg-gray-100', !active);
        settingsTab.classList.toggle('text-gray-700', !active);
        settingsTab.setAttribute('aria-expanded', String(active));
    }
    if (colorsTab) {
        const active = tabletPanel === 'colors';
        colorsTab.classList.toggle('bg-gray-900', active);
        colorsTab.classList.toggle('text-white', active);
        colorsTab.classList.toggle('bg-gray-100', !active);
        colorsTab.classList.toggle('text-gray-700', !active);
        colorsTab.setAttribute('aria-expanded', String(active));
    }
    if (hasPattern) refreshQualityIssues();
    else AppState.qualityIssues = [];
    setText('quality-check-btn', AppState.qualityOverlayVisible ? '\u5173\u95ed\u68c0\u67e5' : `\u8d28\u91cf\u68c0\u67e5\uff08${AppState.qualityIssues.length}\uff09`);
    renderPalettePanel();
    renderAllColorsPanel();
    syncRecentColorChips();
    const generateBtn = document.getElementById('generate-pattern-btn');
    if (generateBtn) {
        const generateLabel = document.getElementById('generate-pattern-label');
        if (generateLabel && isWorkbenchLayout()) {
            generateLabel.textContent = isMobileCropStep ? '确认范围' : '生成预览';
        }
        generateBtn.classList.toggle('hidden', AppState.patternPreviewVisible);
        generateBtn.disabled = !hasImage;
        generateBtn.classList.toggle('opacity-40', !hasImage);
        generateBtn.classList.toggle('cursor-not-allowed', !hasImage);
    }
    const pixelArtBtn = document.getElementById('generate-pixel-art-btn');
    if (pixelArtBtn) {
        pixelArtBtn.disabled = !hasImage;
        pixelArtBtn.textContent = hasPixelArt ? '重新生成像素预览' : '生成像素预览';
        pixelArtBtn.classList.toggle('hidden', isWorkbenchLayout());
        pixelArtBtn.classList.toggle('opacity-40', !hasImage);
        pixelArtBtn.classList.toggle('cursor-not-allowed', !hasImage);
    }
    const legacyGenerateBtn = document.getElementById('legacy-generate-pattern-btn');
    if (legacyGenerateBtn) {
        legacyGenerateBtn.disabled = !hasImage;
        legacyGenerateBtn.classList.toggle('opacity-40', !hasImage);
        legacyGenerateBtn.classList.toggle('cursor-not-allowed', !hasImage);
    }
    const qualityCheckBtn = document.getElementById('quality-check-btn');
    if (qualityCheckBtn) {
        qualityCheckBtn.classList.toggle('bg-primary', AppState.qualityOverlayVisible);
        qualityCheckBtn.classList.toggle('text-white', AppState.qualityOverlayVisible);
    }
    const exportBtn = document.getElementById('next-to-step-4');
    if (exportBtn) {
        exportBtn.disabled = !hasPattern;
        exportBtn.classList.toggle('opacity-40', !hasPattern);
        exportBtn.classList.toggle('cursor-not-allowed', !hasPattern);
    }
    const topUndoBtn = document.getElementById('workbench-top-undo-btn');
    if (topUndoBtn) {
        topUndoBtn.disabled = !AppState.editor.undoStack.length;
        topUndoBtn.classList.toggle('is-disabled', !AppState.editor.undoStack.length);
    }
    const topRedoBtn = document.getElementById('workbench-top-redo-btn');
    if (topRedoBtn) {
        topRedoBtn.disabled = !AppState.editor.redoStack.length;
        topRedoBtn.classList.toggle('is-disabled', !AppState.editor.redoStack.length);
    }
    const topCancelBtn = document.getElementById('workbench-top-cancel-btn');
    if (topCancelBtn) {
        topCancelBtn.disabled = AppState.editMode === 'none';
        topCancelBtn.classList.toggle('hidden', AppState.editMode === 'none');
    }
    const modeLabel = AppState.fillMode
        ? (AppState.fillColorId
            ? `填色 ${AppState.fillColorId}`
            : '取色填色')
        : AppState.eyedropperMode
            ? '吸色'
            : AppState.clearBaseMode
            ? '移除底色'
        : AppState.colorEraseMode
            ? '按颜色擦除'
            : AppState.deleteMode
            ? '删除色块'
            : AppState.edgeSelectionMode
                ? '边缘调整'
                : '编辑';
    document.getElementById('toggle-fill-btn')?.classList.toggle('is-active', AppState.fillMode);
    document.getElementById('eyedropper-tool-btn')?.classList.toggle('is-active', AppState.eyedropperMode);
    document.getElementById('toggle-delete-btn')?.classList.toggle('is-active', AppState.deleteMode);
    document.getElementById('toggle-edge-adjust-btn')?.classList.toggle('is-active', AppState.edgeSelectionMode);
    document.getElementById('toggle-clear-base-btn')?.classList.toggle('is-active', AppState.clearBaseMode);
    syncEditorToolVisualState();
    const compareSourceFrame = document.getElementById('compare-source-frame');
    const compareSourcePreview = document.getElementById('compare-source-preview');
    const shouldUseOriginalPickerCursor = AppState.fillMode && compareVisible;
    if (compareSourceFrame) {
        compareSourceFrame.classList.toggle('cursor-crosshair', shouldUseOriginalPickerCursor);
    }
    if (compareSourcePreview) {
        compareSourcePreview.classList.toggle('cursor-crosshair', shouldUseOriginalPickerCursor);
    }
    updateWorkbenchCursors(compareVisible);
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
    renderPatternPreviewLayer();
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
    const ctxSource = sourceCanvas.getContext('2d', { willReadFrequently: true });
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
    AppState.cropRect = detectContentCropRect() || getDefaultCropRect();
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
    const hadPattern = hasWorkbenchPattern();
    const val = parseInt(slider.value);
    const ratio = getActiveSourceRatio();
    let nextGridWidth;
    let nextGridHeight;
    
    if (ratio >= 1) {
        nextGridWidth = val;
        nextGridHeight = Math.round(val / ratio);
    } else {
        nextGridHeight = val;
        nextGridWidth = Math.round(val * ratio);
    }
    
    sizeDisplay.innerText = `${nextGridWidth}x${nextGridHeight}`;
    if (hadPattern) {
        AppState.pendingGridWidth = nextGridWidth;
        AppState.pendingGridHeight = nextGridHeight;
        updateBoardSizeUI(nextGridWidth, nextGridHeight);
        updateWorkbenchUI();
        return;
    }

    AppState.gridWidth = nextGridWidth;
    AppState.gridHeight = nextGridHeight;
    AppState.pendingGridWidth = null;
    AppState.pendingGridHeight = null;
    if (!hasWorkbenchPattern()) {
        AppState.pixelData = [];
        AppState.generatedPixelData = null;
        AppState.patternPreviewVisible = false;
        AppState.patternPreviewPixelData = null;
        AppState.patternPreviewPixelArtData = null;
        AppState.stagedPixelData = null;
        AppState.stagedActions = [];
        AppState.qualityIssues = [];
        AppState.qualityOverlayVisible = false;
        AppState.pixelArtData = null;
    }
    updateBoardSizeUI();
    updateWorkbenchUI();
}

/**
 * 更新板子尺寸 UI
 */
function updateBoardSizeUI(gridWidth = AppState.gridWidth, gridHeight = AppState.gridHeight) {
    const boardSizeDisplay = document.getElementById('board-size-display');
    const maxDim = Math.max(gridWidth, gridHeight);
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
    updateWorkbenchCursors(AppState.comparePreviewVisible);
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
    AppState.patternPreviewVisible = false;
    AppState.patternPreviewPixelData = null;
    AppState.patternPreviewPixelArtData = null;
    AppState.highlightedColorId = null;
    AppState.workbenchSettingsCollapsed = false;
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    resetPalettePanelPosition();
    AppState.qualityIssues = [];
    AppState.qualityOverlayVisible = false;
    AppState.comparePreviewVisible = false;
    renderPixelArtPreview();
    updateWorkbenchUI();
}

export function handleGeneratePatternLegacy() {
    if (!AppState.image) return;
    const sourceImageData = getSourceImageDataForGeneration();

    AppState.highlightedColorId = null;
    AppState.pixelArtData = null;
    AppState.patternPreviewVisible = false;
    AppState.patternPreviewPixelData = null;
    AppState.patternPreviewPixelArtData = null;
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
    AppState.workbenchTabletPanel = null;
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    resetPalettePanelPosition();
    AppState.comparePreviewVisible = false;
    goToStep(3);
}

export function handleGeneratePattern() {
    if (!AppState.image) return;
    if (isWorkbenchLayout()) {
        if (isWorkbenchMobileLayout() && AppState.mobileSetupStep === 'crop' && !hasWorkbenchPattern()) {
            AppState.mobileSetupStep = 'settings';
            AppState.cropInteraction = null;
            updateGridDimensions();
            updateWorkbenchSourcePreview();
            updateWorkbenchUI();
            return;
        }
        buildPatternPreview(AppState.patternPreviewStyle || 'photo');
        updateWorkbenchUI();
        return;
    }
    if (!AppState.pixelArtData) {
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
    AppState.workbenchTabletPanel = null;
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    resetPalettePanelPosition();
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

export function applyWorkbenchSettings() {
    if (!isWorkbenchLayout() || !AppState.image || !hasWorkbenchPattern()) return;
    const confirmed = window.confirm('重新生成图纸？\n\n应用新的生成设置后，当前图纸结果会被重新计算，已有的颜色调整、删除色块和生成效果选择可能会被覆盖。');
    if (!confirmed) return;
    if (AppState.pendingGridWidth && AppState.pendingGridHeight) {
        AppState.gridWidth = AppState.pendingGridWidth;
        AppState.gridHeight = AppState.pendingGridHeight;
        AppState.pendingGridWidth = null;
        AppState.pendingGridHeight = null;
    }
    buildPatternPreview(AppState.patternPreviewStyle || 'photo');
    updateWorkbenchUI();
}

export function handlePatternPreviewStyle(style) {
    if (!AppState.image || !PATTERN_PREVIEW_STYLES[style]) return;
    buildPatternPreview(style);
    updateWorkbenchUI();
}

export function cancelPatternPreview() {
    AppState.patternPreviewVisible = false;
    AppState.patternPreviewPixelData = null;
    AppState.patternPreviewPixelArtData = null;
    updateWorkbenchUI();
}

export function confirmPatternPreview() {
    if (!Array.isArray(AppState.patternPreviewPixelData)) return;

    AppState.highlightedColorId = null;
    AppState.pixelArtData = AppState.patternPreviewPixelArtData;
    AppState.pixelData = deepClonePixels(AppState.patternPreviewPixelData);
    AppState.generatedPixelData = deepClonePixels(AppState.pixelData);
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
    AppState.fillSelection = null;
    AppState.selectedEdgeBeadsIndices = [];
    AppState.receiverIndex = null;
    AppState.adjustPhase = 'waiting_receiver';
    resetBatchReplaceState();
    AppState.qualityIssues = [];
    AppState.qualityOverlayVisible = false;
    AppState.patternPreviewVisible = false;
    AppState.patternPreviewPixelData = null;
    AppState.patternPreviewPixelArtData = null;
    AppState.workbenchSettingsCollapsed = isWorkbenchLayout();
    AppState.workbenchTabletPanel = null;
    AppState.workbenchToolbarCollapsed = false;
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    resetPalettePanelPosition();
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
    resetPalettePanelPosition();
    AppState.comparePreviewVisible = false;
    AppState.selectedEdgeBeadsIndices = [];
    AppState.receiverIndex = null;
    AppState.adjustPhase = 'waiting_receiver';
    resetBatchReplaceState();
    if (AppState.qualityOverlayVisible) refreshQualityIssues();
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
