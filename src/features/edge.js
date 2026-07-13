/**

 * 边缘调整功能模块

 */

import { AppState } from '../state.js';
import { setActiveEditorTool } from '../editor.js';

import { renderResult } from '../renderer.js';

import { enterEditSession } from './adjust.js';



export function findAndSelectEdgeBeads() {

    AppState.selectedEdgeBeadsIndices = [];

    if (!AppState.pixelData || AppState.pixelData.length === 0) {

        console.warn('pixelData is empty, cannot find edges.');

        return;

    }



    const gridWidth = AppState.gridWidth;

    const gridHeight = AppState.gridHeight;

    const pixelData = AppState.pixelData;



    for (let y = 0; y < gridHeight; y++) {

        for (let x = 0; x < gridWidth; x++) {

            const currentIndex = y * gridWidth + x;

            const currentPixel = pixelData[currentIndex];



            if (currentPixel && currentPixel.id !== 'NONE') {

                let isEdge = false;

                const neighbors = [

                    { nx: x, ny: y - 1 },

                    { nx: x, ny: y + 1 },

                    { nx: x - 1, ny: y },

                    { nx: x + 1, ny: y }

                ];



                for (const neighbor of neighbors) {

                    const { nx, ny } = neighbor;



                    if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) {

                        isEdge = true;

                        break;

                    }



                    const neighborIndex = ny * gridWidth + nx;

                    const neighborPixel = pixelData[neighborIndex];

                    if (!neighborPixel || neighborPixel.id === 'NONE') {

                        isEdge = true;

                        break;

                    }

                }



                if (isEdge) {

                    AppState.selectedEdgeBeadsIndices.push(currentIndex);

                }

            }

        }

    }



    console.log(`Found ${AppState.selectedEdgeBeadsIndices.length} edge beads.`);

    const resultCanvas = document.getElementById('result-canvas');

    renderResult(

        resultCanvas,

        AppState.stagedPixelData || AppState.pixelData,

        AppState.gridWidth,

        AppState.gridHeight,

        AppState.highlightedColorId

    );

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

        AppState.fillColor = null;

        AppState.fillColorId = null;

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
