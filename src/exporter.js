/**
 * 拼豆图纸生成器 - 导出逻辑
 */
import { AppState } from './state.js';

/**
 * 下载 PNG 图片
 */
export function downloadImage() {
    const stats = {};
    AppState.pixelData.forEach(p => {
        if (p.id === 'NONE') return;
        if (!stats[p.id]) stats[p.id] = { ...p, count: 0 };
        stats[p.id].count++;
    });
    const sortedStats = Object.values(stats).sort((a, b) => b.count - a.count);

    const boardSize = Math.max(AppState.gridWidth, AppState.gridHeight) <= 52 ? 52 : 104;
    const margin = boardSize === 52 ? 2 : 4;
    const exportScale = 60;
    const gridOffset = exportScale;
    
    // 1. 计算非透明色块的最小包围盒
    let minX = AppState.gridWidth, minY = AppState.gridHeight, maxX = -1, maxY = -1;
    let hasContent = false;
    for (let y = 0; y < AppState.gridHeight; y++) {
        for (let x = 0; x < AppState.gridWidth; x++) {
            const i = (y * AppState.gridWidth + x);
            if (AppState.pixelData[i].id !== 'NONE') {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasContent = true;
            }
        }
    }

    // 如果没有任何内容，默认显示 1x1
    if (!hasContent) {
        minX = 0; minY = 0; maxX = 0; maxY = 0;
    }

    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;

    // 动态计算导出尺寸：有效内容宽度/高度 + 左上标尺 (1个单位)
    const boardPxSizeX = (contentWidth + 1) * exportScale;
    const boardPxSizeY = (contentHeight + 1) * exportScale;
    
    // 不再居中，紧贴标尺
    const offsetX = 0;
    const offsetY = 0;

    // 计算底部清单布局
    const padding = 80;
    const cardWidth = 240;
    const cardHeight = 80;
    const gap = 30;
    // 确保画布宽度至少能容纳一个卡片，或者与内容同宽
    const minWidthForStats = padding * 2 + cardWidth;
    const finalCanvasWidth = Math.max(boardPxSizeX, minWidthForStats);
    
    const cardsPerRow = Math.max(1, Math.floor((finalCanvasWidth - padding * 2 + gap) / (cardWidth + gap)));
    const rows = Math.ceil(sortedStats.length / cardsPerRow);
    const statsHeight = rows * (cardHeight + gap) + padding * 2 + 60; 
    
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    
    exportCanvas.width = finalCanvasWidth;
    exportCanvas.height = boardPxSizeY + statsHeight;
    
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    exportCtx.textAlign = 'center';
    exportCtx.textBaseline = 'middle';
    exportCtx.font = `bold ${Math.floor(exportScale * 0.4)}px Arial`;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const i = (y * AppState.gridWidth + x);
            const color = AppState.pixelData[i];
            if (color.id === 'NONE') continue;
            const drawX = gridOffset + (x - minX) * exportScale;
            const drawY = gridOffset + (y - minY) * exportScale;

            exportCtx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            exportCtx.fillRect(drawX, drawY, exportScale, exportScale);

            const yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
            exportCtx.fillStyle = yiq >= 128 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
            exportCtx.fillText(color.id, drawX + exportScale / 2, drawY + exportScale / 2);
        }
    }

    // 绘制网格和辅助线
    exportCtx.lineWidth = 1;
    exportCtx.strokeStyle = 'rgba(0,0,0,0.1)';
    // 垂直线
    for (let i = 0; i <= contentWidth; i++) {
        const pos = gridOffset + i * exportScale;
        exportCtx.beginPath();
        exportCtx.moveTo(pos, gridOffset); exportCtx.lineTo(pos, boardPxSizeY);
        exportCtx.stroke();
    }
    // 水平线
    for (let i = 0; i <= contentHeight; i++) {
        const pos = gridOffset + i * exportScale;
        exportCtx.beginPath();
        exportCtx.moveTo(gridOffset, pos); exportCtx.lineTo(boardPxSizeX, pos);
        exportCtx.stroke();
    }

    // 垂直辅助线 (基于全局坐标计算是否为 5/10 倍数)
    for (let x = minX + 1; x <= maxX; x++) {
        // 只有当全局坐标是 5 的倍数时才画辅助线
        const isMajorLine = (x % 10 === 0);
        const isMinorLine = (x % 5 === 0);

        if (isMinorLine) {
            // 计算在当前画布上的绘制位置
            const pos = gridOffset + (x - minX) * exportScale;
            
            exportCtx.beginPath();
            if (isMajorLine) {
                exportCtx.setLineDash([]);
                exportCtx.strokeStyle = 'rgba(0,0,0,0.4)';
                exportCtx.lineWidth = 3;
            } else {
                exportCtx.setLineDash([10, 10]);
                exportCtx.strokeStyle = 'rgba(0,0,0,0.3)';
                exportCtx.lineWidth = 2;
            }
            exportCtx.moveTo(pos, gridOffset); exportCtx.lineTo(pos, boardPxSizeY);
            exportCtx.stroke();
            exportCtx.setLineDash([]);
        }
    }
    // 水平辅助线
    for (let y = minY + 1; y <= maxY; y++) {
        const isMajorLine = (y % 10 === 0);
        const isMinorLine = (y % 5 === 0);

        if (isMinorLine) {
            const pos = gridOffset + (y - minY) * exportScale;

            exportCtx.beginPath();
            if (isMajorLine) {
                exportCtx.setLineDash([]);
                exportCtx.strokeStyle = 'rgba(0,0,0,0.4)';
                exportCtx.lineWidth = 3;
            } else {
                exportCtx.setLineDash([10, 10]);
                exportCtx.strokeStyle = 'rgba(0,0,0,0.3)';
                exportCtx.lineWidth = 2;
            }
            exportCtx.moveTo(gridOffset, pos); exportCtx.lineTo(boardPxSizeX, pos);
            exportCtx.stroke();
            exportCtx.setLineDash([]);
        }
    }

    // 标尺
    exportCtx.fillStyle = 'rgba(0,0,0,0.7)';
    exportCtx.font = `bold ${Math.floor(exportScale * 0.4)}px Arial`;
    // 横向标尺
    for (let i = 0; i < contentWidth; i++) {
        const globalX = minX + i + 1; // 标尺从1开始
        const textPos = gridOffset + i * exportScale + exportScale / 2;
        exportCtx.fillText(globalX.toString(), textPos, exportScale / 2);
    }
    // 纵向标尺
    for (let i = 0; i < contentHeight; i++) {
        const globalY = minY + i + 1; // 标尺从1开始
        const textPos = gridOffset + i * exportScale + exportScale / 2;
        exportCtx.fillText(globalY.toString(), exportScale / 2, textPos);
    }

    // 清单标题
    const statsStartY = boardPxSizeY + padding;
    exportCtx.textAlign = 'left';
    exportCtx.textBaseline = 'top';
    exportCtx.fillStyle = '#333333';
    exportCtx.font = 'bold 48px Arial';
    
    // 构建标题文本
    const brandMap = {
        'mard': 'MARD',
        'perler': 'PERLER',
        'artkal': 'ARTKAL',
        'unk': 'UNKNOWN'
    };
    let brandText = brandMap[AppState.brand] || AppState.brand.toUpperCase();
    if (AppState.brand === 'mard' && AppState.mardSet) {
        brandText += `-${AppState.mardSet}色`;
    }
    const title = `颜色清单(${brandText})-共${sortedStats.length}种颜色`;
    exportCtx.fillText(title, padding, statsStartY - 60);

    // 清单卡片
    exportCtx.textBaseline = 'middle';
    sortedStats.forEach((c, index) => {
        const row = Math.floor(index / cardsPerRow);
        const col = index % cardsPerRow;
        const x = padding + col * (cardWidth + gap);
        const y = statsStartY + row * (cardHeight + gap);

        const radius = cardHeight / 2;
        exportCtx.beginPath();
        exportCtx.roundRect(x, y, cardWidth, cardHeight, radius);
        exportCtx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        exportCtx.fill();

        const yiq = ((c.r * 299) + (c.g * 587) + (c.b * 114)) / 1000;
        exportCtx.fillStyle = yiq >= 128 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
        
        exportCtx.font = 'bold 32px Arial';
        exportCtx.textAlign = 'left';
        exportCtx.fillText(c.id, x + 30, y + cardHeight / 2);
        
        exportCtx.textAlign = 'right';
        exportCtx.font = 'bold 26px Arial';
        exportCtx.fillText(`(${c.count})`, x + cardWidth - 30, y + cardHeight / 2);
    });

    const link = document.createElement('a');
    link.download = `perler-pattern-${AppState.gridWidth}x${AppState.gridHeight}-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

/**
 * 下载 SVG 图片
 */
export function downloadSVG() {
    const scale = 20;
    const width = AppState.gridWidth * scale;
    const height = AppState.gridHeight * scale;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="${width}" height="${height}" fill="#eee"/>`;

    AppState.pixelData.forEach((color, i) => {
        const x = (i % AppState.gridWidth) * scale;
        const y = Math.floor(i / AppState.gridWidth) * scale;
        if (color.id !== 'NONE') {
            svg += `<circle cx="${x + scale / 2}" cy="${y + scale / 2}" r="${scale / 2 - 1}" fill="rgb(${color.r},${color.g},${color.b})" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>`;
        }
    });

    svg += `</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `perler-pattern-${Date.now()}.svg`;
    link.href = url;
    link.click();
}
