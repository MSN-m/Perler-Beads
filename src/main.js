/**
 * 拼豆图纸生成器 - 主入口与事件绑定
 */
import { AppState } from './state.js';
import {
    goToStep,
    updateGridDimensions,
    toggleBgRemovalMode,
    undoBgRemoval,
    handleCleanFragments,
    handleGeneratePattern,
    handleCanvasClick,
    updateTolerance,
    toggleColorLimit,
    updateMaxColorsDisplay,
    resetWorkbenchCropRect,
    resetWorkbenchComparePreview,
    toggleWorkbenchComparePreview,
    zoomWorkbenchComparePreview,
    startWorkbenchCropInteraction,
    moveWorkbenchCropInteraction,
    endWorkbenchCropInteraction,
    toggleFillMode,
    setFillSourceMode,
    handleOriginalFillPick,
    toggleClearBaseMode,
    handleResultCanvasClickForAdjust,
    startFillSelection,
    moveFillSelection,
    endFillSelection,
    adjustUndo,
    adjustCancel,
    adjustApply,
    saveWorkbenchDraft,
    restoreWorkbenchDraft,
    deleteWorkbenchDraft,
    renameWorkbenchDraft,
    toggleDraftDrawer,
    resetPatternToGenerated,
    collapseWorkbenchEditToolbar,
    expandWorkbenchEditToolbar,
    updateWorkbenchUI,
    toggleEdgeAdjustMode,
    toggleDeleteMode
} from './ui.js';
import { downloadImage, downloadRawImage, downloadMirroredImage } from './exporter.js';
import { initZoomEvents, resetZoom } from './features/zoom.js';

/**
 * 处理图片上传
 */
const resetProjectForNewImage = () => {
    AppState.pixelData = [];
    AppState.generatedPixelData = null;
    AppState.originalImageData = null;
    AppState.history = [];
    AppState.stagedPixelData = null;
    AppState.stagedActions = [];
    AppState.highlightedColorId = null;
    AppState.editMode = 'none';
    AppState.adjustPhase = 'waiting_receiver';
    AppState.receiverIndex = null;
    AppState.deleteMode = false;
    AppState.edgeSelectionMode = false;
    AppState.clearBaseMode = false;
    AppState.fillMode = false;
    AppState.fillColor = null;
    AppState.fillColorId = null;
    AppState.fillSourceIndex = null;
    AppState.workbenchToolbarCollapsed = false;
    AppState.cropRect = null;
    AppState.cropInteraction = null;
    AppState.comparePreviewVisible = false;
    AppState.selectedEdgeBeadsIndices = [];
};

const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            AppState.image = img;
            resetProjectForNewImage();
            goToStep(2);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

/**
 * 加载示例图片
 */
const loadExample = (type) => {
    const urls = {
        dog: './image/ScreenShot_2026-01-28_172218_549.png',
        flower: './image/ScreenShot_2026-01-28_172329_266.png',
        pixel: './image/ScreenShot_2026-01-28_172400_944.png'
    };

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        AppState.image = img;
        resetProjectForNewImage();
        goToStep(2);
    };
    img.src = urls[type];
};

// 页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
    // --- Step 1: 首页 / 上传 ---
    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
        fileUpload.addEventListener('click', () => {
            fileUpload.value = '';
        });
        fileUpload.addEventListener('change', handleImageUpload);
        document.querySelectorAll('label[for="file-upload"]').forEach(label => {
            label.addEventListener('click', () => {
                fileUpload.value = '';
            });
        });
    }

    // 示例图片按钮
    const exampleDog = document.getElementById('example-dog');
    if (exampleDog) {
        exampleDog.addEventListener('click', () => loadExample('dog'));
    }

    const exampleFlower = document.getElementById('example-flower');
    if (exampleFlower) {
        exampleFlower.addEventListener('click', () => loadExample('flower'));
    }

    const examplePixel = document.getElementById('example-pixel');
    if (examplePixel) {
        examplePixel.addEventListener('click', () => loadExample('pixel'));
    }

    // --- Step 2: 设置 ---
    const backToStep1 = document.getElementById('back-to-step-1');
    if (backToStep1) {
        backToStep1.addEventListener('click', () => goToStep(1));
    }

    const removeBgBtn = document.getElementById('remove-bg-btn');
    if (removeBgBtn) {
        removeBgBtn.addEventListener('click', toggleBgRemovalMode);
    }

    const undoBgBtn = document.getElementById('undo-bg-btn');
    if (undoBgBtn) {
        undoBgBtn.addEventListener('click', undoBgRemoval);
    }

    const cleanFragmentsBtn = document.getElementById('clean-fragments-btn');
    if (cleanFragmentsBtn) {
        cleanFragmentsBtn.addEventListener('click', handleCleanFragments);
    }

    const toleranceSlider = document.getElementById('tolerance-slider');
    if (toleranceSlider) {
        toleranceSlider.addEventListener('input', (e) => {
            updateTolerance(e.target.value);
        });
    }

    const gridSizeSlider = document.getElementById('grid-size-slider');
    if (gridSizeSlider) {
        gridSizeSlider.addEventListener('input', updateGridDimensions);
    }

    const brandSelect = document.getElementById('brand-select');
    if (brandSelect) {
        brandSelect.addEventListener('change', (e) => {
            AppState.brand = e.target.value;
            const mardSetContainer = document.getElementById('mard-set-container');
            if (AppState.brand === 'mard') {
                mardSetContainer.classList.remove('hidden');
            } else {
                mardSetContainer.classList.add('hidden');
            }
        });
    }

    const mardSetSelect = document.getElementById('mard-set-select');
    if (mardSetSelect) {
        mardSetSelect.addEventListener('change', (e) => {
            AppState.mardSet = e.target.value;
        });
    }

    const colorLimitToggle = document.getElementById('color-limit-toggle');
    if (colorLimitToggle) {
        colorLimitToggle.addEventListener('change', toggleColorLimit);
    }

    const maxColorsSlider = document.getElementById('max-colors-slider');
    if (maxColorsSlider) {
        maxColorsSlider.addEventListener('input', updateMaxColorsDisplay);
    }

    const generateBtn = document.getElementById('generate-pattern-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            handleGeneratePattern();
            updateWorkbenchUI();
        });
    }

    const sourceCanvas = document.getElementById('source-canvas');
    if (sourceCanvas) {
        sourceCanvas.onclick = handleCanvasClick;
        sourceCanvas.ontouchstart = (e) => {
            if (AppState.isBgRemoving) {
                e.preventDefault();
                handleCanvasClick(e);
            }
        };
    }

    const cropOverlay = document.getElementById('workbench-crop-overlay');
    if (cropOverlay) {
        cropOverlay.addEventListener('mousedown', startWorkbenchCropInteraction);
        cropOverlay.addEventListener('touchstart', startWorkbenchCropInteraction, { passive: false });
    }

    const compareSourceFrame = document.getElementById('compare-source-frame');
    if (compareSourceFrame) {
        compareSourceFrame.addEventListener('wheel', (e) => {
            if (AppState.currentStep !== 3) return;
            e.preventDefault();
            zoomWorkbenchComparePreview(e.deltaY);
        }, { passive: false });
        compareSourceFrame.addEventListener('click', (e) => {
            if (handleOriginalFillPick(e)) {
                e.preventDefault();
                updateWorkbenchUI();
            }
        });
        compareSourceFrame.addEventListener('touchstart', (e) => {
            if (handleOriginalFillPick(e)) {
                e.preventDefault();
                updateWorkbenchUI();
            }
        }, { passive: false });
    }

    const compareSourceResetBtn = document.getElementById('compare-source-reset-btn');
    if (compareSourceResetBtn) {
        compareSourceResetBtn.addEventListener('click', resetWorkbenchComparePreview);
    }

    const toggleComparePreviewBtn = document.getElementById('toggle-compare-preview-btn');
    if (toggleComparePreviewBtn) {
        toggleComparePreviewBtn.addEventListener('click', toggleWorkbenchComparePreview);
    }

    window.addEventListener('mousemove', moveWorkbenchCropInteraction);
    window.addEventListener('touchmove', moveWorkbenchCropInteraction, { passive: false });
    window.addEventListener('mouseup', endWorkbenchCropInteraction);
    window.addEventListener('touchend', endWorkbenchCropInteraction);
    window.addEventListener('touchcancel', endWorkbenchCropInteraction);

    // --- Step 3: 编辑 / 导出前 ---
    const backToStep2 = document.getElementById('back-to-step-2');
    if (backToStep2) {
        backToStep2.addEventListener('click', () => goToStep(2));
    }

    const nextToStep4 = document.getElementById('next-to-step-4');
    if (nextToStep4) {
        nextToStep4.addEventListener('click', () => goToStep(4));
    }

    const backToStep3 = document.getElementById('back-to-step-3');
    if (backToStep3) {
        backToStep3.addEventListener('click', () => goToStep(3));
    }

    const toggleFillBtn = document.getElementById('toggle-fill-btn');
    if (toggleFillBtn) {
        toggleFillBtn.addEventListener('click', () => {
            toggleFillMode();
            updateWorkbenchUI();
        });
    }

    const fillSourceCanvasBtn = document.getElementById('fill-source-canvas-btn');
    if (fillSourceCanvasBtn) {
        fillSourceCanvasBtn.addEventListener('click', () => {
            setFillSourceMode('canvas');
            updateWorkbenchUI();
        });
    }

    const fillSourceOriginalBtn = document.getElementById('fill-source-original-btn');
    if (fillSourceOriginalBtn) {
        fillSourceOriginalBtn.addEventListener('click', () => {
            setFillSourceMode('original');
            if (!AppState.comparePreviewVisible) {
                toggleWorkbenchComparePreview();
            } else {
                updateWorkbenchUI();
            }
        });
    }

    const toggleClearBaseBtn = document.getElementById('toggle-clear-base-btn');
    if (toggleClearBaseBtn) {
        toggleClearBaseBtn.addEventListener('click', () => {
            toggleClearBaseMode();
            updateWorkbenchUI();
        });
    }

    const toggleEdgeAdjustBtn = document.getElementById('toggle-edge-adjust-btn');
    if (toggleEdgeAdjustBtn) {
        toggleEdgeAdjustBtn.addEventListener('click', () => {
            toggleEdgeAdjustMode();
            updateWorkbenchUI();
        });
    }

    const toggleDeleteBtn = document.getElementById('toggle-delete-btn');
    if (toggleDeleteBtn) {
        toggleDeleteBtn.addEventListener('click', () => {
            toggleDeleteMode();
            updateWorkbenchUI();
        });
    }

    const adjustUndoBtn = document.getElementById('adjust-undo-btn');
    if (adjustUndoBtn) {
        adjustUndoBtn.addEventListener('click', adjustUndo);
    }

    const adjustCancelBtn = document.getElementById('adjust-cancel-btn');
    if (adjustCancelBtn) {
        adjustCancelBtn.addEventListener('click', () => {
            adjustCancel();
            updateWorkbenchUI();
        });
    }

    const adjustApplyBtn = document.getElementById('adjust-apply-btn');
    if (adjustApplyBtn) {
        adjustApplyBtn.addEventListener('click', () => {
            adjustApply();
            updateWorkbenchUI();
        });
    }

    const resetPatternBtn = document.getElementById('reset-pattern-btn');
    if (resetPatternBtn) {
        resetPatternBtn.addEventListener('click', resetPatternToGenerated);
    }

    const saveDraftBtn = document.getElementById('save-draft-btn');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', async () => {
            await saveWorkbenchDraft();
            AppState.draftDrawerOpen = true;
            updateWorkbenchUI();
        });
    }

    const toggleDraftDrawerBtn = document.getElementById('toggle-draft-drawer-btn');
    if (toggleDraftDrawerBtn) {
        toggleDraftDrawerBtn.addEventListener('click', toggleDraftDrawer);
    }

    const draftBoxList = document.getElementById('draft-box-list');
    if (draftBoxList) {
        draftBoxList.addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-draft-action]');
            if (!button) return;
            const action = button.getAttribute('data-draft-action');
            const draftId = button.getAttribute('data-draft-id');
            if (!draftId) return;
            if (action === 'restore') {
                restoreWorkbenchDraft(draftId);
                return;
            }
            if (action === 'delete') {
                await deleteWorkbenchDraft(draftId);
                updateWorkbenchUI();
            }
        });
        draftBoxList.addEventListener('focusin', (event) => {
            const input = event.target.closest('input[data-draft-action="rename"]');
            if (!input) return;
            input.dataset.originalName = input.value;
        });
        draftBoxList.addEventListener('keydown', async (event) => {
            const input = event.target.closest('input[data-draft-action="rename"]');
            if (!input) return;
            if (event.key === 'Enter') {
                event.preventDefault();
                await renameWorkbenchDraft(input.getAttribute('data-draft-id'), input.value);
                updateWorkbenchUI();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                input.value = input.dataset.originalName || input.value;
                input.blur();
            }
        });
        draftBoxList.addEventListener('focusout', async (event) => {
            const input = event.target.closest('input[data-draft-action="rename"]');
            if (!input) return;
            await renameWorkbenchDraft(input.getAttribute('data-draft-id'), input.value);
            updateWorkbenchUI();
        });
    }

    const collapseEditToolbarBtn = document.getElementById('collapse-edit-toolbar-btn');
    if (collapseEditToolbarBtn) {
        collapseEditToolbarBtn.addEventListener('click', collapseWorkbenchEditToolbar);
    }

    const expandEditToolbarBtn = document.getElementById('expand-edit-toolbar-btn');
    if (expandEditToolbarBtn) {
        expandEditToolbarBtn.addEventListener('click', expandWorkbenchEditToolbar);
    }

    const downloadImgBtn = document.getElementById('download-image-btn');
    if (downloadImgBtn) {
        downloadImgBtn.addEventListener('click', downloadImage);
    }

    const downloadMirroredImgBtn = document.getElementById('download-mirrored-image-btn');
    if (downloadMirroredImgBtn) {
        downloadMirroredImgBtn.addEventListener('click', downloadMirroredImage);
    }

    const downloadRawImgBtn = document.getElementById('download-raw-image-btn');
    if (downloadRawImgBtn) {
        downloadRawImgBtn.addEventListener('click', downloadRawImage);
    }

    // --- 缩放与平移（features/zoom.js） ---
    const resultContainer = document.getElementById('result-container');
    const resultCanvas = document.getElementById('result-canvas');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', resetZoom);
    }

    initZoomEvents(resultContainer, resultCanvas, zoomResetBtn, (e) => {
        if (AppState.editMode === 'adjust' || AppState.editMode === 'delete') {
            handleResultCanvasClickForAdjust(e);
        }
    });

    if (resultCanvas) {
        resultCanvas.addEventListener('mousedown', (e) => {
            if (startFillSelection(e)) {
                e.preventDefault();
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (moveFillSelection(e)) {
                e.preventDefault();
            }
        });
        window.addEventListener('mouseup', () => {
            endFillSelection();
        });
        resultCanvas.addEventListener('touchstart', (e) => {
            if (startFillSelection(e)) {
                e.preventDefault();
            }
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            if (moveFillSelection(e)) {
                e.preventDefault();
            }
        }, { passive: false });
        window.addEventListener('touchend', () => {
            endFillSelection();
        });
    }

    updateWorkbenchUI();
});
