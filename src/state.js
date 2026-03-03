/**
 * 拼豆图纸生成器 - 全局状态管理
 */

export const AppState = {
    currentStep: 1,
    image: null,
    originalImageData: null, // 用于撤销
    history: [], // 历史记录
    canvasSize: 0, // 像素
    gridWidth: 32, // 数量
    gridHeight: 32, // 数量
    brand: 'mard',
    mardSet: 216,
    pixelData: [], // 颜色对象数组
    isBgRemoving: false, // 是否处于移除背景模式
    highlightedColorId: null, // 当前高亮的颜色 ID
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
    stagedPixelData: null,
    stagedActions: [],
    preAdjustZoomState: null
    ,
    batchReplace: {
        active: false,
        mode: null,
        sourceColorId: null,
        nearCandidates: [],
        nearBaseline: null,
        nearCurrentId: null
    }
};
