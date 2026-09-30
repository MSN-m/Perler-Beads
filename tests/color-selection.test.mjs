import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import {
    beginGlobalEditorSession, getCurrentPalette, getColorSelectionSnapshot,
    resetPatternColorSelection, rememberPaintColor, restorePaintColor,
    setActiveEditorTool, recordPixelAction, undoGlobalEditorOperation, redoGlobalEditorOperation
} from '../src/editor.js';

const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
};
const colors = getCurrentPalette().slice(0, 8);
const ids = () => AppState.recentColors.map(color => color.id);

test('default uses most-used nontransparent color without changing pixels or seeding recent colors', () => {
    resetPatternColorSelection();
    const pixels = [colors[1], colors[0], colors[1], { id: 'NONE' }];
    const before = JSON.stringify(pixels);
    beginGlobalEditorSession(pixels);
    assert.equal(AppState.fillColorId, colors[1].id);
    assert.deepEqual(ids(), []);
    assert.equal(JSON.stringify(pixels), before);
    assert.equal(AppState.editor.undoStack.length, 0);
});

test('five unique selections, newest first; reselecting moves to front', () => {
    resetPatternColorSelection();
    colors.slice(0, 6).forEach(rememberPaintColor);
    assert.deepEqual(ids(), colors.slice(1, 6).reverse().map(color => color.id));
    rememberPaintColor(colors[2]);
    assert.deepEqual(ids(), [colors[2], colors[5], colors[4], colors[3], colors[1]].map(color => color.id));
    rememberPaintColor(colors[2]);
    assert.equal(ids().length, 5);
});

test('transient color clears and editor sessions do not lose manual choice', () => {
    rememberPaintColor(colors[6]);
    const before = ids();
    AppState.fillColor = null;
    AppState.fillColorId = null;
    restorePaintColor();
    beginGlobalEditorSession([colors[0], colors[0]]);
    assert.equal(AppState.fillColorId, colors[6].id);
    assert.deepEqual(ids(), before);
});

test('draft metadata and newer local selections retain current color and last subtool', () => {
    resetPatternColorSelection();
    rememberPaintColor(colors[0]);
    const saved = getColorSelectionSnapshot();
    rememberPaintColor(colors[1]);
    setActiveEditorTool('bucket');
    resetPatternColorSelection(saved);
    assert.deepEqual(ids(), [colors[1].id, colors[0].id]);
    assert.equal(AppState.paintColor.id, colors[1].id);
    assert.equal(AppState.lastBrushTool, 'bucket');
    storage.clear();
    resetPatternColorSelection(saved);
    assert.deepEqual(ids(), [colors[0].id]);
    assert.equal(AppState.paintColor.id, colors[0].id);
});

test('new pattern and old draft are isolated; imported invalid IDs are ignored', () => {
    rememberPaintColor(colors[3]);
    resetPatternColorSelection();
    assert.deepEqual(ids(), []);
    assert.equal(AppState.paintColor, null);
    resetPatternColorSelection(null, 'old-draft');
    assert.deepEqual(ids(), []);
    resetPatternColorSelection({ recentColorIds: ['NONE', 'invalid', colors[0].id, colors[0].id], currentColorId: 'invalid' });
    assert.deepEqual(ids(), [colors[0].id]);
    assert.equal(AppState.paintColor, null);
});

test('undo/redo changes pixels only, not selected color or recent order', () => {
    resetPatternColorSelection();
    AppState.pixelData = [colors[0]];
    AppState.stagedPixelData = [{ ...colors[0] }];
    AppState.stagedActions = [];
    beginGlobalEditorSession(AppState.pixelData);
    AppState.stagedPixelData[0] = { ...colors[1] };
    recordPixelAction({ index: 0, prevColor: colors[0], nextColor: colors[1] });
    rememberPaintColor(colors[2]);
    const before = ids();
    undoGlobalEditorOperation();
    assert.equal(AppState.pixelData[0].id, colors[0].id);
    redoGlobalEditorOperation();
    assert.equal(AppState.pixelData[0].id, colors[1].id);
    assert.deepEqual(ids(), before);
    assert.equal(AppState.paintColor.id, colors[2].id);
});
