import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { startFillSelection, endFillSelection } from '../src/features/adjust.js';
import { handleAreaDeleteClick } from '../src/features/delete.js';
import { undoGlobalEditorOperation, redoGlobalEditorOperation } from '../src/editor.js';
import { createEditorShortcuts } from '../src/features/editor-shortcuts.js';

test('a region-delete click releases the gesture lock so Ctrl+Z and redo can use its history', () => {
    globalThis.document = {
        getElementById: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) })
    };
    AppState.clearBaseMode = true;
    AppState.editor.activeTool = 'area-erase';
    AppState.editor.undoStack = [];
    AppState.editor.redoStack = [];
    AppState.stagedActions = [];
    AppState.zoomState = { scale: 1 };
    AppState.gridWidth = 3;
    AppState.gridHeight = 1;
    AppState.renderedMinX = 0;
    AppState.renderedMinY = 0;
    AppState.renderedContentWidth = 3;
    AppState.renderedContentHeight = 1;
    const color = { id: 'A', r: 10, g: 20, b: 30, a: 255 };
    const other = { id: 'B', r: 40, g: 50, b: 60, a: 255 };
    const empty = { id: 'NONE', r: 0, g: 0, b: 0, a: 0 };
    AppState.stagedPixelData = [{ ...color }, { ...color }, { ...other }];
    AppState.pixelData = AppState.stagedPixelData.map(pixel => ({ ...pixel }));
    const keyboard = createEditorShortcuts({
        context: () => ({ enabled: true, busy: Boolean(AppState.fillSelection), tool: 'area-erase' }),
        undo: undoGlobalEditorOperation,
        redo: redoGlobalEditorOperation
    });
    const press = (extra = {}) => {
        const event = { key: 'z', ctrlKey: true, preventDefault() { this.prevented = true; }, ...extra };
        keyboard.keydown(event);
        return event;
    };

    assert.equal(startFillSelection({ clientX: 45, clientY: 45 }), false);
    assert.equal(endFillSelection(), false, 'leave a non-drag gesture for the canvas click handler');
    assert.equal(AppState.fillSelection, null);

    // The canvas click records the connected-region deletion as one global action.
    handleAreaDeleteClick(0, null);
    assert.equal(press().prevented, true);
    assert.deepEqual(AppState.pixelData, [color, color, other]);
    assert.equal(AppState.editor.undoStack.length, 0);
    assert.equal(AppState.editor.redoStack.length, 1);
    press({ shiftKey: true });
    assert.deepEqual(AppState.pixelData, [empty, empty, other]);
    assert.equal(AppState.editor.activeTool, 'area-erase');

    // Clicking a transparent cell still ends the gesture even if it deletes nothing.
    startFillSelection({ clientX: 45, clientY: 45 });
    endFillSelection();
    assert.equal(AppState.fillSelection, null);
    assert.equal(press().prevented, true);
    assert.deepEqual(AppState.pixelData, [color, color, other]);
});
