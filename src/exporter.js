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
    
    const boardPxSize = (boardSize + 1) * exportScale;
    const offsetX = Math.floor((boardSize - AppState.gridWidth) / 2);
    const offsetY = Math.floor((boardSize - AppState.gridHeight) / 2);

    // 计算底部清单布局
    const padding = 80;
    const cardWidth = 240;
    const cardHeight = 80;
    const gap = 30;
    const cardsPerRow = Math.max(1, Math.floor((boardPxSize - padding * 2 + gap) / (cardWidth + gap)));
    const rows = Math.ceil(sortedStats.length / cardsPerRow);
    const statsHeight = rows * (cardHeight + gap) + padding * 2 + 60; 
    
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    
    exportCanvas.width = boardPxSize;
    exportCanvas.height = boardPxSize + statsHeight;
    
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    exportCtx.textAlign = 'center';
    exportCtx.textBaseline = 'middle';
    exportCtx.font = `bold ${Math.floor(exportScale * 0.4)}px Arial`;

    for (let y = 0; y < AppState.gridHeight; y++) {
        for (let x = 0; x < AppState.gridWidth; x++) {
            const i = (y * AppState.gridWidth + x);
            const color = AppState.pixelData[i];
            const drawX = gridOffset + (x + offsetX) * exportScale;
            const drawY = gridOffset + (y + offsetY) * exportScale;

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
    for (let i = 0; i <= boardSize; i++) {
        const pos = gridOffset + i * exportScale;
        exportCtx.beginPath();
        exportCtx.moveTo(pos, gridOffset); exportCtx.lineTo(pos, boardPxSize);
        exportCtx.stroke();
        exportCtx.beginPath();
        exportCtx.moveTo(gridOffset, pos); exportCtx.lineTo(boardPxSize, pos);
        exportCtx.stroke();
    }

    for (let gridIdx = 1; gridIdx < boardSize; gridIdx++) {
        const pos = gridOffset + gridIdx * exportScale;
        const isMarginLine = (gridIdx === margin || gridIdx === boardSize - margin);
        const isMajorLine = (gridIdx % 10 === 0);
        const isMinorLine = (gridIdx % 5 === 0);

        if (isMarginLine || isMinorLine) {
            exportCtx.beginPath();
            if (isMarginLine || isMajorLine) {
                exportCtx.setLineDash([]);
                exportCtx.strokeStyle = 'rgba(0,0,0,0.4)';
                exportCtx.lineWidth = 3;
            } else {
                exportCtx.setLineDash([10, 10]);
                exportCtx.strokeStyle = 'rgba(0,0,0,0.3)';
                exportCtx.lineWidth = 2;
            }
            exportCtx.moveTo(pos, gridOffset); exportCtx.lineTo(pos, boardPxSize);
            exportCtx.stroke();
            exportCtx.moveTo(gridOffset, pos); exportCtx.lineTo(boardPxSize, pos);
            exportCtx.stroke();
            exportCtx.setLineDash([]);
        }
    }

    // 标尺
    exportCtx.fillStyle = 'rgba(0,0,0,0.7)';
    exportCtx.font = `bold ${Math.floor(exportScale * 0.4)}px Arial`;
    for (let i = 1; i <= boardSize; i++) {
        const textPos = gridOffset + (i - 1) * exportScale + exportScale / 2;
        exportCtx.fillText(i.toString(), textPos, exportScale / 2);
        exportCtx.fillText(i.toString(), exportScale / 2, textPos);
    }

    // 清单标题
    const statsStartY = boardPxSize + padding;
    exportCtx.textAlign = 'left';
    exportCtx.textBaseline = 'top';
    exportCtx.fillStyle = '#333333';
    exportCtx.font = 'bold 48px Arial';
    exportCtx.fillText(`颜色清单 (Color List) - 共 ${sortedStats.length} 种颜色`, padding, statsStartY - 60);

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
