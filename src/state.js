/**
 * 拼豆图纸生成器 - 全局状态管理
 */

export const AppState = {
    currentStep: 1,
    image: null,
    originalImageData: null,
    history: [],
    canvasSize: 0,
    gridWidth: 32,
    gridHeight: 32,
    brand: 'mard',
    mardSet: 221,
    pixelData: [],
    isBgRemoving: false,
    highlightedColorId: null,
    zoomState: {
        scale: 1,
        x: 0,
        y: 0,
        isDragging: false,
        lastX: 0,
        lastY: 0,
        lastDist: 0
    },
    editMode: 'none',
    adjustPhase: 'waiting_receiver',
    receiverIndex: null,
    receiverColorId: null,
    stagedPixelData: null,
    stagedActions: [],
    preAdjustZoomState: null,
    edgeSelectionMode: false,
    selectedEdgeBeadsIndices: [],
    deleteMode: false,
    batchReplace: {
        active: false,
        mode: null,
        sourceColorId: null,
        nearCandidates: [],
        nearBaseline: null,
        nearCurrentId: null
    }
};
