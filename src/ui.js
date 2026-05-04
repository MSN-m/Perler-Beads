/**
 * 拼豆图纸生成器 - UI 与页面流程
 */
import { AppState } from './state.js';
import { removeBackground, cleanTinyFragments, generatePatternData } from './processor.js';
import { renderResult, updateResultTransform, getResetZoomState } from './renderer.js';
import { PALETTES } from './constants.js';
import { calculateStats, configureEditorActions, deepClonePixels, resetBatchReplaceState, updateAdjustUndoButton } from './editor.js';
import { toggleDeleteMode as _toggleDeleteMode } from './features/delete.js';
import { resetZoom as _resetZoom } from './features/zoom.js';
import { toggleEdgeAdjustMode as _toggleEdgeAdjustMode } from './features/edge.js';
import {
    enterEditSession as _enterEditSession,
    toggleClearBaseMode as _toggleClearBaseMode,
    handleResultCanvasClickForAdjust as _handleResultCanvasClickForAdjust,
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
    _toggleClearBaseMode as toggleClearBaseMode,
    _handleResultCanvasClickForAdjust as handleResultCanvasClickForAdjust,
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

function hasWorkbenchPattern() {
    return Array.isArray(AppState.pixelData) && AppState.pixelData.length > 0;
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
    const shouldShow = Boolean(AppState.image) && !hasPattern;
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
    renderWorkbenchCropOverlay();
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
    renderWorkbenchCropOverlay();
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
    }

    const displayWidth = Math.max(1, Math.round(crop.width * AppState.comparePreviewScale));
    const displayHeight = Math.max(1, Math.round(crop.height * AppState.comparePreviewScale));

    previewCanvas.width = crop.width;
    previewCanvas.height = crop.height;
    previewCanvas.style.width = `${displayWidth}px`;
    previewCanvas.style.height = `${displayHeight}px`;
    previewCanvas.style.left = `${Math.round((frameWidth - displayWidth) / 2)}px`;
    previewCanvas.style.top = `${Math.round((frameHeight - displayHeight) / 2)}px`;

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
    const toolbarCollapsed = Boolean(AppState.workbenchToolbarCollapsed);
    const compareVisible = hasPattern && AppState.comparePreviewVisible;
    setHidden('workbench-upload-empty', hasImage);
    setHidden('workbench-change-image', !hasImage);
    setHidden('workbench-preview-empty', !hasImage || hasPattern);
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
    setText('generate-pattern-label', hasPattern ? '更新图纸' : '生成图纸');
    const generateBtn = document.getElementById('generate-pattern-btn');
    if (generateBtn) {
        generateBtn.disabled = !hasImage;
        generateBtn.classList.toggle('opacity-40', !hasImage);
        generateBtn.classList.toggle('cursor-not-allowed', !hasImage);
    }
    const exportBtn = document.getElementById('next-to-step-4');
    if (exportBtn) {
        exportBtn.disabled = !hasPattern;
        exportBtn.classList.toggle('opacity-40', !hasPattern);
        exportBtn.classList.toggle('cursor-not-allowed', !hasPattern);
    }
    const modeLabel = AppState.clearBaseMode
        ? '移除底色'
        : AppState.deleteMode
            ? '删除色块'
            : AppState.edgeSelectionMode
                ? '边缘调整'
                : '编辑';
    setText('workbench-active-mode-label', modeLabel);
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
        updateWorkbenchSourcePreview();
    }
    if (hasImage && compareVisible) {
        updateWorkbenchComparePreview(false);
    }
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
 * 处理原图 Canvas 点击移除背景
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

    // 将显示坐标换算为画布像素坐标
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
    toggleBgRemovalMode(); // 点击一次后自动退出
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
export function handleGeneratePattern() {
    if (!AppState.image) return;
    const sourceImageData = getSourceImageDataForGeneration();

    // 清除高亮颜色状态
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
    AppState.generatedPixelData = deepClonePixels(AppState.pixelData);
    AppState.workbenchToolbarCollapsed = false;
    AppState.comparePreviewVisible = false;

    goToStep(3);
}

/**
 * 初始化编辑页（Step 3）
 */
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
    AppState.stagedPixelData = null;
    AppState.stagedActions = [];
    AppState.editMode = 'none';
    AppState.deleteMode = false;
    AppState.edgeSelectionMode = false;
    AppState.clearBaseMode = false;
    AppState.workbenchToolbarCollapsed = false;
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
}

/**
 * 更新最大颜色数显示
 */
export function updateMaxColorsDisplay() {
    const val = document.getElementById('max-colors-slider').value;
    document.getElementById('max-colors-display').innerText = val;
}
