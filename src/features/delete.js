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

export function toggleColorEraseMode() {
    if (!AppState.deleteMode) toggleDeleteMode();
    AppState.colorEraseMode = true;
    AppState.deleteMode = true;
    AppState.editMode = 'delete';
    setActiveEditorTool('color-eraser');
}

export function handleColorDeleteClick(idx, canvas) {
    const source = AppState.stagedPixelData?.[idx];
    if (!source || source.id === 'NONE') return;
    const indices = [];
    const prevColors = [];
    AppState.stagedPixelData.forEach((pixel, index) => {
        if (!pixel || pixel.id !== source.id) return;
        indices.push(index);
        prevColors.push({ ...pixel });
        AppState.stagedPixelData[index] = { id: 'NONE', r: 0, g: 0, b: 0, a: 0 };
    });
    recordPixelAction({ indices, prevColors, nextColor: { id: 'NONE', r: 0, g: 0, b: 0, a: 0 } });
    renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
    calculateStats();
    updateAdjustUndoButton();
    refreshQualityOverlay();
}

export function handleDeleteClick(idx, canvas) {

    const targetPixel = AppState.stagedPixelData[idx];

    if (!targetPixel || targetPixel.id === 'NONE') return;



    AppState.stagedPixelData[idx] = { id: 'NONE', r: 0, g: 0, b: 0, a: 0 };

        recordPixelAction({

            index: idx,

            prevColor: { ...targetPixel },

            nextColor: { id: 'NONE', r: 0, g: 0, b: 0, a: 0 }

        });

        renderResult(canvas, AppState.stagedPixelData, AppState.gridWidth, AppState.gridHeight, null);
        refreshQualityOverlay();

        calculateStats();

        updateAdjustUndoButton();

}
