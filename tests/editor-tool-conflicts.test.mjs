import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { activateEraserTool } from '../src/features/delete.js';
import { toggleEdgeAdjustMode } from '../src/features/edge.js';
import { toggleFillMode, activateEyedropper, toggleClearBaseMode, handleResultCanvasClickForAdjust, adjustUndo, adjustRedo, startFillSelection, endFillSelection } from '../src/features/adjust.js';
import { getEdgeBeadIndices } from '../src/utils.js';
import { renderResult } from '../src/renderer.js';
const pixel = id => ({ id, r: 20, g: 30, b: 40, a: id === 'NONE' ? 0 : 255 });
const context = new Proxy({}, { get: (object, key) => object[key] ?? (() => {}) });
const canvas = { id: 'result-canvas', getContext: () => context, getBoundingClientRect: () => ({ left: 0, top: 0 }), classList: { add() {}, remove() {} }, style: {} };
let alerts = [];
const counters = Object.fromEntries(['total-beads-count','color-types-count','color-stats'].map(id => [id, {}]));
globalThis.document = { addEventListener() {}, getElementById: id => id === 'result-canvas' ? canvas : counters[id] || null };
globalThis.window = { alert: text => alerts.push(text) };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#DE5387' });
function setup() {
    Object.assign(AppState, { pixelData: Array.from({ length: 16 }, () => pixel('A')), stagedPixelData: Array.from({ length: 16 }, () => pixel('A')), stagedActions: [], gridWidth: 4, gridHeight: 4, editMode: 'adjust', paintColor: pixel('B'), eraserStroke: null, eraserHoverColorId: null, eraserClickSuppressedUntil: 0, edgeSelectionMode: false, colorEraseMode: false, deleteMode: false, clearBaseMode: false, fillMode: false, eyedropperMode: false, paintStroke: null, fillSelection: null, selectedEdgeBeadsIndices: [], zoomState: { scale: 1 }, qualityOverlayVisible: false });
    Object.assign(AppState.editor, { activeTool: 'brush', undoStack: [], redoStack: [] });
    alerts = []; renderResult(canvas, AppState.stagedPixelData, 4, 4);
}
function click(x, y) { handleResultCanvasClickForAdjust({ clientX: 45 + 30 * x, clientY: 45 + 30 * y }); }
for (const eraser of ['eraser','area-erase','color-eraser']) {
    test(`${eraser} -> edge -> eraser clears incompatible modes and preserves pixels/history`, () => {
        setup(); activateEraserTool(eraser); toggleEdgeAdjustMode();
        assert.equal(AppState.colorEraseMode, false); assert.equal(AppState.deleteMode, false); assert.equal(AppState.clearBaseMode, false); assert.equal(AppState.edgeSelectionMode, true);
        click(0, 0);
        assert.equal(AppState.stagedPixelData.filter(p => p.id === 'B').length, 12);
        assert.equal(AppState.stagedPixelData.filter(p => p.id === 'NONE').length, 0);
        assert.equal(AppState.editor.undoStack.length, 1);
        adjustUndo(); assert.equal(AppState.stagedPixelData[0].id, 'A');
        adjustRedo(); assert.equal(AppState.stagedPixelData[0].id, 'B');
        activateEraserTool(eraser);
        assert.equal(AppState.edgeSelectionMode, false); assert.deepEqual(AppState.selectedEdgeBeadsIndices, []);
        click(0,0); assert.equal(AppState.stagedPixelData[0].id, 'NONE');
        assert.equal(AppState.stagedPixelData[5].id, 'A');
        assert.equal(AppState.editor.undoStack.length, 2);
    });
}
for (const tool of ['brush','bucket','eyedropper','area-erase']) {
    test(`color erase -> ${tool} cannot retain the color deletion branch`, () => {
        setup(); activateEraserTool('color-eraser');
        if (tool === 'eyedropper') activateEyedropper();
        else if (tool === 'area-erase') toggleClearBaseMode();
        else toggleFillMode(tool);
        assert.equal(AppState.colorEraseMode, false);
        assert.equal(AppState.editor.activeTool, tool);
        if (tool !== 'area-erase') {
            click(0,0);
            assert.equal(AppState.stagedPixelData.some(p => p.id === 'NONE'), false);
        }
    });
}
test('edge clicks use current color, reject interior cells and never start a brush stroke', () => {
    setup(); toggleEdgeAdjustMode();
    assert.equal(startFillSelection({ clientX:45, clientY:45 }), false);
    assert.equal(endFillSelection(), false);
    click(1,1);
    assert.equal(alerts.length, 1); assert.equal(AppState.editor.undoStack.length, 0);
    click(0,0); assert.equal(AppState.stagedPixelData[0].id, 'B');
    assert.equal(AppState.paintColor.id, 'B');
});
test('edge highlighting uses staged transparency and refreshes after undo/redo', () => {
    setup(); AppState.stagedPixelData[0] = pixel('NONE');
    toggleEdgeAdjustMode();
    assert.equal(AppState.selectedEdgeBeadsIndices.includes(0), false);
    click(1,0); assert.equal(AppState.stagedPixelData[0].id, 'NONE');
    adjustUndo(); assert.equal(AppState.stagedPixelData[0].id, 'NONE');
    adjustRedo(); assert.equal(AppState.stagedPixelData[0].id, 'NONE');
    assert.deepEqual(AppState.selectedEdgeBeadsIndices, getEdgeBeadIndices(AppState.stagedPixelData,4,4));
});
