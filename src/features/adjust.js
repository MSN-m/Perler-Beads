/**

 * 颜色调整功能模块

 */

import { AppState } from '../state.js';

import { renderResult, updateResultTransform } from '../renderer.js';

import { handleDeleteClick } from './delete.js';

import { deepClonePixels, calculateStats, getCurrentPalette, performBatchReplace, updateAdjustUndoButton } from '../ui.js';



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



function exitAdjustLikeMode(applyChanges) {

    const canvas = document.getElementById('result-canvas');

    const btn = document.getElementById('toggle-adjust-btn');

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

    AppState.selectedEdgeBeadsIndices = [];



    renderResult(canvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);

    calculateStats();



    btn && btn.classList.remove('bg-primary', 'text-white');

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



export function toggleAdjustMode() {

    const resultCanvas = document.getElementById('result-canvas');

    const undoBtn = document.getElementById('adjust-undo-btn');

    const cancelBtn = document.getElementById('adjust-cancel-btn');

    const applyBtn = document.getElementById('adjust-apply-btn');

    const btn = document.getElementById('toggle-adjust-btn');

    const edgeBtn = document.getElementById('toggle-edge-adjust-btn');

    const deleteBtn = document.getElementById('toggle-delete-btn');

    const entering = AppState.editMode !== 'adjust';



    if (entering) {

        AppState.editMode = 'adjust';

        AppState.adjustPhase = 'waiting_receiver';

        AppState.receiverIndex = null;

        AppState.stagedPixelData = deepClonePixels(AppState.pixelData);

        AppState.stagedActions = [];

        AppState.selectedEdgeBeadsIndices = [];

        AppState.edgeSelectionMode = false;

        AppState.deleteMode = false;

        AppState.preAdjustZoomState = { ...AppState.zoomState };



        btn && btn.classList.add('bg-primary', 'text-white');

        edgeBtn && edgeBtn.classList.remove('bg-primary', 'text-white');

        deleteBtn && deleteBtn.classList.remove('bg-primary', 'text-white');

        undoBtn && undoBtn.classList.remove('hidden');

        cancelBtn && cancelBtn.classList.remove('hidden');

        applyBtn && applyBtn.classList.remove('hidden');

        resultCanvas.classList.remove('cursor-grab', 'cursor-grabbing');

        resultCanvas.classList.add('cursor-crosshair');

        renderResult(resultCanvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);

        updateAdjustUndoButton();

    } else {

        exitAdjustLikeMode(false);

    }

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

        AppState.batchReplace.active = false;

        AppState.batchReplace.mode = null;

        AppState.batchReplace.sourceColorId = null;

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

