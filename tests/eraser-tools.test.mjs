import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { connectedEraseIndices, handleAreaDeleteClick, handleColorDeleteClick, startEraserStroke, moveEraserStroke, endEraserStroke, updateEraserHover, activateEraserTool } from '../src/features/delete.js';
import { setActiveEditorTool, undoGlobalEditorOperation, redoGlobalEditorOperation } from '../src/editor.js';
const bead = id => ({ id, r: 1, g: 2, b: 3, a: id === 'NONE' ? 0 : 255 });
const notice = { hidden: true };
globalThis.document = { getElementById: id => id === 'eraser-status' ? notice : null };
function setup(ids, width = ids.length) {
    Object.assign(AppState, { stagedPixelData: ids.map(bead), pixelData: ids.map(bead), stagedActions: [], gridWidth: width, gridHeight: ids.length / width, eraserStroke: null, eraserHoverColorId: null, fillSelection: null });
    Object.assign(AppState.editor, { undoStack: [], redoStack: [], activeTool: 'eraser' });
}
const ids = () => AppState.pixelData.map(p => p.id);
test('area is four-neighbor same-color, excludes diagonals and row wrapping', () => {
    assert.deepEqual(connectedEraseIndices(['A','B','B','A'].map(bead), 0, 2), [0]);
    assert.deepEqual(connectedEraseIndices(['B','A','A','B'].map(bead), 1, 2), [1]);
    setup(['A','A','B','A','B','A'], 3);
    handleAreaDeleteClick(0, null);
    assert.deepEqual(ids(), ['NONE','NONE','B','NONE','B','A']);
    assert.equal(AppState.editor.undoStack.length, 1);
    undoGlobalEditorOperation(); assert.deepEqual(ids(), ['A','A','B','A','B','A']);
    redoGlobalEditorOperation(); assert.equal(ids()[3], 'NONE');
});
test('color erase removes disconnected cells as one undo action', () => {
    setup(['A','B','A','B']);
    handleColorDeleteClick(0, null);
    assert.deepEqual(ids(), ['NONE','B','NONE','B']);
    assert.equal(AppState.editor.undoStack.length, 1);
    undoGlobalEditorOperation(); assert.deepEqual(ids(), ['A','B','A','B']);
});
test('drag interpolates skipped cells, commits once, and supports undo and redo', () => {
    setup(['A','A','A','A','B']);
    startEraserStroke(0, null); moveEraserStroke(3, null);
    assert.equal(AppState.editor.undoStack.length, 0);
    endEraserStroke(null);
    assert.deepEqual(ids(), ['NONE','NONE','NONE','NONE','B']);
    assert.equal(AppState.editor.undoStack.length, 1);
    assert.equal(AppState.eraserStroke, null);
    assert.ok(AppState.eraserClickSuppressedUntil > Date.now());
    undoGlobalEditorOperation(); assert.deepEqual(ids(), ['A','A','A','A','B']);
    redoGlobalEditorOperation(); assert.equal(ids()[3], 'NONE');
});
test('whole-pattern deletion is rejected; continuous erasing retains the last bead', () => {
    setup(['A','A']);
    assert.equal(handleAreaDeleteClick(0, null), false);
    assert.equal(handleColorDeleteClick(0, null), false);
    assert.equal(AppState.editor.undoStack.length, 0);
    assert.equal(notice.textContent, '图纸至少需要保留一颗豆子');
    startEraserStroke(0, null); moveEraserStroke(1, null); endEraserStroke(null);
    assert.deepEqual(ids(), ['NONE','A']);
    assert.equal(startEraserStroke(0, null), false);
});
test('hover follows color and clears on transparent cells, leave and tool changes', () => {
    setup(['A','B','NONE']);
    AppState.editor.activeTool = 'color-eraser';
    updateEraserHover(0, null); assert.equal(AppState.eraserHoverColorId, 'A');
    updateEraserHover(1, null); assert.equal(AppState.eraserHoverColorId, 'B');
    updateEraserHover(2, null); assert.equal(AppState.eraserHoverColorId, null);
    updateEraserHover(0, null); updateEraserHover(null, null); assert.equal(AppState.eraserHoverColorId, null);
    updateEraserHover(0, null); setActiveEditorTool('brush'); assert.equal(AppState.eraserHoverColorId, null);
    assert.equal(AppState.editor.undoStack.length, 0);
});
test('eraser activation is idempotent, remembers subtool and keeps history and brush color', () => {
    setup(['A','B']); AppState.paintColor = bead('B');
    handleColorDeleteClick(0, null);
    activateEraserTool('area-erase'); activateEraserTool('area-erase');
    assert.equal(AppState.lastEraserTool, 'area-erase');
    assert.equal(AppState.fillSelection, null);
    assert.equal(AppState.editor.undoStack.length, 1);
    setActiveEditorTool('brush'); activateEraserTool(AppState.lastEraserTool);
    assert.equal(AppState.editor.activeTool, 'area-erase');
    assert.equal(AppState.paintColor.id, 'B');
    assert.equal(AppState.fillMode, false);
});

test('starting an erase cannot become a pan after the first cell turns transparent', async () => {
    const { initZoomEvents } = await import('../src/features/zoom.js');
    const events = new Map();
    const container = { addEventListener: (type, handler) => events.set(type, handler) };
    const canvas = { addEventListener() {} };
    globalThis.window = { addEventListener() {} };
    setup(['A','B']); AppState.zoomState = { scale: 1, isDragging: false };
    initZoomEvents(container, canvas, null, () => {});
    startEraserStroke(0, null);
    assert.equal(AppState.stagedPixelData[0].id, 'NONE');
    events.get('mousedown')({ target: canvas, clientX: 45, clientY: 45 });
    assert.equal(AppState.zoomState.isDragging, false);
    events.get('wheel')({ preventDefault() {}, deltaY: -100 });
    assert.equal(AppState.zoomState.scale, 1);
    endEraserStroke(null);
});
