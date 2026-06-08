/**

 * 编辑会话基础功能模块

 */

import { AppState } from '../state.js';

import { renderResult, updateResultTransform } from '../renderer.js';

import { handleDeleteClick } from './delete.js';

import { deepClonePixels, calculateStats, getCurrentPalette, performBatchReplace, updateAdjustUndoButton, resetBatchReplaceState, redmeanDistance } from '../editor.js';



function drawReceiverOutline(canvas, gx, gy) {

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const scale = 30;

    const gridOffset = scale;

    const minX = AppState.renderedMinX || 0;

    const minY = AppState.renderedMinY || 0;

    const drawX = gridOffset + (gx - minX) * scale;

    const drawY = gridOffset + (gy - minY) * scale;

    ctx.save();

    ctx.lineWidth = 3;

    ctx.strokeStyle = 'rgba(255, 127, 80, 0.9)';

    ctx.setLineDash([6, 4]);

    ctx.strokeRect(drawX + 1, drawY + 1, scale - 2, scale - 2);

    ctx.restore();

}

function getGridHitFromEvent(e) {

    const canvas = document.getElementById('result-canvas');

    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    const point = e.touches && e.touches[0]
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : e.changedTouches && e.changedTouches[0]
            ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
            : { x: e.clientX, y: e.clientY };

    const localX = point.x - rect.left;

    const localY = point.y - rect.top;

    const canvasX = localX / AppState.zoomState.scale;

    const canvasY = localY / AppState.zoomState.scale;

    const scale = 30;

    const gridOffset = scale;

    const minX = AppState.renderedMinX || 0;

    const minY = AppState.renderedMinY || 0;

    const contentWidth = AppState.renderedContentWidth || AppState.gridWidth;

    const contentHeight = AppState.renderedContentHeight || AppState.gridHeight;

    const xOnRenderedGrid = Math.floor((canvasX - gridOffset) / scale);

    const yOnRenderedGrid = Math.floor((canvasY - gridOffset) / scale);

    const gx = minX + xOnRenderedGrid;

    const gy = minY + yOnRenderedGrid;

    if (xOnRenderedGrid < 0 || yOnRenderedGrid < 0 || xOnRenderedGrid >= contentWidth || yOnRenderedGrid >= contentHeight) return null;

    if (gx < 0 || gy < 0 || gx >= AppState.gridWidth || gy >= AppState.gridHeight) return null;

    return { gx, gy, idx: gy * AppState.gridWidth + gx };

}

function applyFillSelection(canvas) {

    const selection = AppState.fillSelection;

    if (!selection || !AppState.fillColor) return;

    const minX = Math.min(selection.startX, selection.endX);

    const maxX = Math.max(selection.startX, selection.endX);

    const minY = Math.min(selection.startY, selection.endY);

    const maxY = Math.max(selection.startY, selection.endY);

    const indices = [];

    const prevColors = [];

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const idx = y * AppState.gridWidth + x;
            const pixel = AppState.stagedPixelData[idx];
            if (!pixel || pixel.id === 'NONE' || pixel.id === AppState.fillColorId) continue;
            indices.push(idx);
            prevColors.push({ ...pixel });
            AppState.stagedPixelData[idx] = { ...AppState.fillColor };
        }
    }

    if (indices.length > 0) {
        AppState.stagedActions.push({
            indices,
            prevColors,
            nextColor: { ...AppState.fillColor }
        });
    }

    AppState.fillSelection = null;
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    if (AppState.fillSourceIndex !== null) {
        const fillX = AppState.fillSourceIndex % AppState.gridWidth;
        const fillY = Math.floor(AppState.fillSourceIndex / AppState.gridWidth);
        drawReceiverOutline(canvas, fillX, fillY);
    }
    calculateStats();
    updateAdjustUndoButton();
}

function applyClearSelection(canvas) {

    const selection = AppState.fillSelection;

    if (!selection) return;

    const minX = Math.min(selection.startX, selection.endX);

    const maxX = Math.max(selection.startX, selection.endX);

    const minY = Math.min(selection.startY, selection.endY);

    const maxY = Math.max(selection.startY, selection.endY);

    const indices = [];

    const prevColors = [];

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const idx = y * AppState.gridWidth + x;
            const pixel = AppState.stagedPixelData[idx];
            if (!pixel || pixel.id === 'NONE') continue;
            indices.push(idx);
            prevColors.push({ ...pixel });
            AppState.stagedPixelData[idx] = { id: 'NONE', r: 0, g: 0, b: 0, a: 0 };
        }
    }

    if (indices.length > 0) {
        AppState.stagedActions.push({
            indices,
            prevColors,
            nextColor: { id: 'NONE', r: 0, g: 0, b: 0, a: 0 }
        });
    }

    AppState.fillSelection = null;
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    calculateStats();
    updateAdjustUndoButton();
}

function getNearestPaletteColor(color) {
    const palette = getCurrentPalette();
    if (!palette.length) return color;
    return palette
        .map((p) => ({ p, d: redmeanDistance(color.r, color.g, color.b, p.r, p.g, p.b) }))
        .sort((a, b) => a.d - b.d)[0].p;
}

function sampleFromOriginalImage(event) {
    if (AppState.comparePreviewDidDrag) {
        AppState.comparePreviewDidDrag = false;
        return null;
    }

    const previewCanvas = document.getElementById('compare-source-preview');
    const frame = document.getElementById('compare-source-frame');
    const sourceCanvas = document.getElementById('source-canvas');
    if (!previewCanvas || !frame || !sourceCanvas || !AppState.comparePreviewVisible) return null;

    const rect = previewCanvas.getBoundingClientRect();
    const point = event.touches && event.touches[0]
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : event.changedTouches && event.changedTouches[0]
            ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
            : { x: event.clientX, y: event.clientY };
    if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return null;

    const localX = point.x - rect.left;
    const localY = point.y - rect.top;
    const imgX = Math.floor((localX / rect.width) * previewCanvas.width);
    const imgY = Math.floor((localY / rect.height) * previewCanvas.height);
    const crop = AppState.cropRect || { x: 0, y: 0, width: sourceCanvas.width, height: sourceCanvas.height };
    const sourceX = crop.x + Math.max(0, Math.min(crop.width - 1, imgX));
    const sourceY = crop.y + Math.max(0, Math.min(crop.height - 1, imgY));
    const sourceCtx = sourceCanvas.getContext('2d');
    const data = sourceCtx.getImageData(sourceX, sourceY, 1, 1).data;
    return {
        r: data[0],
        g: data[1],
        b: data[2]
    };
}

function setFillColorFromSample(sampled) {
    const matched = getNearestPaletteColor(sampled);
    AppState.fillSourceSample = sampled;
    AppState.fillColorId = matched.id;
    AppState.fillColor = { id: matched.id, r: matched.r, g: matched.g, b: matched.b };
    AppState.fillSourceIndex = null;
    AppState.fillSelection = null;
}



function clearConnectedRegion(startIndex, canvas) {

    const startPixel = AppState.stagedPixelData[startIndex];

    if (!startPixel || startPixel.id === 'NONE') return;

    const targetId = startPixel.id;

    const visited = new Set();

    const queue = [startIndex];

    const indices = [];

    const prevColors = [];

    while (queue.length) {

        const idx = queue.shift();

        if (visited.has(idx)) continue;

        visited.add(idx);

        const pixel = AppState.stagedPixelData[idx];

        if (!pixel || pixel.id !== targetId) continue;

        indices.push(idx);

        prevColors.push({ ...pixel });

        const x = idx % AppState.gridWidth;

        const y = Math.floor(idx / AppState.gridWidth);

        if (x > 0) queue.push(idx - 1);

        if (x < AppState.gridWidth - 1) queue.push(idx + 1);

        if (y > 0) queue.push(idx - AppState.gridWidth);

        if (y < AppState.gridHeight - 1) queue.push(idx + AppState.gridWidth);

    }

    if (!indices.length) return;

    for (const idx of indices) {

        AppState.stagedPixelData[idx] = { id: 'NONE', r: 0, g: 0, b: 0, a: 0 };

    }

    AppState.stagedActions.push({

        indices,

        prevColors,

        nextColor: { id: 'NONE', r: 0, g: 0, b: 0, a: 0 }

    });

    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

    calculateStats();

    updateAdjustUndoButton();

}



function exitAdjustLikeMode(applyChanges) {

    const canvas = document.getElementById('result-canvas');

    const undoBtn = document.getElementById('adjust-undo-btn');

    const cancelBtn = document.getElementById('adjust-cancel-btn');

    const applyBtn = document.getElementById('adjust-apply-btn');

    const deleteBtn = document.getElementById('toggle-delete-btn');

    const edgeBtn = document.getElementById('toggle-edge-adjust-btn');



    if (applyChanges && AppState.stagedPixelData) {

        AppState.pixelData = deepClonePixels(AppState.stagedPixelData);

    }



    AppState.stagedPixelData = null;

    AppState.stagedActions = [];

    AppState.receiverIndex = null;

    AppState.adjustPhase = 'waiting_receiver';

    AppState.editMode = 'none';

    AppState.deleteMode = false;

    AppState.edgeSelectionMode = false;

    AppState.clearBaseMode = false;

    AppState.fillMode = false;

    AppState.fillSourceMode = 'canvas';

    AppState.fillColor = null;

    AppState.fillColorId = null;

    AppState.fillSourceIndex = null;

    AppState.fillSelection = null;

    AppState.selectedEdgeBeadsIndices = [];

    resetBatchReplaceState();



    renderResult(canvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);

    calculateStats();



    deleteBtn && deleteBtn.classList.remove('bg-primary', 'text-white');

    edgeBtn && edgeBtn.classList.remove('bg-primary', 'text-white');

    undoBtn && undoBtn.classList.add('hidden');

    cancelBtn && cancelBtn.classList.add('hidden');

    applyBtn && applyBtn.classList.add('hidden');

    canvas.classList.remove('cursor-crosshair');

    canvas.classList.add('cursor-grab');



    if (AppState.preAdjustZoomState) {

        AppState.zoomState = { ...AppState.preAdjustZoomState };

        updateResultTransform(canvas, AppState.zoomState, document.getElementById('zoom-reset-btn'));

    }

}



export function enterEditSession() {

    const resultCanvas = document.getElementById('result-canvas');

    const undoBtn = document.getElementById('adjust-undo-btn');

    const cancelBtn = document.getElementById('adjust-cancel-btn');

    const applyBtn = document.getElementById('adjust-apply-btn');

    const edgeBtn = document.getElementById('toggle-edge-adjust-btn');

    const deleteBtn = document.getElementById('toggle-delete-btn');

    if (AppState.editMode === 'adjust' && AppState.stagedPixelData) return;

    AppState.editMode = 'adjust';

    AppState.adjustPhase = 'waiting_receiver';

    AppState.receiverIndex = null;

    AppState.stagedPixelData = deepClonePixels(AppState.pixelData);

    AppState.stagedActions = [];

    AppState.selectedEdgeBeadsIndices = [];

    AppState.edgeSelectionMode = false;

    AppState.clearBaseMode = false;

    AppState.deleteMode = false;

    AppState.fillMode = false;

    AppState.fillSourceMode = 'canvas';

    AppState.fillColor = null;

    AppState.fillColorId = null;

    AppState.fillSourceIndex = null;

    AppState.fillSelection = null;

    resetBatchReplaceState();

    AppState.preAdjustZoomState = { ...AppState.zoomState };

    edgeBtn && edgeBtn.classList.remove('bg-primary', 'text-white');

    deleteBtn && deleteBtn.classList.remove('bg-primary', 'text-white');

    undoBtn && undoBtn.classList.remove('hidden');

    cancelBtn && cancelBtn.classList.remove('hidden');

    applyBtn && applyBtn.classList.remove('hidden');

    resultCanvas.classList.remove('cursor-grab', 'cursor-grabbing');

    resultCanvas.classList.add('cursor-crosshair');

    renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

    updateAdjustUndoButton();

}



export function toggleClearBaseMode() {

    if (AppState.editMode !== 'adjust') {

        enterEditSession();

    }

    AppState.clearBaseMode = true;

    AppState.edgeSelectionMode = false;

    AppState.deleteMode = false;

    AppState.fillMode = false;

    AppState.fillSourceMode = 'canvas';

    AppState.fillColor = null;

    AppState.fillColorId = null;

    AppState.fillSourceIndex = null;

    AppState.fillSelection = null;

    AppState.adjustPhase = 'waiting_receiver';

    AppState.receiverIndex = null;

    const resultCanvas = document.getElementById('result-canvas');

    renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

}



export function toggleFillMode() {

    if (AppState.editMode !== 'adjust') {

        enterEditSession();

    }

    AppState.fillMode = !AppState.fillMode;
    AppState.fillSourceMode = 'canvas';

    AppState.clearBaseMode = false;

    AppState.edgeSelectionMode = false;

    AppState.deleteMode = false;

    AppState.adjustPhase = 'waiting_receiver';

    AppState.receiverIndex = null;

    AppState.fillColor = null;

    AppState.fillColorId = null;

    AppState.fillSourceIndex = null;

    AppState.fillSelection = null;

    const resultCanvas = document.getElementById('result-canvas');

    renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

}

export function selectPaletteFillColor(color) {
    if (!color || color.id === 'NONE') return;

    if (AppState.editMode !== 'adjust') {
        enterEditSession();
    }

    AppState.fillMode = true;
    AppState.fillSourceMode = 'palette';
    AppState.clearBaseMode = false;
    AppState.edgeSelectionMode = false;
    AppState.deleteMode = false;
    AppState.adjustPhase = 'waiting_receiver';
    AppState.receiverIndex = null;
    AppState.fillColorId = color.id;
    AppState.fillColor = { id: color.id, r: color.r, g: color.g, b: color.b };
    AppState.fillSourceIndex = null;
    AppState.fillSourceSample = null;
    AppState.fillSelection = null;

    const resultCanvas = document.getElementById('result-canvas');
    renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    calculateStats();
    updateAdjustUndoButton();
}

export function setFillSourceMode(mode) {
    if (mode !== 'canvas' && mode !== 'original' && mode !== 'palette') return;
    AppState.fillSourceMode = mode;
    AppState.fillColor = null;
    AppState.fillColorId = null;
    AppState.fillSourceIndex = null;
    AppState.fillSelection = null;
    const canvas = document.getElementById('result-canvas');
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    if (AppState.fillSourceIndex !== null) {
        const fillX = AppState.fillSourceIndex % AppState.gridWidth;
        const fillY = Math.floor(AppState.fillSourceIndex / AppState.gridWidth);
        drawReceiverOutline(canvas, fillX, fillY);
    }
}

export function handleOriginalFillPick(event) {
    if (!AppState.fillMode || AppState.fillSourceMode !== 'original') return false;
    const sampled = sampleFromOriginalImage(event);
    if (!sampled) return false;
    setFillColorFromSample(sampled);
    const canvas = document.getElementById('result-canvas');
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    calculateStats();
    return true;
}

export function startWorkbenchCompareDrag(event) {
    if (!AppState.comparePreviewVisible) return false;
    const point = event.touches && event.touches[0]
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : { x: event.clientX, y: event.clientY };
    if (typeof point.x !== 'number' || typeof point.y !== 'number') return false;

    AppState.comparePreviewDragging = true;
    AppState.comparePreviewDidDrag = false;
    AppState.comparePreviewLastX = point.x;
    AppState.comparePreviewLastY = point.y;

    const previewCanvas = document.getElementById('compare-source-preview');
    if (previewCanvas) previewCanvas.classList.add('cursor-grabbing');
    return true;
}

export function moveWorkbenchCompareDrag(event) {
    if (!AppState.comparePreviewDragging) return false;
    const point = event.touches && event.touches[0]
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : { x: event.clientX, y: event.clientY };
    if (typeof point.x !== 'number' || typeof point.y !== 'number') return false;

    const dx = point.x - AppState.comparePreviewLastX;
    const dy = point.y - AppState.comparePreviewLastY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        AppState.comparePreviewDidDrag = true;
    }

    AppState.comparePreviewOffsetX += dx;
    AppState.comparePreviewOffsetY += dy;
    AppState.comparePreviewLastX = point.x;
    AppState.comparePreviewLastY = point.y;

    const previewCanvas = document.getElementById('compare-source-preview');
    if (previewCanvas) {
        const currentLeft = parseFloat(previewCanvas.style.left || '0');
        const currentTop = parseFloat(previewCanvas.style.top || '0');
        previewCanvas.style.left = `${Math.round(currentLeft + dx)}px`;
        previewCanvas.style.top = `${Math.round(currentTop + dy)}px`;
    }
    return true;
}

export function endWorkbenchCompareDrag() {
    if (!AppState.comparePreviewDragging) return false;
    const wasTap = !AppState.comparePreviewDidDrag;
    AppState.comparePreviewDragging = false;
    const previewCanvas = document.getElementById('compare-source-preview');
    if (previewCanvas) previewCanvas.classList.remove('cursor-grabbing');
    return wasTap;
}



export function handleResultCanvasClickForAdjust(e) {

    if (AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') return;



    const canvas = document.getElementById('result-canvas');

    const rect = canvas.getBoundingClientRect();

    const localX = e.clientX - rect.left;

    const localY = e.clientY - rect.top;

    const canvasX = localX / AppState.zoomState.scale;

    const canvasY = localY / AppState.zoomState.scale;

    const scale = 30;

    const gridOffset = scale;

    const minX = AppState.renderedMinX || 0;

    const minY = AppState.renderedMinY || 0;

    const contentWidth = AppState.renderedContentWidth || AppState.gridWidth;

    const contentHeight = AppState.renderedContentHeight || AppState.gridHeight;

    const xOnRenderedGrid = Math.floor((canvasX - gridOffset) / scale);

    const yOnRenderedGrid = Math.floor((canvasY - gridOffset) / scale);

    const gx = minX + xOnRenderedGrid;

    const gy = minY + yOnRenderedGrid;



    if (xOnRenderedGrid < 0 || yOnRenderedGrid < 0 || xOnRenderedGrid >= contentWidth || yOnRenderedGrid >= contentHeight) return;

    if (gx < 0 || gy < 0 || gx >= AppState.gridWidth || gy >= AppState.gridHeight) return;



    const idx = gy * AppState.gridWidth + gx;



    if (AppState.deleteMode) {

        handleDeleteClick(idx, canvas);

        return;

    }

    if (AppState.fillMode) {

        if (AppState.fillSourceMode === 'original') {
            const sampled = sampleFromOriginalImage(e);
            if (sampled) {
                const matched = getNearestPaletteColor(sampled);
                AppState.fillSourceSample = sampled;
                AppState.fillColorId = matched.id;
                AppState.fillColor = { id: matched.id, r: matched.r, g: matched.g, b: matched.b };
                AppState.fillSourceIndex = null;
                AppState.fillSelection = null;
                renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
                calculateStats();
                return;
            }
        }

        const pixel = AppState.stagedPixelData[idx];

        if (!pixel) return;

        if (!AppState.fillColor || !AppState.fillColorId) {

            if (pixel.id === 'NONE') return;

            AppState.fillColorId = pixel.id;

            AppState.fillColor = { id: pixel.id, r: pixel.r, g: pixel.g, b: pixel.b };

            AppState.fillSourceIndex = idx;

            renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

            drawReceiverOutline(canvas, gx, gy);

            calculateStats();

            return;

        }

        if (pixel.id === AppState.fillColorId) return;

        AppState.stagedActions.push({

            index: idx,

            prevColor: { ...pixel },

            nextColor: { ...AppState.fillColor }

        });

        AppState.stagedPixelData[idx] = { ...AppState.fillColor };

        renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

        if (AppState.fillSourceIndex !== null) {

            const fillX = AppState.fillSourceIndex % AppState.gridWidth;

            const fillY = Math.floor(AppState.fillSourceIndex / AppState.gridWidth);

            drawReceiverOutline(canvas, fillX, fillY);

        }

        calculateStats();

        updateAdjustUndoButton();

        return;

    }



    if (AppState.clearBaseMode) {

        clearConnectedRegion(idx, canvas);

        return;

    }

    if (AppState.edgeSelectionMode) {

        const donor = AppState.stagedPixelData[idx];

        if (!donor || donor.id === 'NONE') return;

        const newColor = { id: donor.id, r: donor.r, g: donor.g, b: donor.b };

        const prevEntries = [];



        for (const edgeIdx of AppState.selectedEdgeBeadsIndices) {

            const prev = AppState.stagedPixelData[edgeIdx];

            if (prev.id !== newColor.id) {

                prevEntries.push({ index: edgeIdx, prevColor: { ...prev } });

                AppState.stagedPixelData[edgeIdx] = { ...newColor };

            }

        }



        if (prevEntries.length > 0) {

            AppState.stagedActions.push({

                indices: prevEntries.map(p => p.index),

                prevColors: prevEntries.map(p => p.prevColor),

                nextColor: newColor

            });

        }



        renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

        calculateStats();

        updateAdjustUndoButton();

        return;

    }



    if (AppState.editMode === 'adjust' && AppState.batchReplace.active && AppState.batchReplace.mode === 'from_canvas') {

        const donor = AppState.stagedPixelData[idx];

        if (!donor || donor.id === 'NONE') return;

        const palette = getCurrentPalette();

        const target = palette.find(p => p.id === donor.id) || donor;

        performBatchReplace(AppState.batchReplace.sourceColorId, target);

        resetBatchReplaceState();

        return;

    }



    if (AppState.editMode === 'adjust' && !AppState.batchReplace.active) {

        if (AppState.adjustPhase === 'waiting_receiver') {

            const pixel = AppState.stagedPixelData[idx];

            if (!pixel || pixel.id === 'NONE') return;

            AppState.receiverIndex = idx;

            AppState.adjustPhase = 'waiting_donor';

            renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

            drawReceiverOutline(canvas, gx, gy);

            return;

        }



        if (AppState.adjustPhase === 'waiting_donor') {

            const donor = AppState.stagedPixelData[idx];

            if (!donor || donor.id === 'NONE') {

                AppState.adjustPhase = 'waiting_receiver';

                AppState.receiverIndex = null;

                renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

                return;

            }



            const receiverPixel = AppState.stagedPixelData[AppState.receiverIndex];

            if (!receiverPixel) {

                AppState.adjustPhase = 'waiting_receiver';

                return;

            }



            const prevColor = { id: receiverPixel.id, r: receiverPixel.r, g: receiverPixel.g, b: receiverPixel.b };

            const newColor = { id: donor.id, r: donor.r, g: donor.g, b: donor.b };

            AppState.stagedActions.push({ index: AppState.receiverIndex, prevColor, nextColor: newColor });

            AppState.stagedPixelData[AppState.receiverIndex] = { ...newColor };

            AppState.adjustPhase = 'waiting_receiver';

            AppState.receiverIndex = null;

            renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

            calculateStats();

            updateAdjustUndoButton();

        }

    }

}

export function startFillSelection(e) {

    if ((!AppState.fillMode || !AppState.fillColor) && !AppState.clearBaseMode) return false;

    const hit = getGridHitFromEvent(e);

    if (!hit) return false;

    const pixel = AppState.stagedPixelData[hit.idx];

    if (!pixel || pixel.id === 'NONE') return false;

    AppState.fillSelection = {
        startX: hit.gx,
        startY: hit.gy,
        endX: hit.gx,
        endY: hit.gy,
        didDrag: false
    };

    const canvas = document.getElementById('result-canvas');
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    if (AppState.fillSourceIndex !== null) {
        const fillX = AppState.fillSourceIndex % AppState.gridWidth;
        const fillY = Math.floor(AppState.fillSourceIndex / AppState.gridWidth);
        drawReceiverOutline(canvas, fillX, fillY);
    }

    return true;
}

export function moveFillSelection(e) {

    if (((!AppState.fillMode || !AppState.fillColor) && !AppState.clearBaseMode) || !AppState.fillSelection) return false;

    const hit = getGridHitFromEvent(e);

    if (!hit) return false;

    AppState.fillSelection.endX = hit.gx;

    AppState.fillSelection.endY = hit.gy;

    if (hit.gx !== AppState.fillSelection.startX || hit.gy !== AppState.fillSelection.startY) {
        AppState.fillSelection.didDrag = true;
    }

    const canvas = document.getElementById('result-canvas');
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    if (AppState.fillSourceIndex !== null) {
        const fillX = AppState.fillSourceIndex % AppState.gridWidth;
        const fillY = Math.floor(AppState.fillSourceIndex / AppState.gridWidth);
        drawReceiverOutline(canvas, fillX, fillY);
    }

    return true;
}

export function endFillSelection() {

    if (((!AppState.fillMode || !AppState.fillColor) && !AppState.clearBaseMode) || !AppState.fillSelection) return false;

    const canvas = document.getElementById('result-canvas');

    if (AppState.clearBaseMode) {
        if (!AppState.fillSelection.didDrag) {
            AppState.fillSelection = null;
            renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
            return false;
        }
        applyClearSelection(canvas);
    } else {
        applyFillSelection(canvas);
    }

    return true;
}



export function adjustUndo() {

    if ((AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') || !AppState.stagedActions.length) return;

    const action = AppState.stagedActions.pop();



    if (Array.isArray(action.indices)) {

        for (let i = 0; i < action.indices.length; i++) {

            AppState.stagedPixelData[action.indices[i]] = { ...action.prevColors[i] };

        }

    } else {

        AppState.stagedPixelData[action.index] = { ...action.prevColor };

    }



    const canvas = document.getElementById('result-canvas');

    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

    calculateStats();

    updateAdjustUndoButton();

}



export function adjustCancel() {

    if (AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') return;

    exitAdjustLikeMode(false);

}



export function adjustApply() {

    if (AppState.editMode !== 'adjust' && AppState.editMode !== 'delete') return;

    exitAdjustLikeMode(true);

}
