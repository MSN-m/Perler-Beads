import { AppState } from './state.js';
import { renderFixedRuler } from './features/fixed-ruler.js';
import { getThemePrimaryColor, getEdgeBeadIndices } from './utils.js';

/**
 * 渲染图纸结果
 * @param {HTMLCanvasElement} canvas - 目标 Canvas
 * @param {Array} pixelArray - 像素数据
 * @param {number} gridWidth - 图案宽度
 * @param {number} gridHeight - 图案高度
 * @param {string|null} highlightedColorId - 高亮的颜色 ID
 */
// Read-only operation preview; four-direction connectivity matches bucket/area erase.
export function getOperationPreviewIndices(pixels, width, height, tool, hoverIndex, colorId, edgeIndices = [], fillColorId = null) {
    if (tool === 'edge') return edgeIndices;
    if (tool === 'color-eraser') return colorId == null ? [] : pixels.reduce((result, pixel, index) => {
        if (pixel?.id === colorId && pixel.id !== 'NONE') result.push(index);
        return result;
    }, []);
    if (!['area-erase', 'bucket'].includes(tool) || !Number.isInteger(hoverIndex) || hoverIndex < 0 || hoverIndex >= width * height) return [];
    const targetId = pixels[hoverIndex]?.id;
    if (!targetId || (tool === 'area-erase' && targetId === 'NONE') || (tool === 'bucket' && (!fillColorId || targetId === fillColorId))) return [];
    const queue = [hoverIndex], visited = new Set([hoverIndex]), result = [];
    for (let head = 0; head < queue.length; head++) {
        const index = queue[head];
        if (pixels[index]?.id !== targetId) continue;
        result.push(index);
        const x = index % width;
        const neighbors = [index - width, index + width];
        if (x > 0) neighbors.push(index - 1);
        if (x < width - 1) neighbors.push(index + 1);
        for (const next of neighbors) {
            if (next < 0 || next >= width * height || visited.has(next)) continue;
            visited.add(next); queue.push(next);
        }
    }
    return result;
}

export function renderResult(canvas, pixelArray, gridWidth, gridHeight, highlightedColorId = null) {
    const previewTool = canvas.id === 'result-canvas' ? AppState.editor.activeTool : null;
    const operationPreview = ['color-eraser', 'area-erase', 'bucket', 'edge'].includes(previewTool);
    if (operationPreview) highlightedColorId = null;
    if (canvas.id === 'result-canvas' && AppState.edgeSelectionMode) {
        AppState.selectedEdgeBeadsIndices = getEdgeBeadIndices(pixelArray, gridWidth, gridHeight);
    }
    const previewIndices = new Set(getOperationPreviewIndices(pixelArray, gridWidth, gridHeight,
        previewTool, AppState.operationHoverIndex, AppState.eraserHoverColorId,
        AppState.edgeSelectionMode ? AppState.selectedEdgeBeadsIndices : [], AppState.fillColorId));
    const ctx = canvas.getContext('2d');
    const scale = 30; // 预览比例
    
    // 1. 计算非透明色块的最小包围盒
    let minX = gridWidth, minY = gridHeight, maxX = -1, maxY = -1;
    let hasContent = false;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const i = (y * gridWidth + x);
            if (pixelArray[i].id !== 'NONE') {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasContent = true;
            }
        }
    }

    // 如果没有任何内容，默认显示 1x1
    if (!hasContent) {
        minX = 0; minY = 0; maxX = 0; maxY = 0;
    }

    // Keep the canvas geometry stable until the continuous erase gesture ends.
    if (canvas.id === 'result-canvas' && AppState.eraserStroke) {
        const stroke = AppState.eraserStroke;
        minX = stroke.minX; minY = stroke.minY;
        maxX = minX + stroke.width - 1; maxY = minY + stroke.height - 1;
    }
    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;

    // 将渲染相关的偏移量和尺寸存储到 AppState
    AppState.renderedMinX = minX;
    AppState.renderedMinY = minY;
    AppState.renderedContentWidth = contentWidth;
    AppState.renderedContentHeight = contentHeight;

    // 动态计算画布尺寸：有效内容宽度/高度 + 左上标尺 (1个单位)
    const totalGridX = contentWidth + 1;
    const totalGridY = contentHeight + 1;
    
    canvas.width = totalGridX * scale;
    canvas.height = totalGridY * scale;
    
    ctx.imageSmoothingEnabled = false;

    // 2. 绘制内容
    // 左上角原先内嵌的标尺区域保持透明，固定标尺由独立覆盖层绘制。
    const gridOffset = scale; // 标尺宽度
    // 绘制色块 (注意：需要减去 minX/minY 偏移)
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const i = (y * gridWidth + x);
            const color = pixelArray[i];
            if (color.id === 'NONE') continue;
            const drawX = gridOffset + (x - minX) * scale;
            const drawY = gridOffset + (y - minY) * scale;

            ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            ctx.fillRect(drawX, drawY, scale, scale);

            // 如果是边缘色块，绘制高亮边框
            if (!operationPreview && AppState.edgeSelectionMode && AppState.selectedEdgeBeadsIndices.includes(i)) {
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; // 黄色高亮
                ctx.lineWidth = 2;
                ctx.strokeRect(drawX + 1, drawY + 1, scale - 2, scale - 2);
            }
        }
    }

    // Dim only non-selected, occupied cells during the operation preview.
    if (previewIndices.size) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const color = pixelArray[y * gridWidth + x];
                if (!color || color.id === 'NONE' || previewIndices.has(y * gridWidth + x)) continue;
                ctx.fillRect(gridOffset + (x - minX) * scale, gridOffset + (y - minY) * scale, scale, scale);
            }
        }
    }

    // 4. 同色查看：压暗其他实际格，双层描边保证深浅目标色都清晰。
    const highlightDimOpacity = 0.72;
    if (highlightedColorId !== null) {
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const color = pixelArray[y * gridWidth + x];
                if (color.id === 'NONE') continue;
                const drawX = gridOffset + (x - minX) * scale;
                const drawY = gridOffset + (y - minY) * scale;
                if (color.id !== highlightedColorId) {
                    ctx.fillStyle = `rgba(0, 0, 0, ${highlightDimOpacity})`;
                    ctx.fillRect(drawX, drawY, scale, scale);
                    continue;
                }
                ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                ctx.lineWidth = 4;
                ctx.strokeRect(drawX + 2, drawY + 2, scale - 4, scale - 4);
                ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                ctx.lineWidth = 2;
                ctx.strokeRect(drawX + 2, drawY + 2, scale - 4, scale - 4);
            }
        }
    }

    // 5. 网格线、辅助线和 ID
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 5.1 基础网格线
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    // 垂直线
    for (let i = 0; i <= contentWidth; i++) {
        const pos = gridOffset + i * scale;
        ctx.beginPath();
        ctx.moveTo(pos, gridOffset); ctx.lineTo(pos, canvas.height);
        ctx.stroke();
    }
    // 水平线
    for (let i = 0; i <= contentHeight; i++) {
        const pos = gridOffset + i * scale;
        ctx.beginPath();
        ctx.moveTo(gridOffset, pos); ctx.lineTo(canvas.width, pos);
        ctx.stroke();
    }

    // 5.2 ID 文字
    ctx.font = `bold ${Math.floor(scale * 0.4)}px Arial`;
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const i = (y * gridWidth + x);
            const color = pixelArray[i];
            if (color.id === 'NONE') continue;
            const drawX = gridOffset + (x - minX) * scale;
            const drawY = gridOffset + (y - minY) * scale;
            const muted = highlightedColorId !== null && highlightedColorId !== color.id;
            const yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
            // Keep every occupied cell's label readable against its dimmed background.
            const textLuminance = muted ? yiq * (1 - highlightDimOpacity) : yiq;
            ctx.fillStyle = textLuminance >= 128
                ? (muted ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.6)')
                : (muted ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.7)');
            ctx.fillText(color.id, drawX + scale / 2, drawY + scale / 2);
        }
    }

    // PC editing uses the fixed overlay for 5/10-cell guides; retain other canvases.
    const useFixedGrid = canvas.id === 'result-canvas'
        && AppState.currentStep === 3
        && document.getElementById('fixed-ruler-canvas')
        && document.getElementById('workbench-layout')?.dataset.viewport === 'desktop';
    // 5.3 辅助线 (基于全局坐标计算是否为 5/10 倍数)
    // 垂直辅助线
    for (let x = minX + 1; !useFixedGrid && x <= maxX; x++) {
        // 只有当全局坐标是 5 的倍数时才画辅助线
        const isMajorLine = (x % 10 === 0);
        const isMinorLine = (x % 5 === 0);

        if (isMinorLine) {
            // 计算在当前画布上的绘制位置
            const pos = gridOffset + (x - minX) * scale;
            
            ctx.beginPath();
            if (isMajorLine) {
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 2;
            } else {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1;
            }
            ctx.moveTo(pos, gridOffset); ctx.lineTo(pos, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    // 水平辅助线
    for (let y = minY + 1; !useFixedGrid && y <= maxY; y++) {
        const isMajorLine = (y % 10 === 0);
        const isMinorLine = (y % 5 === 0);

        if (isMinorLine) {
            const pos = gridOffset + (y - minY) * scale;

            ctx.beginPath();
            if (isMajorLine) {
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 2;
            } else {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1;
            }
            ctx.moveTo(gridOffset, pos); ctx.lineTo(canvas.width, pos);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    if ((AppState.fillMode || AppState.clearBaseMode) && AppState.fillSelection) {
        const startX = Math.min(AppState.fillSelection.startX, AppState.fillSelection.endX);
        const endX = Math.max(AppState.fillSelection.startX, AppState.fillSelection.endX);
        const startY = Math.min(AppState.fillSelection.startY, AppState.fillSelection.endY);
        const endY = Math.max(AppState.fillSelection.startY, AppState.fillSelection.endY);
        const drawX = gridOffset + (startX - minX) * scale;
        const drawY = gridOffset + (startY - minY) * scale;
        const drawW = (endX - startX + 1) * scale;
        const drawH = (endY - startY + 1) * scale;

        ctx.save();
        ctx.fillStyle = getThemePrimaryColor(0.14);
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.strokeStyle = getThemePrimaryColor(0.95);
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(drawX + 1, drawY + 1, drawW - 2, drawH - 2);
        ctx.setLineDash([]);
        ctx.restore();
    }

    if (canvas.id === 'result-canvas' && AppState.qualityOverlayVisible && AppState.qualityIssues?.length) {
        ctx.save();
        for (const issue of AppState.qualityIssues) {
            const index = issue.index;
            if (!Number.isInteger(index) || pixelArray[index]?.id === 'NONE') continue;
            const x = gridOffset + (index % gridWidth - minX) * scale;
            const y = gridOffset + (Math.floor(index / gridWidth) - minY) * scale;
            ctx.setLineDash(issue.active ? [6, 3] : []);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 6;
            ctx.strokeRect(x + 2, y + 2, scale - 4, scale - 4);
            ctx.strokeStyle = issue.ignored ? '#7b8493' : issue.selected === false ? '#c77713' : getThemePrimaryColor(1);
            ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, scale - 4, scale - 4);
            if (issue.suggestion) {
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(x + scale - 5, y + 5, 4, 0, Math.PI * 2);
                ctx.fillStyle = issue.suggestion.id === 'NONE' ? '#ffffff' : `rgb(${issue.suggestion.r},${issue.suggestion.g},${issue.suggestion.b})`;
                ctx.fill(); ctx.strokeStyle = '#27303e'; ctx.lineWidth = 1; ctx.stroke();
                if (issue.suggestion.id === 'NONE') {
                    ctx.beginPath(); ctx.moveTo(x + scale - 7, y + 3); ctx.lineTo(x + scale - 3, y + 7);
                    ctx.moveTo(x + scale - 3, y + 3); ctx.lineTo(x + scale - 7, y + 7); ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    if (previewIndices.size) {
        const matches = (x, y) => x >= 0 && y >= 0 && x < gridWidth && y < gridHeight
            && previewIndices.has(y * gridWidth + x);
        ctx.save();
        ctx.strokeStyle = getThemePrimaryColor(1);
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (!matches(x, y)) continue;
                const left = gridOffset + (x - minX) * scale;
                const top = gridOffset + (y - minY) * scale;
                // Only exposed edges: adjacent same-color cells share no outline.
                if (!matches(x, y - 1)) { ctx.moveTo(left, top); ctx.lineTo(left + scale, top); }
                if (!matches(x + 1, y)) { ctx.moveTo(left + scale, top); ctx.lineTo(left + scale, top + scale); }
                if (!matches(x, y + 1)) { ctx.moveTo(left + scale, top + scale); ctx.lineTo(left, top + scale); }
                if (!matches(x - 1, y)) { ctx.moveTo(left, top + scale); ctx.lineTo(left, top); }
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    renderFixedRuler();
}

/**
 * 更新 Canvas 变换 (缩放和平移)
 * @param {HTMLCanvasElement} canvas - 目标 Canvas
 * @param {Object} zoomState - 缩放状态
 * @param {HTMLElement} resetBtn - 重置按钮
 */
export function updateResultTransform(canvas, zoomState, resetBtn) {
    canvas.style.transform = `translate3d(${zoomState.x}px, ${zoomState.y}px, 0) scale(${zoomState.scale})`;
    canvas.style.transformOrigin = '0 0';
    
    if (zoomState.scale !== 1 || zoomState.x !== 0 || zoomState.y !== 0) {
        resetBtn.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        resetBtn.classList.add('opacity-0', 'pointer-events-none');
    }

    renderFixedRuler();
}

/**
 * 重置缩放以适配容器
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLCanvasElement} canvas - 画布元素
 * @returns {Object} - 新的缩放状态
 */
export function getResetZoomState(container, canvas) {
    const containerWidth = container.clientWidth || window.innerWidth;
    const containerHeight = container.clientHeight || (window.innerHeight - 200); // 扣除顶部和底部面板的大致高度
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    const padding = 40;
    const scaleX = (containerWidth - padding) / canvasWidth;
    const scaleY = (containerHeight - padding) / canvasHeight;
    // 确保 scale 是正数且合理
    const fitScale = Math.max(Math.min(scaleX, scaleY, 1.0), 0.1); 
    
    return { 
        scale: fitScale, 
        fitScale,
        x: (containerWidth - canvasWidth * fitScale) / 2, 
        y: (containerHeight - canvasHeight * fitScale) / 2, 
        isDragging: false, 
        lastX: 0, 
        lastY: 0, 
        lastDist: 0 
    };
}
