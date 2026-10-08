import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { downloadImage, downloadMirroredImage, downloadRawImage, preparePatternExports, startPatternDownloads } from '../src/exporter.js';

const canvases = [], downloads = [];
globalThis.document = {
    createElement(type) {
        if (type === 'a') return { click() { downloads.push({ name: this.download, href: this.href }); } };
        const ctx = { fills: [], texts: [] };
        const proxy = new Proxy(ctx, { get(target, key) {
            if (key === 'fillRect') return (...args) => target.fills.push([target.fillStyle, ...args]);
            if (key === 'fillText') return (...args) => target.texts.push(args);
            return target[key] ?? (() => {});
        } });
        const canvas = { ctx, getContext: () => proxy, toDataURL: () => 'data:image/png;base64,test' };
        canvases.push(canvas);
        return canvas;
    }
};
const red = { id: 'R', r: 240, g: 0, b: 0, a: 255 };
const blue = { id: 'B', r: 0, g: 0, b: 240, a: 255 };
const none = { id: 'NONE', r: 0, g: 0, b: 0, a: 0 };
function setup(mirrored = false) {
    Object.assign(AppState, { gridWidth: 3, gridHeight: 1, pixelData: [blue, none, blue], stagedPixelData: mirrored ? [blue, none, red] : [red, none, blue], patternName: '导出测试', brand: 'mard', mardSet: '221', isMirrored: mirrored });
    canvases.length = downloads.length = 0;
}
function redX(canvas) { return canvas.ctx.fills.find(([color]) => color === 'rgb(240,0,0)')[1]; }

test('preview render uses staged pixels, draws labels and never downloads or changes editor state', () => {
    setup(); const state = structuredClone(AppState);
    const canvas = downloadImage({ renderOnly: true, pixelData: AppState.stagedPixelData });
    assert.equal(redX(canvas), 60);
    assert.ok(canvas.ctx.texts.some(([text]) => text === 'R'));
    assert.equal(downloads.length, 0);
    assert.deepEqual(AppState, state);
});

test('mirrored export reverses current pixels even when editor mirror is already on', () => {
    for (const mirrored of [false, true]) {
        setup(mirrored); const state = structuredClone(AppState);
        const options = { renderOnly: true, pixelData: AppState.stagedPixelData };
        const regular = downloadImage(options), flipped = downloadMirroredImage(options);
        assert.equal(redX(regular) + redX(flipped), 240);
        assert.ok(flipped.ctx.texts.some(([text]) => text === 'R'));
        assert.deepEqual(AppState, state);
    }
});

test('raw render has no labels or grids and leaves empty cells transparent', () => {
    setup();
    const canvas = downloadRawImage({ renderOnly: true, pixelData: AppState.stagedPixelData });
    assert.equal(canvas.ctx.texts.length, 0);
    assert.deepEqual(canvas.ctx.fills, [['rgb(240,0,0)', 0, 0, 20, 20], ['rgb(0,0,240)', 40, 0, 20, 20]]);
});

test('selected exports are encoded before downloads, uniquely named and preserve staged data', () => {
    setup(); const state = structuredClone(AppState);
    const files = preparePatternExports(['pattern', 'mirrored', 'raw']);
    assert.deepEqual(files.map(file => file.type), ['pattern', 'mirrored', 'raw']);
    assert.equal(new Set(files.map(file => file.filename)).size, 3);
    assert.equal(new Set(files.map(file => file.archiveFilename)).size, 1);
    assert.equal(files[0].archiveFilename, '导出测试-图纸合集.zip');
    assert.deepEqual(files.map(file => file.filename), ['导出测试-拼豆图纸.png', '导出测试-镜像图纸.png', '导出测试-无标注图.png']);
    assert.equal(downloads.length, 0);
    startPatternDownloads(files);
    assert.equal(downloads.length, 3);
    assert.deepEqual(AppState, state);
});

test('legacy single-download entry points still request one PNG each', () => {
    setup(); downloadImage(); downloadMirroredImage(); downloadRawImage();
    assert.equal(downloads.length, 3);
    assert.ok(downloads.every(file => file.name.endsWith('.png')));
    assert.deepEqual(downloads.map(file => file.name), ['导出测试-拼豆图纸.png', '导出测试-镜像图纸.png', '导出测试-无标注图.png']);
});

test('PC batches and PAD/mobile single exports share sanitized title and Chinese type names', () => {
    for (const [title, base] of [
        ['大橘猫', '大橘猫'],
        ['  猫 / A:*?"<>|\\ B  ', '猫---A--B'],
        ['', '未命名图纸'],
        ['   ', '未命名图纸'],
        ['猫'.repeat(60), '猫'.repeat(48)]
    ]) {
        setup(); AppState.patternName = title;
        const state = structuredClone(AppState);
        const files = preparePatternExports(['raw', 'mirrored', 'pattern']);
        assert.deepEqual(files.map(file => file.filename), ['拼豆图纸', '镜像图纸', '无标注图'].map(type => `${base}-${type}.png`));
        assert.ok(files.every(file => file.archiveFilename === `${base}-图纸合集.zip`));
        downloadImage(); downloadMirroredImage(); downloadRawImage();
        assert.deepEqual(downloads.map(file => file.name), files.map(file => file.filename));
        assert.deepEqual(AppState, state);
    }
});
