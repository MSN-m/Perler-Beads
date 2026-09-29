import { AppState } from '../state.js';

const CELL_SIZE = 30;
const TOP_RULER_HEIGHT = 33;
const LEFT_RULER_WIDTH = 32;

function isDesktopWorkbench() {
    return document.getElementById('workbench-layout')?.dataset.viewport === 'desktop';
}

function getLabelStep(cellSize, minSpacing) {
    return [1, 5, 10, 20].find(step => step * cellSize >= minSpacing) || 20;
}

function getGridStep(cellSize) {
    if (cellSize >= 4) return 1;
    if (cellSize >= 2) return 5;
    return 10;
}

function firstVisibleCell(origin, cellSize, viewportStart) {
    return Math.floor((viewportStart - origin) / cellSize) - 1;
}

function lastVisibleCell(origin, cellSize, viewportEnd) {
    return Math.ceil((viewportEnd - origin) / cellSize) + 1;
}

function drawGrid(ctx, width, height, originX, originY, cellSize) {
    const gridStep = getGridStep(cellSize);
    const startX = firstVisibleCell(originX, cellSize, LEFT_RULER_WIDTH);
    const endX = lastVisibleCell(originX, cellSize, width);
    const startY = firstVisibleCell(originY, cellSize, TOP_RULER_HEIGHT);
    const endY = lastVisibleCell(originY, cellSize, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(LEFT_RULER_WIDTH, TOP_RULER_HEIGHT, width - LEFT_RULER_WIDTH, height - TOP_RULER_HEIGHT);
    ctx.clip();

    // 用均匀点阵代替逐格浅色实线，缩小时沿用网格降采样避免过密。
    const dotRadius = Math.max(0.6, Math.min(1.15, cellSize * 0.035));
    ctx.fillStyle = 'rgba(206, 146, 168, 0.2)';
    for (let x = startX; x <= endX; x += gridStep) {
        const dotX = originX + x * cellSize;
        if (dotX < LEFT_RULER_WIDTH || dotX > width) continue;
        for (let y = startY; y <= endY; y += gridStep) {
            const dotY = originY + y * cellSize;
            if (dotY < TOP_RULER_HEIGHT || dotY > height) continue;
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 继续保留每 5 格虚线和每 10 格深色实线。
    for (let x = startX; x <= endX; x += gridStep) {
        const pos = originX + x * cellSize;
        const isMajor = x % 10 === 0;
        const isMinor = x % 5 === 0;
        if (!isMajor && !isMinor) continue;
        ctx.beginPath();
        ctx.moveTo(Math.round(pos) + 0.5, TOP_RULER_HEIGHT);
        ctx.lineTo(Math.round(pos) + 0.5, height);
        ctx.strokeStyle = isMajor ? 'rgba(206, 146, 168, 0.6)' : 'rgba(206, 146, 168, 0.4)';
        ctx.lineWidth = isMajor ? 1.4 : 1;
        ctx.setLineDash(isMajor ? [] : [4, 4]);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridStep) {
        const pos = originY + y * cellSize;
        const isMajor = y % 10 === 0;
        const isMinor = y % 5 === 0;
        if (!isMajor && !isMinor) continue;
        ctx.beginPath();
        ctx.moveTo(LEFT_RULER_WIDTH, Math.round(pos) + 0.5);
        ctx.lineTo(width, Math.round(pos) + 0.5);
        ctx.strokeStyle = isMajor ? 'rgba(206, 146, 168, 0.6)' : 'rgba(206, 146, 168, 0.4)';
        ctx.lineWidth = isMajor ? 1.4 : 1;
        ctx.setLineDash(isMajor ? [] : [4, 4]);
        ctx.stroke();
    }

    ctx.restore();
}

function drawRulers(ctx, width, height, originX, originY, cellSize) {
    const startX = firstVisibleCell(originX, cellSize, LEFT_RULER_WIDTH);
    const endX = lastVisibleCell(originX, cellSize, width);
    const startY = firstVisibleCell(originY, cellSize, TOP_RULER_HEIGHT);
    const endY = lastVisibleCell(originY, cellSize, height);
    ctx.font = '600 11px Arial';
    const labelWidth = Math.max(
        ctx.measureText(String(startX + 1)).width,
        ctx.measureText(String(endX + 1)).width
    );
    const horizontalStep = getLabelStep(cellSize, Math.max(22, labelWidth + 8));
    const verticalStep = getLabelStep(cellSize, 18);
    const tickStep = getGridStep(cellSize);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(39, 46, 62, 0.08)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, TOP_RULER_HEIGHT);
    ctx.lineTo(LEFT_RULER_WIDTH, TOP_RULER_HEIGHT);
    ctx.lineTo(LEFT_RULER_WIDTH, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font = '600 11px Inter, Arial';
    ctx.fillStyle = '#A0A6B3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.rect(LEFT_RULER_WIDTH, 0, width - LEFT_RULER_WIDTH, TOP_RULER_HEIGHT);
    ctx.clip();
    for (let x = startX; x <= endX; x++) {
        if (x % horizontalStep !== 0) continue;
        const center = originX + (x + 0.5) * cellSize;
        if (center < LEFT_RULER_WIDTH || center > width) continue;
        ctx.fillText(String(x + 1), center, 16);
    }
    ctx.fillStyle = '#A0A6B3';
    for (let x = startX; x <= endX; x++) {
        if (x % tickStep !== 0) continue;
        const pos = originX + x * cellSize;
        if (pos < LEFT_RULER_WIDTH || pos > width) continue;
        const length = x % 10 === 0 ? 8 : 5;
        ctx.fillRect(Math.round(pos), TOP_RULER_HEIGHT - length, 1, length);
    }
    ctx.restore();

    ctx.save();
    ctx.font = '600 11px Inter, Arial';
    ctx.fillStyle = '#A0A6B3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.rect(0, TOP_RULER_HEIGHT, LEFT_RULER_WIDTH, height - TOP_RULER_HEIGHT);
    ctx.clip();
    for (let y = startY; y <= endY; y++) {
        if (y % verticalStep !== 0) continue;
        const center = originY + (y + 0.5) * cellSize;
        if (center < TOP_RULER_HEIGHT || center > height) continue;
        ctx.fillText(String(y + 1), 16, center);
    }
    ctx.fillStyle = '#A0A6B3';
    for (let y = startY; y <= endY; y++) {
        if (y % tickStep !== 0) continue;
        const pos = originY + y * cellSize;
        if (pos < TOP_RULER_HEIGHT || pos > height) continue;
        const length = y % 10 === 0 ? 8 : 5;
        ctx.fillRect(LEFT_RULER_WIDTH - length, Math.round(pos), length, 1);
    }
    ctx.restore();
}

export function renderFixedRuler() {
    const rulerCanvas = document.getElementById('fixed-ruler-canvas');
    const resultCanvas = document.getElementById('result-canvas');
    const resultContainer = document.getElementById('result-container');
    const isVisible = Boolean(
        rulerCanvas
        && resultCanvas
        && resultContainer
        && !resultCanvas.classList.contains('hidden')
        && isDesktopWorkbench()
        && AppState.currentStep === 3
    );

    if (!rulerCanvas) return;
    rulerCanvas.classList.toggle('hidden', !isVisible);
    if (!isVisible) return;

    const width = resultContainer.clientWidth;
    const height = resultContainer.clientHeight;
    if (!width || !height) return;

    const dpr = window.devicePixelRatio || 1;
    rulerCanvas.width = Math.round(width * dpr);
    rulerCanvas.height = Math.round(height * dpr);
    const ctx = rulerCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const containerRect = resultContainer.getBoundingClientRect();
    const canvasRect = resultCanvas.getBoundingClientRect();
    const zoom = AppState.zoomState?.scale || 1;
    const cellSize = CELL_SIZE * zoom;
    if (!Number.isFinite(cellSize) || cellSize <= 0) return;

    const canvasLeft = canvasRect.left - containerRect.left;
    const canvasTop = canvasRect.top - containerRect.top;
    const minX = AppState.renderedMinX || 0;
    const minY = AppState.renderedMinY || 0;
    const originX = canvasLeft + CELL_SIZE * zoom - minX * cellSize;
    const originY = canvasTop + CELL_SIZE * zoom - minY * cellSize;

    drawGrid(ctx, width, height, originX, originY, cellSize);
    drawRulers(ctx, width, height, originX, originY, cellSize);
}
