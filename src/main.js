/**
 * 拼豆图纸生成器 - 主入口文件
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
    toggleColorHighlight,
    updateTolerance,
    toggleColorLimit,
    updateMaxColorsDisplay,
    resetZoom
} from './ui.js';
import { downloadImage, downloadSVG } from './exporter.js';
import { updateResultTransform } from './renderer.js';

/**
 * 处理图片上传
 */
const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            AppState.image = img;
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
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        AppState.image = img;
        goToStep(2);
    };
    img.src = urls[type];
};

// 绑定事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // --- 步骤 1: 首页/上传 ---
    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
        fileUpload.addEventListener('change', handleImageUpload);
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

    // --- 步骤 2: 设置 ---
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
        generateBtn.addEventListener('click', handleGeneratePattern);
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

    // --- 步骤 3: 编辑器/结果 ---
    const backToStep2 = document.getElementById('back-to-step-2');
    if (backToStep2) {
        backToStep2.addEventListener('click', () => goToStep(2));
    }

    const nextToStep4 = document.getElementById('next-to-step-4');
    if (nextToStep4) {
        nextToStep4.addEventListener('click', () => goToStep(4));
    }

    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', resetZoom);
    }

    // --- 步骤 4: 导出 ---
    const backToStep3 = document.getElementById('back-to-step-3');
    if (backToStep3) {
        backToStep3.addEventListener('click', () => goToStep(3));
    }

    const downloadImgBtn = document.getElementById('download-image-btn');
    if (downloadImgBtn) {
        downloadImgBtn.addEventListener('click', downloadImage);
    }
    
    const downloadSVGBtn = document.getElementById('download-svg-btn');
    if (downloadSVGBtn) {
        downloadSVGBtn.addEventListener('click', downloadSVG);
    }

    // --- 结果画布缩放与平移逻辑 ---
    const resultContainer = document.getElementById('result-container');
    const resultCanvas = document.getElementById('result-canvas');

    if (resultContainer && resultCanvas) {
        // 滚轮缩放
        resultContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.1 : 0.9;
            const newScale = Math.min(Math.max(AppState.zoomState.scale * factor, 0.5), 10);
            
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

        // 鼠标平移
        resultContainer.addEventListener('mousedown', (e) => {
            AppState.zoomState.isDragging = true;
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
            AppState.zoomState.x += dx;
            AppState.zoomState.y += dy;
            AppState.zoomState.lastX = e.clientX;
            AppState.zoomState.lastY = e.clientY;
            updateResultTransform(resultCanvas, AppState.zoomState, zoomResetBtn);
        });

        window.addEventListener('mouseup', () => {
            AppState.zoomState.isDragging = false;
            resultCanvas.classList.remove('cursor-grabbing');
            resultCanvas.classList.add('cursor-grab');
        });

        // 窗口大小变化时重置缩放以适配
        window.addEventListener('resize', () => {
            if (AppState.currentStep === 3) {
                resetZoom();
            }
        });

        // 触摸支持 (缩放和平移)
        resultContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                AppState.zoomState.isDragging = true;
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
                
                // 防止除以 0 导致的 Infinity
                if (AppState.zoomState.lastDist > 0) {
                    const factor = dist / AppState.zoomState.lastDist;
                    const newScale = Math.min(Math.max(AppState.zoomState.scale * factor, 0.5), 10);
                    
                    if (newScale !== AppState.zoomState.scale) {
                        const actualFactor = newScale / AppState.zoomState.scale;
                        
                        // 以两个手指的中点作为缩放中心
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
            if (AppState.zoomState) {
                AppState.zoomState.isDragging = false;
            }
        });
    }
});
