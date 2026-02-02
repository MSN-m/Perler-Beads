/**
 * 拼豆图纸生成器 - Canvas 渲染与视图控制
 */
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
    const boardSize = Math.max(gridWidth, gridHeight) <= 52 ? 52 : 104;
    const margin = boardSize === 52 ? 2 : 4;
    const scale = 30; // 预览比例
    
    const totalGrids = boardSize + 1;
    canvas.width = totalGrids * scale;
    canvas.height = totalGrids * scale;
    
    ctx.imageSmoothingEnabled = false;

    // 1. 绘制背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. 绘制网格背景 (从 1, 1 开始)
    const gridOffset = scale; // 标尺宽度
    const offsetX = Math.floor((boardSize - gridWidth) / 2);
    const offsetY = Math.floor((boardSize - gridHeight) / 2);

    // 绘制色块
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const i = (y * gridWidth + x);
            const color = pixelArray[i];
            const drawX = gridOffset + (x + offsetX) * scale;
            const drawY = gridOffset + (y + offsetY) * scale;

            ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            ctx.fillRect(drawX, drawY, scale, scale);
        }
    }

    // 3. 高亮处理
    if (highlightedColorId !== null) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(gridOffset, gridOffset, boardSize * scale, boardSize * scale);

        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const i = (y * gridWidth + x);
                const color = pixelArray[i];
                if (color.id === highlightedColorId) {
                    const drawX = gridOffset + (x + offsetX) * scale;
                    const drawY = gridOffset + (y + offsetY) * scale;
                    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
                    ctx.fillRect(drawX + 1, drawY + 1, scale - 2, scale - 2);
                }
            }
        }
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // 4. 网格线、辅助线、标尺和 ID
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 4.1 基础网格线
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i <= boardSize; i++) {
        const pos = gridOffset + i * scale;
        ctx.beginPath();
        ctx.moveTo(pos, gridOffset); ctx.lineTo(pos, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gridOffset, pos); ctx.lineTo(canvas.width, pos);
        ctx.stroke();
    }

    // 4.2 ID 文字
    ctx.font = `bold ${Math.floor(scale * 0.4)}px Arial`;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const i = (y * gridWidth + x);
            const color = pixelArray[i];
            if (highlightedColorId === null || highlightedColorId === color.id) {
                const drawX = gridOffset + (x + offsetX) * scale;
                const drawY = gridOffset + (y + offsetY) * scale;
                const yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
                ctx.fillStyle = yiq >= 128 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
                ctx.fillText(color.id, drawX + scale / 2, drawY + scale / 2);
            }
        }
    }

    // 4.3 辅助线
    for (let gridIdx = 1; gridIdx < boardSize; gridIdx++) {
        const pos = gridOffset + gridIdx * scale;
        const isMarginLine = (gridIdx === margin || gridIdx === boardSize - margin);
        const isMajorLine = (gridIdx % 10 === 0);
        const isMinorLine = (gridIdx % 5 === 0);

        if (isMarginLine || isMinorLine) {
            ctx.beginPath();
            if (isMarginLine || isMajorLine) {
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
            ctx.moveTo(gridOffset, pos); ctx.lineTo(canvas.width, pos);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // 4.4 外部标尺
    ctx.font = `bold ${Math.floor(scale * 0.4)}px Arial`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    for (let i = 1; i <= boardSize; i++) {
        const textPos = gridOffset + (i - 1) * scale + scale / 2;
        ctx.fillText(i.toString(), textPos, scale / 2);
        ctx.fillText(i.toString(), scale / 2, textPos);
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
        x: (containerWidth - canvasWidth * fitScale) / 2, 
        y: (containerHeight - canvasHeight * fitScale) / 2, 
        isDragging: false, 
        lastX: 0, 
        lastY: 0, 
        lastDist: 0 
    };
}
