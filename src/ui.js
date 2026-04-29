/**
 * 拼豆图纸生成器 - UI 与页面流程
 */
import { AppState } from './state.js';
import { removeBackground, cleanTinyFragments, generatePatternData } from './processor.js';
import { renderResult, updateResultTransform, getResetZoomState } from './renderer.js';
import { PALETTES } from './constants.js';
import { calculateStats, configureEditorActions } from './editor.js';
import { toggleDeleteMode as _toggleDeleteMode } from './features/delete.js';
import { resetZoom as _resetZoom } from './features/zoom.js';
import { toggleEdgeAdjustMode as _toggleEdgeAdjustMode } from './features/edge.js';
import {
    toggleAdjustMode as _toggleAdjustMode,
    handleResultCanvasClickForAdjust as _handleResultCanvasClickForAdjust,
    adjustUndo as _adjustUndo,
    adjustCancel as _adjustCancel,
    adjustApply as _adjustApply
} from './features/adjust.js';

configureEditorActions({ toggleAdjustMode: _toggleAdjustMode });

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

/**
 * 切换页面步骤
 * @param {number} step - 步骤编号（1-4）
 */
export function goToStep(step) {
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    const stepNames = ['home', 'settings', 'editor', 'export'];
    document.querySelector(`#step-${stepNames[step - 1]}`).classList.add('active');
    AppState.currentStep = step;

    // 根据步骤初始化对应视图
    if (step === 2) initSettingsView();
    if (step === 3) initEditorView();
    if (step === 4) initExportView();
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

    // 保存初始图像数据
    AppState.originalImageData = ctxSource.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    AppState.history = [ctxSource.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)];
    updateUndoButton();
    
    updateGridDimensions();
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
    const sourceCanvas = document.getElementById('source-canvas');
    const ctx = sourceCanvas.getContext('2d');
    const sourceImageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

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

    goToStep(3);
}

/**
 * 初始化编辑页（Step 3）
 */
function initEditorView() {
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
    
    // 使用 requestAnimationFrame 等待布局完成，再计算适配缩放
    requestAnimationFrame(() => {
        const resultContainer = document.getElementById('result-container');
        const zoomState = getResetZoomState(resultContainer, resultCanvas);
        AppState.zoomState = zoomState; // 保存初始缩放状态
        updateResultTransform(resultCanvas, zoomState, document.getElementById('zoom-reset-btn'));
    });
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
