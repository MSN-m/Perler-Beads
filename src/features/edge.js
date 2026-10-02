/**

 * 边缘调整功能模块

 */

import { AppState } from '../state.js';
import { setActiveEditorTool, restorePaintColor } from '../editor.js';

import { renderResult } from '../renderer.js';
import { getEdgeBeadIndices } from '../utils.js';

import { enterEditSession } from './adjust.js';



export function findAndSelectEdgeBeads() {
    const pixels = AppState.stagedPixelData || AppState.pixelData || [];
    AppState.selectedEdgeBeadsIndices = getEdgeBeadIndices(pixels, AppState.gridWidth, AppState.gridHeight);
    const resultCanvas = document.getElementById('result-canvas');
    if (resultCanvas) renderResult(resultCanvas, pixels, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
}

export function toggleEdgeAdjustMode() {

    const resultCanvas = document.getElementById('result-canvas');

    const btn = document.getElementById('toggle-edge-adjust-btn');

    const deleteBtn = document.getElementById('toggle-delete-btn');

    const entering = !AppState.edgeSelectionMode;



    if (entering) {

        if (AppState.editMode !== 'adjust') {

            enterEditSession();

        }

        AppState.edgeSelectionMode = true;
        setActiveEditorTool('edge');

        AppState.deleteMode = false;

        AppState.clearBaseMode = false;

        AppState.fillMode = false;

        restorePaintColor();

        AppState.fillSourceIndex = null;

        btn && btn.classList.add('bg-primary', 'text-white');

        deleteBtn && deleteBtn.classList.remove('bg-primary', 'text-white');

        findAndSelectEdgeBeads();

    } else {

        AppState.edgeSelectionMode = false;

        AppState.selectedEdgeBeadsIndices = [];

        btn && btn.classList.remove('bg-primary', 'text-white');

        if (AppState.editMode === 'adjust') {

            deleteBtn && deleteBtn.classList.remove('bg-primary', 'text-white');

            renderResult(resultCanvas, AppState.stagedPixelData || AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);

        } else {

            renderResult(resultCanvas, AppState.pixelData, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);

        }

    }

}
