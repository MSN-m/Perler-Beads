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
    handleGeneratePixelArt,
    handleGeneratePattern,
    handleGeneratePatternLegacy,
    applyWorkbenchSettings,
    handlePatternPreviewStyle,
    cancelPatternPreview,
    confirmPatternPreview,
    handleCanvasClick,
    startBgRemovalSelection,
    moveBgRemovalSelection,
    endBgRemovalSelection,
    updateTolerance,
    toggleColorLimit,
    updateMaxColorsDisplay,
    resetWorkbenchComparePreview,
    toggleWorkbenchComparePreview,
    zoomWorkbenchComparePreview,
    startWorkbenchCompareDrag,
    moveWorkbenchCompareDrag,
    endWorkbenchCompareDrag,
    startWorkbenchCropInteraction,
    moveWorkbenchCropInteraction,
    endWorkbenchCropInteraction,
    toggleFillMode,
    handleOriginalFillPick,
    activateEyedropper,
    toggleClearBaseMode,
    handleResultCanvasClickForAdjust,
    startFillSelection,
    moveFillSelection,
    endFillSelection,
    adjustUndo,
    adjustRedo,
    adjustCancel,
    saveWorkbenchDraft,
    exportWorkbenchDrafts,
    exportWorkbenchDraft,
    importWorkbenchDraftFile,
    restoreWorkbenchDraft,
    deleteWorkbenchDraft,
    renameWorkbenchDraft,
    toggleDraftDrawer,
    resetPatternToGenerated,
    collapseWorkbenchEditToolbar,
    expandWorkbenchEditToolbar,
    toggleWorkbenchSettingsPanel,
    selectWorkbenchTabletPanel,
    recropMobileWorkbenchImage,
    removeWorkbenchImage,
    togglePalettePanel,
    closePalettePanel,
    updatePalettePanelQuery,
    toggleAllColorsPanel,
    closeAllColorsPanel,
    updateAllColorsPanelQuery,
    handlePaletteColorSelect,
    handlePaletteAction,
    handleRecentColorSelect,
    startPalettePanelDrag,
    movePalettePanelDrag,
    endPalettePanelDrag,
    openQualityCheckModal,
    refreshQualityOverlay,
    updatePixelArtControlDisplays,
    updateWorkbenchUI,
    openMobileSettingsModal,
    closeMobileSettingsModal,
    applyMobilePatternName,
    selectMobileBrand,
    selectMobileMardSet,
    toggleEdgeAdjustMode,
    toggleDeleteMode,
    toggleColorEraseMode
} from './ui.js';
import { downloadImage, downloadRawImage, downloadMirroredImage } from './exporter.js';
import { initZoomEvents, resetZoom } from './features/zoom.js';
import { setActiveEditorTool } from './editor.js';

/**
 * 处理图片上传
 */
const resetProjectForNewImage = () => {
    AppState.patternName = '';
    AppState.pendingGridWidth = null;
    AppState.pendingGridHeight = null;
    AppState.pixelData = [];
    AppState.pixelArtData = null;
    AppState.pixelArtSettings = { contrast: 0, sharpen: 0, dominant: 50 };
    AppState.patternPreviewVisible = false;
    AppState.patternPreviewStyle = 'photo';
    AppState.patternPreviewPixelData = null;
    AppState.patternPreviewPixelArtData = null;
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
    AppState.palettePanelOpen = false;
    AppState.palettePanelQuery = '';
    AppState.palettePanelPosition = null;
    AppState.palettePanelDrag = null;
    AppState.allColorsPanelOpen = false;
    AppState.allColorsPanelQuery = '';
    AppState.qualityIssues = [];
    AppState.qualityOverlayVisible = false;
    AppState.workbenchSettingsCollapsed = false;
    AppState.workbenchTabletPanel = null;
    AppState.workbenchToolbarCollapsed = false;
    AppState.mobileSetupStep = 'crop';
    AppState.cropRect = null;
    AppState.cropInteraction = null;
    AppState.comparePreviewScale = 1;
    AppState.comparePreviewOffsetX = 0;
    AppState.comparePreviewOffsetY = 0;
    AppState.comparePreviewDragging = false;
    AppState.comparePreviewDidDrag = false;
    AppState.comparePreviewLastX = 0;
    AppState.comparePreviewLastY = 0;
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
    document.querySelectorAll('#workbench-edit-toolbar [title], #save-draft-btn[title]').forEach((element) => {
        element.dataset.tooltip = element.getAttribute('title');
        element.classList.add('has-hover-tooltip');
        element.removeAttribute('title');
    });
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

    const patternNameInput = document.getElementById('pattern-name-input');
    if (patternNameInput) {
        patternNameInput.closest('div')?.addEventListener('pointerdown', (event) => {
            if (!openMobileSettingsModal('name')) return;
            event.preventDefault();
        });
        patternNameInput.addEventListener('input', (event) => {
            AppState.patternName = event.target.value;
            updateWorkbenchUI();
        });
    }

    const brandSelect = document.getElementById('brand-select');
    if (brandSelect) {
        brandSelect.closest('div.grid')?.addEventListener('pointerdown', (event) => {
            if (!openMobileSettingsModal('scheme')) return;
            event.preventDefault();
        }, true);
        brandSelect.addEventListener('change', (e) => {
            AppState.brand = e.target.value;
            const mardSetContainer = document.getElementById('mard-set-container');
            if (AppState.brand === 'mard') {
                mardSetContainer.classList.remove('hidden');
            } else {
                mardSetContainer.classList.add('hidden');
            }
            updateWorkbenchUI();
        });
    }

    const mardSetSelect = document.getElementById('mard-set-select');
    if (mardSetSelect) {
        mardSetSelect.addEventListener('change', (e) => {
            AppState.mardSet = e.target.value;
            updateWorkbenchUI();
        });
    }

    const mobileSettingsBackdrop = document.getElementById('mobile-settings-backdrop');
    if (mobileSettingsBackdrop) {
        mobileSettingsBackdrop.addEventListener('click', closeMobileSettingsModal);
    }

    const mobileNameCancelBtn = document.getElementById('mobile-name-cancel-btn');
    if (mobileNameCancelBtn) {
        mobileNameCancelBtn.addEventListener('click', closeMobileSettingsModal);
    }

    const mobileNameApplyBtn = document.getElementById('mobile-name-apply-btn');
    if (mobileNameApplyBtn) {
        mobileNameApplyBtn.addEventListener('click', applyMobilePatternName);
    }

    const mobilePatternNameInput = document.getElementById('mobile-pattern-name-input');
    if (mobilePatternNameInput) {
        mobilePatternNameInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            applyMobilePatternName();
        });
    }

    const mobileSchemeCloseBtn = document.getElementById('mobile-scheme-close-btn');
    if (mobileSchemeCloseBtn) {
        mobileSchemeCloseBtn.addEventListener('click', closeMobileSettingsModal);
    }

    const mobileSettingsModal = document.getElementById('mobile-settings-modal');
    if (mobileSettingsModal) {
        mobileSettingsModal.addEventListener('click', (event) => {
            const brandBtn = event.target.closest('button[data-mobile-brand]');
            if (brandBtn) {
                selectMobileBrand(brandBtn.getAttribute('data-mobile-brand'));
                return;
            }
            const setBtn = event.target.closest('button[data-mobile-mard-set]');
            if (setBtn) {
                selectMobileMardSet(setBtn.getAttribute('data-mobile-mard-set'));
            }
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

    ['pixel-contrast-slider', 'pixel-sharpen-slider', 'pixel-dominant-slider'].forEach((id) => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('input', updatePixelArtControlDisplays);
        }
    });
    updatePixelArtControlDisplays();

    const generatePixelArtBtn = document.getElementById('generate-pixel-art-btn');
    if (generatePixelArtBtn) {
        generatePixelArtBtn.addEventListener('click', () => {
            handleGeneratePixelArt();
            updateWorkbenchUI();
        });
    }

    const generateBtn = document.getElementById('generate-pattern-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            handleGeneratePattern();
            updateWorkbenchUI();
        });
    }

    const mobileConfirmRangeBtn = document.getElementById('mobile-confirm-range-btn');
    if (mobileConfirmRangeBtn) {
        mobileConfirmRangeBtn.addEventListener('click', () => {
            handleGeneratePattern();
            updateWorkbenchUI();
        });
    }

    const legacyGenerateBtn = document.getElementById('legacy-generate-pattern-btn');
    if (legacyGenerateBtn) {
        legacyGenerateBtn.addEventListener('click', () => {
            handleGeneratePatternLegacy();
            updateWorkbenchUI();
        });
    }

    const applyWorkbenchSettingsBtn = document.getElementById('apply-workbench-settings-btn');
    if (applyWorkbenchSettingsBtn) {
        applyWorkbenchSettingsBtn.addEventListener('click', applyWorkbenchSettings);
    }

    document.querySelectorAll('.pattern-preview-style-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            handlePatternPreviewStyle(btn.dataset.previewStyle);
        });
    });

    const patternPreviewCancelBtn = document.getElementById('pattern-preview-cancel-btn');
    if (patternPreviewCancelBtn) {
        patternPreviewCancelBtn.addEventListener('click', cancelPatternPreview);
    }

    const patternPreviewConfirmBtn = document.getElementById('pattern-preview-confirm-btn');
    if (patternPreviewConfirmBtn) {
        patternPreviewConfirmBtn.addEventListener('click', confirmPatternPreview);
    }

    const mobileRecropBtn = document.getElementById('mobile-recrop-btn');
    if (mobileRecropBtn) {
        mobileRecropBtn.addEventListener('click', recropMobileWorkbenchImage);
    }

    const mobileSettingsRecropBtn = document.getElementById('mobile-settings-recrop-btn');
    if (mobileSettingsRecropBtn) {
        mobileSettingsRecropBtn.addEventListener('click', recropMobileWorkbenchImage);
    }

    const mobileRemoveImageBtn = document.getElementById('mobile-remove-image-btn');
    if (mobileRemoveImageBtn) {
        mobileRemoveImageBtn.addEventListener('click', removeWorkbenchImage);
    }

    const mobileSettingsRemoveImageBtn = document.getElementById('mobile-settings-remove-image-btn');
    if (mobileSettingsRemoveImageBtn) {
        mobileSettingsRemoveImageBtn.addEventListener('click', removeWorkbenchImage);
    }

    const toggleWorkbenchSettingsBtn = document.getElementById('toggle-workbench-settings-btn');
    if (toggleWorkbenchSettingsBtn) {
        toggleWorkbenchSettingsBtn.addEventListener('click', toggleWorkbenchSettingsPanel);
    }

    const showWorkbenchSettingsPanelBtn = document.getElementById('show-workbench-settings-panel-btn');
    if (showWorkbenchSettingsPanelBtn) {
        showWorkbenchSettingsPanelBtn.addEventListener('click', () => selectWorkbenchTabletPanel('settings'));
    }

    const workbenchBackBtn = document.getElementById('workbench-back-btn');
    if (workbenchBackBtn) {
        workbenchBackBtn.addEventListener('click', () => {
            goToStep(2);
        });
    }

    const showWorkbenchColorsPanelBtn = document.getElementById('show-workbench-colors-panel-btn');
    if (showWorkbenchColorsPanelBtn) {
        showWorkbenchColorsPanelBtn.addEventListener('click', () => selectWorkbenchTabletPanel('colors'));
    }

    const togglePalettePanelBtn = document.getElementById('toggle-palette-panel-btn');
    if (togglePalettePanelBtn) {
        togglePalettePanelBtn.addEventListener('click', togglePalettePanel);
    }

    const toggleAllColorsPanelBtn = document.getElementById('toggle-all-colors-panel-btn');
    if (toggleAllColorsPanelBtn) {
        toggleAllColorsPanelBtn.addEventListener('click', toggleAllColorsPanel);
    }

    const qualityCheckBtn = document.getElementById('quality-check-btn');
    if (qualityCheckBtn) {
        qualityCheckBtn.addEventListener('click', () => {
            openQualityCheckModal();
            updateWorkbenchUI();
        });
    }

    const closePalettePanelBtn = document.getElementById('close-palette-panel-btn');
    if (closePalettePanelBtn) {
        closePalettePanelBtn.addEventListener('click', closePalettePanel);
    }

    const closeAllColorsPanelBtn = document.getElementById('close-all-colors-panel-btn');
    if (closeAllColorsPanelBtn) {
        closeAllColorsPanelBtn.addEventListener('click', closeAllColorsPanel);
    }

    const palettePanelDragHandle = document.getElementById('palette-panel-drag-handle');
    if (palettePanelDragHandle) {
        palettePanelDragHandle.addEventListener('pointerdown', (event) => {
            if (startPalettePanelDrag(event)) {
                event.preventDefault();
                palettePanelDragHandle.setPointerCapture?.(event.pointerId);
            }
        });
        window.addEventListener('pointermove', (event) => {
            if (movePalettePanelDrag(event)) {
                event.preventDefault();
            }
        });
        window.addEventListener('pointerup', endPalettePanelDrag);
        window.addEventListener('pointercancel', endPalettePanelDrag);
    }

    const paletteSearchInput = document.getElementById('palette-search-input');
    if (paletteSearchInput) {
        paletteSearchInput.addEventListener('input', (e) => updatePalettePanelQuery(e.target.value));
    }

    const allColorsSearchInput = document.getElementById('all-colors-search-input');
    if (allColorsSearchInput) {
        allColorsSearchInput.addEventListener('input', (e) => updateAllColorsPanelQuery(e.target.value));
    }

    const paletteColorGrid = document.getElementById('palette-color-grid');
    if (paletteColorGrid) {
        let suppressPaletteClickUntil = 0;
        const handlePaletteButton = (button) => {
            if (!button) return false;
            return handlePaletteColorSelect(button.getAttribute('data-palette-color-id'));
        };
        paletteColorGrid.addEventListener('pointerdown', (e) => {
            const button = e.target.closest('button[data-palette-color-id]');
            if (!button) return;
            const action = e.target.closest('[data-palette-action]');
            e.preventDefault();
            e.stopPropagation();
            suppressPaletteClickUntil = Date.now() + 600;
            if (action) handlePaletteAction(button.getAttribute('data-palette-color-id'), action.dataset.paletteAction);
            else handlePaletteButton(button);
        });
        paletteColorGrid.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-palette-color-id]');
            if (!button) return;
            const action = e.target.closest('[data-palette-action]');
            if (Date.now() < suppressPaletteClickUntil) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (action) handlePaletteAction(button.getAttribute('data-palette-color-id'), action.dataset.paletteAction);
            else handlePaletteButton(button);
        });
    }

    const sourceCanvas = document.getElementById('source-canvas');
    if (sourceCanvas) {
        sourceCanvas.onclick = handleCanvasClick;
        sourceCanvas.addEventListener('mousedown', (e) => {
            if (startBgRemovalSelection(e)) {
                e.preventDefault();
            }
        });
        sourceCanvas.addEventListener('mousemove', (e) => {
            if (moveBgRemovalSelection(e)) {
                e.preventDefault();
            }
        });
        sourceCanvas.addEventListener('mouseup', (e) => {
            if (endBgRemovalSelection(e)) {
                e.preventDefault();
            }
        });
        sourceCanvas.addEventListener('mouseleave', (e) => {
            if (endBgRemovalSelection(e)) {
                e.preventDefault();
            }
        });
        sourceCanvas.addEventListener('touchstart', (e) => {
            if (startBgRemovalSelection(e)) {
                e.preventDefault();
            }
        }, { passive: false });
        sourceCanvas.addEventListener('touchmove', (e) => {
            if (moveBgRemovalSelection(e)) {
                e.preventDefault();
            }
        }, { passive: false });
        sourceCanvas.addEventListener('touchend', (e) => {
            if (endBgRemovalSelection(e)) {
                e.preventDefault();
            }
        }, { passive: false });
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
        compareSourceFrame.addEventListener('mousedown', (e) => {
            if (startWorkbenchCompareDrag(e)) {
                e.preventDefault();
            }
        });
        compareSourceFrame.addEventListener('click', (e) => {
            if (handleOriginalFillPick(e)) {
                e.preventDefault();
                updateWorkbenchUI();
            }
        });
        compareSourceFrame.addEventListener('touchstart', (e) => {
            if (startWorkbenchCompareDrag(e)) {
                e.preventDefault();
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
    window.addEventListener('mousemove', (e) => {
        if (moveWorkbenchCompareDrag(e)) {
            e.preventDefault();
        }
    });
    window.addEventListener('touchmove', (e) => {
        if (moveWorkbenchCompareDrag(e)) {
            e.preventDefault();
        }
    }, { passive: false });
    window.addEventListener('mouseup', endWorkbenchCompareDrag);
    window.addEventListener('touchend', (e) => {
        if (endWorkbenchCompareDrag() && handleOriginalFillPick(e)) {
            e.preventDefault();
            updateWorkbenchUI();
        }
    });
    window.addEventListener('touchcancel', endWorkbenchCompareDrag);

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

    const toolMenuActions = {
        'brush': () => {
            toggleFillMode();
            setActiveEditorTool('brush');
            updateWorkbenchUI();
        },
        'bucket': () => {
            toggleFillMode();
            setActiveEditorTool('bucket');
            updateWorkbenchUI();
        },
        'edge': () => {
            toggleEdgeAdjustMode();
            setActiveEditorTool('edge');
            updateWorkbenchUI();
        },
        'eraser': () => {
            toggleDeleteMode();
            setActiveEditorTool('eraser');
            updateWorkbenchUI();
        },
        'area-erase': () => {
            toggleClearBaseMode();
            setActiveEditorTool('area-erase');
            updateWorkbenchUI();
        },
        'color-erase': () => {
            toggleColorEraseMode();
            setActiveEditorTool('color-eraser');
            updateWorkbenchUI();
        }
    };

    const eyedropperToolBtn = document.getElementById('eyedropper-tool-btn');
    if (eyedropperToolBtn) {
        eyedropperToolBtn.addEventListener('click', () => {
            activateEyedropper();
            updateWorkbenchUI();
        });
    }

    document.querySelectorAll('[data-recent-color]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.recentColor);
            if (Number.isInteger(index)) handleRecentColorSelect(index);
        });
    });
    document.querySelectorAll('[data-tool-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const action = toolMenuActions[button.dataset.toolAction];
            if (action) action();
            button.closest('.workbench-tool-menu')?.classList.remove('is-open');
        });
    });

    const topUndoBtn = document.getElementById('workbench-top-undo-btn');
    if (topUndoBtn) {
        topUndoBtn.addEventListener('click', () => {
            adjustUndo();
            refreshQualityOverlay();
            updateWorkbenchUI();
        });
    }

    const topRedoBtn = document.getElementById('workbench-top-redo-btn');
    if (topRedoBtn) {
        topRedoBtn.addEventListener('click', () => {
            adjustRedo();
            refreshQualityOverlay();
            updateWorkbenchUI();
        });
    }

    const topCancelBtn = document.getElementById('workbench-top-cancel-btn');
    if (topCancelBtn) {
        topCancelBtn.addEventListener('click', () => {
            adjustCancel();
            refreshQualityOverlay();
            updateWorkbenchUI();
        });
    }

    const resetPatternBtn = document.getElementById('reset-pattern-btn');
    if (resetPatternBtn) {
        resetPatternBtn.addEventListener('click', resetPatternToGenerated);
    }

    const saveDraftBtn = document.getElementById('save-draft-btn');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!AppState.pixelData || !AppState.pixelData.length) {
                toggleDraftDrawer();
                return;
            }
            await saveWorkbenchDraft();
            AppState.draftDrawerOpen = true;
            updateWorkbenchUI();
        });
    }

    const toggleDraftDrawerBtn = document.getElementById('toggle-draft-drawer-btn');
    if (toggleDraftDrawerBtn) {
        toggleDraftDrawerBtn.addEventListener('click', toggleDraftDrawer);
    }

    const exportDraftsBtn = document.getElementById('export-drafts-btn');
    if (exportDraftsBtn) {
        exportDraftsBtn.addEventListener('click', exportWorkbenchDrafts);
    }

    document.addEventListener('pointerdown', (event) => {
        if (!AppState.draftDrawerOpen) return;
        const draftDrawer = document.getElementById('draft-drawer');
        const saveDraftBtn = document.getElementById('save-draft-btn');
        const toggleDraftDrawerBtn = document.getElementById('toggle-draft-drawer-btn');
        const target = event.target;
        if (draftDrawer?.contains(target) || saveDraftBtn?.contains(target) || toggleDraftDrawerBtn?.contains(target)) return;
        AppState.draftDrawerOpen = false;
        updateWorkbenchUI();
    });

    const importDraftsFile = document.getElementById('import-drafts-file');
    if (importDraftsFile) {
        importDraftsFile.addEventListener('change', async (event) => {
            await importWorkbenchDraftFile(event.target.files[0]);
            event.target.value = '';
        });
    }

    const draftBoxList = document.getElementById('draft-box-list');
    if (draftBoxList) {
        let suppressDraftClickUntil = 0;
        const handleDraftButtonAction = async (button) => {
            const action = button.getAttribute('data-draft-action');
            const draftId = button.getAttribute('data-draft-id');
            if (!draftId) return;
            if (action === 'restore') {
                restoreWorkbenchDraft(draftId);
                return;
            }
            if (action === 'export') {
                exportWorkbenchDraft(draftId);
                return;
            }
            if (action === 'delete') {
                await deleteWorkbenchDraft(draftId);
                updateWorkbenchUI();
            }
        };
        draftBoxList.addEventListener('pointerdown', async (event) => {
            const button = event.target.closest('button[data-draft-action]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            suppressDraftClickUntil = Date.now() + 600;
            await handleDraftButtonAction(button);
        });
        draftBoxList.addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-draft-action]');
            if (!button) return;
            if (Date.now() < suppressDraftClickUntil) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            await handleDraftButtonAction(button);
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
            const nextDraftAction = event.relatedTarget?.closest?.('button[data-draft-action]');
            if (nextDraftAction) return;
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
            refreshQualityOverlay();
            updateWorkbenchUI();
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
            refreshQualityOverlay();
            updateWorkbenchUI();
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
            refreshQualityOverlay();
            updateWorkbenchUI();
        });
    }

    window.addEventListener('resize', () => {
        updateWorkbenchUI();
    });

    updateWorkbenchUI();
});
