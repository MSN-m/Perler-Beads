import { AppState } from '../state.js';

const CELL_SIZE = 30;
const RULER_SIZE = 28;

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
    const startX = firstVisibleCell(originX, cellSize, RULER_SIZE);
    const endX = lastVisibleCell(originX, cellSize, width);
    const startY = firstVisibleCell(originY, cellSize, RULER_SIZE);
    const endY = lastVisibleCell(originY, cellSize, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(RULER_SIZE, RULER_SIZE, width - RULER_SIZE, height - RULER_SIZE);
    ctx.clip();

    for (let x = startX; x <= endX; x += gridStep) {
        const pos = originX + x * cellSize;
        const isMajor = x % 10 === 0;
        const isMinor = x % 5 === 0;
        ctx.beginPath();
        ctx.moveTo(Math.round(pos) + 0.5, RULER_SIZE);
        ctx.lineTo(Math.round(pos) + 0.5, height);
        ctx.strokeStyle = isMajor ? 'rgba(96, 165, 250, 0.48)' : isMinor ? 'rgba(147, 197, 253, 0.34)' : 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = isMajor ? 1.4 : 1;
        ctx.setLineDash(isMajor || !isMinor ? [] : [4, 4]);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridStep) {
        const pos = originY + y * cellSize;
        const isMajor = y % 10 === 0;
        const isMinor = y % 5 === 0;
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE, Math.round(pos) + 0.5);
        ctx.lineTo(width, Math.round(pos) + 0.5);
        ctx.strokeStyle = isMajor ? 'rgba(96, 165, 250, 0.48)' : isMinor ? 'rgba(147, 197, 253, 0.34)' : 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = isMajor ? 1.4 : 1;
        ctx.setLineDash(isMajor || !isMinor ? [] : [4, 4]);
        ctx.stroke();
    }

    ctx.restore();
}

function drawRulers(ctx, width, height, originX, originY, cellSize) {
    const startX = firstVisibleCell(originX, cellSize, RULER_SIZE);
    const endX = lastVisibleCell(originX, cellSize, width);
    const startY = firstVisibleCell(originY, cellSize, RULER_SIZE);
    const endY = lastVisibleCell(originY, cellSize, height);
    ctx.font = '600 11px Arial';
    const labelWidth = Math.max(
        ctx.measureText(String(startX + 1)).width,
        ctx.measureText(String(endX + 1)).width
    );
    const horizontalStep = getLabelStep(cellSize, Math.max(22, labelWidth + 8));
    const verticalStep = getLabelStep(cellSize, 18);

    ctx.fillStyle = 'rgba(248, 250, 252, 0.97)';
    ctx.fillRect(0, 0, width, RULER_SIZE);
    ctx.fillRect(0, 0, RULER_SIZE, height);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.34)';
    ctx.fillRect(0, RULER_SIZE - 1, width, 1);
    ctx.fillRect(RULER_SIZE - 1, 0, 1, height);

    ctx.save();
    ctx.font = '600 11px Arial';
    ctx.fillStyle = 'rgba(71, 85, 105, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.rect(RULER_SIZE, 0, width - RULER_SIZE, RULER_SIZE);
    ctx.clip();
    for (let x = startX; x <= endX; x++) {
        if (x % horizontalStep !== 0) continue;
        const center = originX + (x + 0.5) * cellSize;
        if (center < RULER_SIZE || center > width) continue;
        ctx.fillText(String(x + 1), center, RULER_SIZE / 2);
    }
    ctx.restore();

    ctx.save();
    ctx.font = '600 11px Arial';
    ctx.fillStyle = 'rgba(71, 85, 105, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.rect(0, RULER_SIZE, RULER_SIZE, height - RULER_SIZE);
    ctx.clip();
    for (let y = startY; y <= endY; y++) {
        if (y % verticalStep !== 0) continue;
        const center = originY + (y + 0.5) * cellSize;
        if (center < RULER_SIZE || center > height) continue;
        ctx.fillText(String(y + 1), RULER_SIZE / 2, center);
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
