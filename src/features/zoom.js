/**

 * 缩放与平移功能模块

 * 负责结果画布的滚轮缩放、鼠标/触摸平移，以及重置缩放

 */

import { AppState } from '../state.js';

import { updateResultTransform, getResetZoomState } from '../renderer.js';



function getMinZoomScale() {

    const fitScale = AppState.zoomState && AppState.zoomState.fitScale ? AppState.zoomState.fitScale : 1;

    return Math.max(fitScale * 0.3, 0.02);

}

function isEditingMode() {
    return AppState.editMode === 'adjust' || AppState.editMode === 'delete';
}

function canPanFromCurrentEditMode() {
    return AppState.fillMode || AppState.clearBaseMode || AppState.deleteMode;
}

function getEventPoint(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function getGridHitFromPoint(point, resultCanvas) {
    if (!resultCanvas || !AppState.zoomState) return null;

    const rect = resultCanvas.getBoundingClientRect();
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

    return { idx: gy * AppState.gridWidth + gx };
}

function shouldStartPan(e, resultCanvas) {
    if (!isEditingMode()) return true;
    if (e.touches && e.touches.length >= 2) return true;
    if (!canPanFromCurrentEditMode()) return false;
    if (e.target !== resultCanvas) return true;

    const hit = getGridHitFromPoint(getEventPoint(e), resultCanvas);
    if (!hit) return true;

    const pixels = AppState.stagedPixelData || AppState.pixelData || [];
    const pixel = pixels[hit.idx];
    return !pixel || pixel.id === 'NONE';
}



/**

 * 重置缩放以适配容器

 */

export function resetZoom() {

    const resultCanvas = document.getElementById('result-canvas');

    const resultContainer = document.getElementById('result-container');

    const zoomResetBtn = document.getElementById('zoom-reset-btn');



    const newState = getResetZoomState(resultContainer, resultCanvas);

    AppState.zoomState = newState;



    resultCanvas.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

    updateResultTransform(resultCanvas, AppState.zoomState, zoomResetBtn);



    setTimeout(() => {

        resultCanvas.style.transition = 'none';

    }, 400);

}



/**

 * 绑定所有缩放与平移事件

 * @param {HTMLElement} resultContainer

 * @param {HTMLCanvasElement} resultCanvas

 * @param {HTMLElement} zoomResetBtn

 * @param {Function} handleCanvasClick - 画布点击回调（编辑模式用）

 */

export function initZoomEvents(resultContainer, resultCanvas, zoomResetBtn, handleCanvasClick) {

    if (!resultContainer || !resultCanvas) return;

    let panStartedInEditMode = false;
    let panDidMove = false;
    let suppressNextCanvasClick = false;



    // 滚轮缩放

    resultContainer.addEventListener('wheel', (e) => {

        e.preventDefault();

        const delta = -e.deltaY;

        const factor = delta > 0 ? 1.1 : 0.9;

        const newScale = Math.min(Math.max(AppState.zoomState.scale * factor, getMinZoomScale()), 10);



        if (newScale !== AppState.zoomState.scale) {

            const rect = resultCanvas.getBoundingClientRect();

            const mouseX = e.clientX - rect.left;

            const mouseY = e.clientY - rect.top;

            const canvasX = mouseX / AppState.zoomState.scale;

            const canvasY = mouseY / AppState.zoomState.scale;



            AppState.zoomState.scale = newScale;

            AppState.zoomState.x = e.clientX - rect.left - canvasX * newScale + AppState.zoomState.x;

            AppState.zoomState.y = e.clientY - rect.top - canvasY * newScale + AppState.zoomState.y;

            updateResultTransform(resultCanvas, AppState.zoomState, zoomResetBtn);

        }

    }, { passive: false });



    // 画布点击（编辑模式）

    resultCanvas.addEventListener('click', (e) => {
        if (suppressNextCanvasClick) {
            suppressNextCanvasClick = false;
            return;
        }
        handleCanvasClick(e);
    });



    // 鼠标平移

    resultContainer.addEventListener('mousedown', (e) => {

        if (!shouldStartPan(e, resultCanvas)) return;

        AppState.zoomState.isDragging = true;
        panStartedInEditMode = isEditingMode();
        panDidMove = false;

        AppState.zoomState.lastX = e.clientX;

        AppState.zoomState.lastY = e.clientY;

        resultCanvas.style.transition = 'none';

        resultCanvas.classList.remove('cursor-grab');

        resultCanvas.classList.add('cursor-grabbing');

    });



    window.addEventListener('mousemove', (e) => {

        if (!AppState.zoomState || !AppState.zoomState.isDragging) return;

        const dx = e.clientX - AppState.zoomState.lastX;

        const dy = e.clientY - AppState.zoomState.lastY;

        if (panStartedInEditMode && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) panDidMove = true;

        AppState.zoomState.x += dx;

        AppState.zoomState.y += dy;

        AppState.zoomState.lastX = e.clientX;

        AppState.zoomState.lastY = e.clientY;

        updateResultTransform(resultCanvas, AppState.zoomState, zoomResetBtn);

    });



    window.addEventListener('mouseup', () => {

        if (panStartedInEditMode && panDidMove) suppressNextCanvasClick = true;

        AppState.zoomState.isDragging = false;
        panStartedInEditMode = false;
        panDidMove = false;

        resultCanvas.classList.remove('cursor-grabbing');

        resultCanvas.classList.add('cursor-grab');

    });



    // 窗口大小变化时重置缩放

    window.addEventListener('resize', () => {

        if (AppState.currentStep === 3) resetZoom();

    });



    // 触摸支持（缩放和平移）

    resultContainer.addEventListener('touchstart', (e) => {

        if (!shouldStartPan(e, resultCanvas)) return;

        e.preventDefault();

        if (e.touches.length === 1) {

            AppState.zoomState.isDragging = true;
            panStartedInEditMode = isEditingMode();
            panDidMove = false;

            AppState.zoomState.lastX = e.touches[0].clientX;

            AppState.zoomState.lastY = e.touches[0].clientY;

        } else if (e.touches.length === 2) {

            AppState.zoomState.lastDist = Math.hypot(

                e.touches[0].clientX - e.touches[1].clientX,

                e.touches[0].clientY - e.touches[1].clientY

            );

        }

        resultCanvas.style.transition = 'none';

    }, { passive: false });



    resultContainer.addEventListener('touchmove', (e) => {

        if (!AppState.zoomState) return;

        e.preventDefault();

        if (e.touches.length === 1 && AppState.zoomState.isDragging) {

            const dx = e.touches[0].clientX - AppState.zoomState.lastX;

            const dy = e.touches[0].clientY - AppState.zoomState.lastY;

            if (panStartedInEditMode && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) panDidMove = true;

            AppState.zoomState.x += dx;

            AppState.zoomState.y += dy;

            AppState.zoomState.lastX = e.touches[0].clientX;

            AppState.zoomState.lastY = e.touches[0].clientY;

            updateResultTransform(resultCanvas, AppState.zoomState, zoomResetBtn);

        } else if (e.touches.length === 2) {

            const dist = Math.hypot(

                e.touches[0].clientX - e.touches[1].clientX,

                e.touches[0].clientY - e.touches[1].clientY

            );

            if (AppState.zoomState.lastDist > 0) {

                const factor = dist / AppState.zoomState.lastDist;

                const newScale = Math.min(Math.max(AppState.zoomState.scale * factor, getMinZoomScale()), 10);

                if (newScale !== AppState.zoomState.scale) {

                    const actualFactor = newScale / AppState.zoomState.scale;

                    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;

                    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                    const rect = resultCanvas.getBoundingClientRect();

                    AppState.zoomState.x -= (centerX - rect.left) * (actualFactor - 1);

                    AppState.zoomState.y -= (centerY - rect.top) * (actualFactor - 1);

                    AppState.zoomState.scale = newScale;

                    updateResultTransform(resultCanvas, AppState.zoomState, zoomResetBtn);

                }

            }

            AppState.zoomState.lastDist = dist;

        }

    }, { passive: false });



    resultContainer.addEventListener('touchend', () => {

        if (panStartedInEditMode && panDidMove) suppressNextCanvasClick = true;

        if (AppState.zoomState) AppState.zoomState.isDragging = false;
        panStartedInEditMode = false;
        panDidMove = false;

    });

    resultContainer.addEventListener('touchcancel', () => {
        if (AppState.zoomState) {
            AppState.zoomState.isDragging = false;
            AppState.zoomState.lastDist = 0;
        }
        panStartedInEditMode = false;
        panDidMove = false;
    });

}
