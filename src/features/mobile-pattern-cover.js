export function paintMobilePatternCover(canvas, card, { gridWidth, gridHeight, pixelData }) {
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(gridWidth, gridHeight);
    const counts = new Map();
    let dominant = null;
    let highestCount = 0;
    pixelData.forEach((pixel, index) => {
        if (!pixel || pixel.id === 'NONE' || pixel.a === 0) return;

        const { id, r, g, b } = pixel;
        image.data.set([r, g, b, 255], index * 4);
        const count = (counts.get(id) || 0) + 1;
        counts.set(id, count);
        if (count > highestCount) {
            highestCount = count;
            dominant = pixel;
        }
    });
    ctx.putImageData(image, 0, 0);
    if (dominant) {
        const { r, g, b } = dominant;
        card.style.setProperty('--cover-color', `rgb(${r} ${g} ${b})`);
    }
}
