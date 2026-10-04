/**

 * 删除色块功能模块

 * 依赖：AppState, renderResult, calculateStats, deepClonePixels

 */

import { AppState } from '../state.js';

import { renderResult } from '../renderer.js';



import { calculateStats, deepClonePixels, beginGlobalEditorSession, setActiveEditorTool, recordPixelAction, updateAdjustUndoButton } from '../editor.js';
import { refreshQualityOverlay } from './quality.js';



// ─── 弹窗 ────────────────────────────────────────────────────────────────────



function showDeleteConfirmModal(callback) {

    const modal = document.getElementById('delete-confirm-modal');

    modal.classList.remove('hidden');

    const confirmBtn = document.getElementById('delete-confirm-yes');

    const cancelBtn = document.getElementById('delete-confirm-no');



    const confirmHandler = () => {

        confirmBtn.removeEventListener('click', confirmHandler);

        cancelBtn.removeEventListener('click', cancelHandler);

        hideDeleteConfirmModal();

        callback(true);

    };

    const cancelHandler = () => {

        confirmBtn.removeEventListener('click', confirmHandler);

        cancelBtn.removeEventListener('click', cancelHandler);

        hideDeleteConfirmModal();

        callback(false);

    };



    confirmBtn.addEventListener('click', confirmHandler);

    cancelBtn.addEventListener('click', cancelHandler);

}



function hideDeleteConfirmModal() {

    document.getElementById('delete-confirm-modal').classList.add('hidden');

}



// ─── 模式切换 ─────────────────────────────────────────────────────────────────



export function toggleDeleteMode() {

    const resultCanvas = document.getElementById('result-canvas');

    const undoBtn = document.getElementById('adjust-undo-btn');

    const cancelBtn = document.getElementById('adjust-cancel-btn');

    const applyBtn = document.getElementById('adjust-apply-btn');

    const btn = document.getElementById('toggle-delete-btn');

    const edgeBtn = document.getElementById('toggle-edge-adjust-btn');

    const entering = !AppState.deleteMode;



    if (entering) {

        AppState.colorEraseMode = false;

        AppState.editMode = 'delete';

        AppState.deleteMode = true;

        AppState.adjustPhase = 'waiting_receiver';

        AppState.receiverIndex = null;

        if (!AppState.stagedPixelData) {
            AppState.stagedPixelData = deepClonePixels(AppState.pixelData);
            beginGlobalEditorSession(AppState.pixelData);
        }
        setActiveEditorTool('eraser');

        if (!AppState.editor.undoStack.length) AppState.stagedActions = [];

        AppState.selectedEdgeBeadsIndices = [];

        AppState.edgeSelectionMode = false;

        AppState.clearBaseMode = false;

        AppState.fillMode = false;

        AppState.fillColor = null;

        AppState.fillColorId = null;

        AppState.fillSourceIndex = null;

        AppState.preAdjustZoomState = null;



        btn && btn.classList.add('bg-primary', 'text-white');

        edgeBtn && edgeBtn.classList.remove('bg-primary', 'text-white');

        undoBtn && undoBtn.classList.add('hidden');

        cancelBtn && cancelBtn.classList.add('hidden');

        applyBtn && applyBtn.classList.add('hidden');



        if (resultCanvas) {

            resultCanvas.classList.remove('cursor-grab', 'cursor-grabbing');

            resultCanvas.classList.add('cursor-crosshair');

            resultCanvas.style.cursor = 'crosshair';

        }

        renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

    } else {

        AppState.editMode = 'none';

        AppState.deleteMode = false;

        AppState.adjustPhase = 'waiting_receiver';

        AppState.receiverIndex = null;

        AppState.stagedPixelData = null;

        AppState.stagedActions = [];

        AppState.selectedEdgeBeadsIndices = [];

        AppState.edgeSelectionMode = false;

        AppState.clearBaseMode = false;

        AppState.fillMode = false;

        AppState.fillColor = null;

        AppState.fillColorId = null;

        AppState.fillSourceIndex = null;



        btn && btn.classList.remove('bg-primary', 'text-white');

        undoBtn && undoBtn.classList.add('hidden');

        cancelBtn && cancelBtn.classList.add('hidden');

        applyBtn && applyBtn.classList.add('hidden');



        if (resultCanvas) {

            resultCanvas.classList.remove('cursor-crosshair');

            resultCanvas.classList.add('cursor-grab');

            renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);

            calculateStats();

        }

        AppState.preAdjustZoomState = null;

    }

}



// ─── 画布点击处理 ─────────────────────────────────────────────────────────────



/**

 * 在删除模式下处理画布点击

 * @param {number} idx - 被点击的像素索引

 * @param {HTMLCanvasElement} canvas

 */

export function activateEraserTool(tool = 'eraser') {
    if (AppState.eraserStroke) return;
    if (!AppState.stagedPixelData) {
        AppState.stagedPixelData = deepClonePixels(AppState.pixelData);
        beginGlobalEditorSession(AppState.pixelData);
    }
    AppState.editMode = 'delete';
    AppState.deleteMode = tool !== 'area-erase';
    AppState.clearBaseMode = tool === 'area-erase';
    AppState.colorEraseMode = tool === 'color-eraser';
    AppState.fillMode = false;
    AppState.eyedropperMode = false;
    AppState.edgeSelectionMode = false;
    AppState.selectedEdgeBeadsIndices = [];
    AppState.fillSelection = null;
    AppState.receiverIndex = null;
    AppState.adjustPhase = 'waiting_receiver';
    AppState.batchReplace.active = false;
    AppState.batchReplace.mode = null;
    setActiveEditorTool(tool);
    redrawErase(document.getElementById('result-canvas'));
}

export function toggleColorEraseMode() {
    activateEraserTool('color-eraser');
}

const EMPTY = { id: 'NONE', r: 0, g: 0, b: 0, a: 0 };

function occupiedCount(pixels) {
    return pixels.reduce((count, pixel) => count + Boolean(pixel && pixel.id !== 'NONE'), 0);
}

function warnLastBead() {
    let notice = document.getElementById('eraser-status');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'eraser-status';
        notice.setAttribute('role', 'status');
        notice.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:12px;background:#252936;color:white;z-index:10000;pointer-events:none';
        document.body.appendChild(notice);
    }
    notice.textContent = '图纸至少需要保留一颗豆子';
    notice.hidden = false;
    clearTimeout(warnLastBead.timer);
    warnLastBead.timer = setTimeout(() => { notice.hidden = true; }, 2200);
}

function redrawErase(canvas, complete = false) {
    if (!canvas) return;
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    if (complete) {
        calculateStats();
        updateAdjustUndoButton();
        refreshQualityOverlay();
    }
}

export function connectedEraseIndices(pixels, start, width) {
    const color = pixels[start]?.id;
    if (!color || color === 'NONE') return [];
    const queue = [start], seen = new Set([start]), indices = [];
    for (let head = 0; head < queue.length; head++) {
        const index = queue[head];
        if (pixels[index]?.id !== color) continue;
        indices.push(index);
        const x = index % width;
        const neighbors = [index - width, index + width];
        if (x > 0) neighbors.push(index - 1);
        if (x < width - 1) neighbors.push(index + 1);
        for (const next of neighbors) {
            if (next < 0 || next >= pixels.length || seen.has(next)) continue;
            seen.add(next);
            queue.push(next);
        }
    }
    return indices;
}

export function eraseIndices(indices, canvas) {
    const pixels = AppState.stagedPixelData;
    const targets = [...new Set(indices)].filter(index => pixels?.[index]?.id && pixels[index].id !== 'NONE');
    if (!targets.length) return false;
    if (targets.length >= occupiedCount(pixels)) { warnLastBead(); return false; }
    const prevColors = targets.map(index => ({ ...pixels[index] }));
    targets.forEach(index => { pixels[index] = { ...EMPTY }; });
    AppState.eraserHoverColorId = null;
    AppState.operationHoverIndex = null;
    recordPixelAction({ indices: targets, prevColors, nextColor: { ...EMPTY } });
    redrawErase(canvas, true);
    return true;
}

export function handleAreaDeleteClick(index, canvas) {
    return eraseIndices(connectedEraseIndices(AppState.stagedPixelData, index, AppState.gridWidth), canvas);
}

export function handleColorDeleteClick(index, canvas) {
    const color = AppState.stagedPixelData?.[index]?.id;
    if (!color || color === 'NONE') return false;
    const indices = [];
    AppState.stagedPixelData.forEach((pixel, idx) => { if (pixel.id === color) indices.push(idx); });
    return eraseIndices(indices, canvas);
}

export function handleDeleteClick(index, canvas) {
    return eraseIndices([index], canvas);
}

export function startEraserStroke(index, canvas) {
    AppState.eraserClickSuppressedUntil = 0;
    if (AppState.stagedPixelData?.[index]?.id === 'NONE' || !AppState.stagedPixelData?.[index]) return false;
    AppState.eraserStroke = {
        indices: [], prevColors: [], remaining: occupiedCount(AppState.stagedPixelData), lastIndex: index,
        minX: AppState.renderedMinX, minY: AppState.renderedMinY,
        width: AppState.renderedContentWidth, height: AppState.renderedContentHeight
    };
    moveEraserStroke(index, canvas);
    return true;
}

export function moveEraserStroke(index, canvas) {
    const stroke = AppState.eraserStroke;
    if (!stroke) return false;
    // Walk intermediate cells too, so fast pointer movement leaves no gaps.
    const width = AppState.gridWidth;
    let x = stroke.lastIndex % width, y = Math.floor(stroke.lastIndex / width);
    const endX = index % width, endY = Math.floor(index / width);
    const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
    const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
    let error = dx + dy;
    while (true) {
        const idx = y * width + x, pixel = AppState.stagedPixelData[idx];
        if (pixel && pixel.id !== 'NONE') {
            if (stroke.remaining > 1) {
                stroke.indices.push(idx);
                stroke.prevColors.push({ ...pixel });
                AppState.stagedPixelData[idx] = { ...EMPTY };
                stroke.remaining--;
            } else if (!stroke.warned) { warnLastBead(); stroke.warned = true; }
        }
        if (x === endX && y === endY) break;
        const doubled = 2 * error;
        if (doubled >= dy) { error += dy; x += sx; }
        if (doubled <= dx) { error += dx; y += sy; }
    }
    stroke.lastIndex = index;
    redrawErase(canvas);
    return true;
}

export function endEraserStroke(canvas) {
    const stroke = AppState.eraserStroke;
    if (!stroke) return false;
    AppState.eraserStroke = null;
    // Mouseup is followed by click; the stroke already performed that deletion.
    AppState.eraserClickSuppressedUntil = Date.now() + 600;
    if (stroke.indices.length) recordPixelAction({ indices: stroke.indices, prevColors: stroke.prevColors, nextColor: { ...EMPTY } });
    redrawErase(canvas, true);
    return true;
}

export function updateEraserHover(index, canvas) {
    const tool = AppState.editor.activeTool;
    const color = tool === 'color-eraser' ? AppState.stagedPixelData?.[index]?.id : null;
    const next = color && color !== 'NONE' ? color : null;
    const nextIndex = ['area-erase', 'bucket'].includes(tool) && Number.isInteger(index) ? index : null;
    if (next === AppState.eraserHoverColorId && nextIndex === AppState.operationHoverIndex) return;
    AppState.eraserHoverColorId = next;
    AppState.operationHoverIndex = nextIndex;
    redrawErase(canvas);
}
