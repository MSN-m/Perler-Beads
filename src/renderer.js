import { AppState } from './state.js';

/**
 * 渲染图纸结果
 * @param {HTMLCanvasElement} canvas - 目标 Canvas
 * @param {Array} pixelArray - 像素数据
 * @param {number} gridWidth - 图案宽度
 * @param {number} gridHeight - 图案高度
 * @param {string|null} highlightedColorId - 高亮的颜色 ID
 */
export function renderResult(canvas, pixelArray, gridWidth, gridHeight, highlightedColorId = null) {
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

    // 2. 绘制背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. 绘制内容
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
            if (AppState.edgeSelectionMode && AppState.selectedEdgeBeadsIndices.includes(i)) {
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; // 黄色高亮
                ctx.lineWidth = 2;
                ctx.strokeRect(drawX + 1, drawY + 1, scale - 2, scale - 2);
            }
        }
    }

    // 4. 高亮处理
    if (highlightedColorId !== null) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(gridOffset, gridOffset, contentWidth * scale, contentHeight * scale);

        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const i = (y * gridWidth + x);
                const color = pixelArray[i];
                if (color.id === highlightedColorId) {
                    const drawX = gridOffset + (x - minX) * scale;
                    const drawY = gridOffset + (y - minY) * scale;
                    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
                    ctx.fillRect(drawX + 1, drawY + 1, scale - 2, scale - 2);
                }
            }
        }
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // 5. 网格线、辅助线、标尺和 ID
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
            if (highlightedColorId === null || highlightedColorId === color.id) {
                const drawX = gridOffset + (x - minX) * scale;
                const drawY = gridOffset + (y - minY) * scale;
                const yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
                ctx.fillStyle = yiq >= 128 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
                ctx.fillText(color.id, drawX + scale / 2, drawY + scale / 2);
            }
        }
    }

    // 5.3 辅助线 (基于全局坐标计算是否为 5/10 倍数)
    // 垂直辅助线
    for (let x = minX + 1; x <= maxX; x++) {
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
    for (let y = minY + 1; y <= maxY; y++) {
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

    // 5.4 外部标尺 (显示全局坐标)
    ctx.font = `bold ${Math.floor(scale * 0.4)}px Arial`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    // 横向标尺
    for (let i = 0; i < contentWidth; i++) {
        const globalX = minX + i + 1; // 标尺从1开始
        const textPos = gridOffset + i * scale + scale / 2;
        ctx.fillText(globalX.toString(), textPos, scale / 2);
    }
    // 纵向标尺
    for (let i = 0; i < contentHeight; i++) {
        const globalY = minY + i + 1; // 标尺从1开始
        const textPos = gridOffset + i * scale + scale / 2;
        ctx.fillText(globalY.toString(), scale / 2, textPos);
    }

    if (AppState.fillMode && AppState.fillSelection) {
        const startX = Math.min(AppState.fillSelection.startX, AppState.fillSelection.endX);
        const endX = Math.max(AppState.fillSelection.startX, AppState.fillSelection.endX);
        const startY = Math.min(AppState.fillSelection.startY, AppState.fillSelection.endY);
        const endY = Math.max(AppState.fillSelection.startY, AppState.fillSelection.endY);
        const drawX = gridOffset + (startX - minX) * scale;
        const drawY = gridOffset + (startY - minY) * scale;
        const drawW = (endX - startX + 1) * scale;
        const drawH = (endY - startY + 1) * scale;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 127, 80, 0.14)';
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.strokeStyle = 'rgba(255, 127, 80, 0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(drawX + 1, drawY + 1, drawW - 2, drawH - 2);
        ctx.setLineDash([]);
        ctx.restore();
    }
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
