/**
 * 拼豆图纸生成器 - UI 交互逻辑
 */
import { AppState } from './state.js';
import { getFilteredMardPalette, removeBackground, cleanTinyFragments, generatePatternData } from './processor.js';
import { renderResult, updateResultTransform, getResetZoomState } from './renderer.js';
import { PALETTES } from './constants.js';

/**
 * 切换步骤
 * @param {number} step - 目标步骤 (1-4)
 */
export function goToStep(step) {
    document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
    const stepNames = ['home', 'settings', 'editor', 'export'];
    document.querySelector(`#step-${stepNames[step - 1]}`).classList.add('active');
    AppState.currentStep = step;

    // 步骤特定的初始化
    if (step === 2) initSettingsView();
    if (step === 3) initEditorView();
    if (step === 4) initExportView();
}

/**
 * 初始化设置界面 (Step 2)
 */
function initSettingsView() {
    if (!AppState.image) return;
    
    const sourceCanvas = document.getElementById('source-canvas');
    const ctxSource = sourceCanvas.getContext('2d');
    const container = document.getElementById('canvas-container');
    const img = AppState.image;

    // 计算容器尺寸
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

    // 初始化状态
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
 * 更新背景板信息 UI
 */
function updateBoardSizeUI() {
    const boardSizeDisplay = document.getElementById('board-size-display');
    const maxDim = Math.max(AppState.gridWidth, AppState.gridHeight);
    if (maxDim <= 52) {
        boardSizeDisplay.innerText = '52小板';
        boardSizeDisplay.className = 'text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-blue-100 text-blue-600';
    } else {
        boardSizeDisplay.innerText = '104大板';
        boardSizeDisplay.className = 'text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-purple-100 text-purple-600';
    }
}

/**
 * 更新撤销按钮状态
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
 * 触发背景移除模式
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
        btn.querySelector('span').innerText = '取消移除模式';
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
 * 处理 Canvas 点击（背景移除）
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

    // 转换为原始尺寸坐标
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
    toggleBgRemovalMode(); // 自动退出
}

/**
 * 自动清除碎片
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
 * 生成图案并跳转
 */
export function handleGeneratePattern() {
    const sourceCanvas = document.getElementById('source-canvas');
    const ctx = sourceCanvas.getContext('2d');
    const sourceImageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

    // 重置高亮状态
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
 * 初始化编辑器界面 (Step 3)
 */
function initEditorView() {
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
    
    // 使用 requestAnimationFrame 确保容器尺寸已更新（解决 Flexbox 渲染延迟导致的缩放偏移）
    requestAnimationFrame(() => {
        const resultContainer = document.getElementById('result-container');
        const zoomState = getResetZoomState(resultContainer, resultCanvas);
        AppState.zoomState = zoomState; // 同步到状态
        updateResultTransform(resultCanvas, zoomState, document.getElementById('zoom-reset-btn'));
    });
}

/**
 * 计算颜色统计
 */
export function calculateStats() {
    const stats = {};
    let total = 0;
    AppState.pixelData.forEach(p => {
        if (p.id === 'NONE') return;
        if (!stats[p.id]) stats[p.id] = { ...p, count: 0 };
        stats[p.id].count++;
        total++;
    });

    const sorted = Object.values(stats).sort((a, b) => b.count - a.count);
    
    document.getElementById('total-beads-count').innerText = `共 ${total} 颗`;
    document.getElementById('color-types-count').innerText = `${sorted.length} 种颜色`;

    const container = document.getElementById('color-stats');
    container.innerHTML = sorted.map(c => {
        const yiq = ((c.r * 299) + (c.g * 587) + (c.b * 114)) / 1000;
        const textColor = yiq >= 128 ? 'text-black/80' : 'text-white/90';
        const isSelected = AppState.highlightedColorId === c.id;
        
        return `
            <div id="color-item-${c.id}"
                class="flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer active:scale-95 border-2 ${isSelected ? 'border-primary ring-2 ring-primary/30 shadow-lg' : 'border-transparent opacity-90 hover:opacity-100'}" 
                style="background-color: rgb(${c.r},${c.g},${c.b})">
                <span class="text-[11px] font-bold font-mono ${textColor}">${c.id}</span>
                <span class="text-[10px] font-medium ml-2 ${textColor}">(${c.count})</span>
            </div>
        `;
    }).join('');

    // 为每个颜色项绑定点击事件
    sorted.forEach(c => {
        const item = document.getElementById(`color-item-${c.id}`);
        if (item) {
            item.addEventListener('click', () => toggleColorHighlight(c.id));
        }
    });
}

/**
 * 切换颜色高亮
 */
export function toggleColorHighlight(colorId) {
    if (AppState.highlightedColorId === colorId) {
        AppState.highlightedColorId = null;
    } else {
        AppState.highlightedColorId = colorId;
    }
    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    calculateStats();
}

/**
 * 初始化导出界面 (Step 4)
 */
function initExportView() {
    const resultCanvas = document.getElementById('result-canvas');
    const exportImg = document.getElementById('export-preview');
    exportImg.src = resultCanvas.toDataURL();
    document.getElementById('export-meta').innerText = `${AppState.gridWidth}x${AppState.gridHeight} • ${AppState.brand.toUpperCase()}`;
}

/**
 * 更新容差显示
 */
export function updateTolerance(val) {
    document.getElementById('tolerance-value').innerText = val;
}

/**
 * 切换颜色限制
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
 * 更新最大颜色显示
 */
export function updateMaxColorsDisplay() {
    const val = document.getElementById('max-colors-slider').value;
    document.getElementById('max-colors-display').innerText = val;
}

/**
 * 重置结果画布缩放
 */
export function resetZoom() {
    const resultCanvas = document.getElementById('result-canvas');
    const resultContainer = document.getElementById('result-container');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    
    const newState = getResetZoomState(resultContainer, resultCanvas);
    AppState.zoomState = newState;
    
    resultCanvas.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    updateResultTransform(resultCanvas, AppState.zoomState, zoomResetBtn);
    
    setTimeout(() => {
        resultCanvas.style.transition = 'none';
    }, 400);
}
