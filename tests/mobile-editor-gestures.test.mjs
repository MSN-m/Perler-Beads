import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { initZoomEvents } from '../src/features/zoom.js';
import { cancelFillSelection } from '../src/features/adjust.js';

function createTarget() {
    const listeners = new Map();
    return {
        style: {},
        classList: { add() {}, remove() {} },
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        fire(type, touches = []) {
            const event = { type, touches, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
            for (const handler of listeners.get(type) || []) handler(event);
            return event;
        }
    };
}

test('mobile editor moves with two fingers, keeps the pinch center and releases without editing', () => {
    const container = createTarget();
    const canvas = createTarget();
    const reset = createTarget();
    const windowTarget = createTarget();
    const ratio = { textContent: '' };
    const context = new Proxy({}, { get: (target, property) => target[property] ?? (() => {}) });
    canvas.id = 'result-canvas';
    canvas.getContext = () => context;
    canvas.getBoundingClientRect = () => ({ left: AppState.zoomState.x, top: AppState.zoomState.y });
    container.contains = target => target === canvas || target === container;
    globalThis.window = windowTarget;
    globalThis.document = { getElementById: id => ({ 'result-canvas': canvas, 'mobile-editor-zoom-ratio': ratio })[id] };
    Object.assign(AppState, {
        workbenchViewportMode: 'mobile', currentStep: 3, editMode: 'adjust',
        zoomState: { scale: 1, fitScale: 1, x: 0, y: 0 },
        gridWidth: 2, gridHeight: 1, fillMode: true, clearBaseMode: false,
        edgeSelectionMode: false, qualityOverlayVisible: false
    });
    const initial = [{ id: 'A1', r: 12, g: 32, b: 52 }, { id: 'B2', r: 22, g: 42, b: 62 }];
    AppState.pixelData = structuredClone(initial);
    AppState.editor.activeTool = 'brush';
    AppState.editor.undoStack = [];
    const touch = (clientX, clientY) => ({ target: canvas, clientX, clientY });
    let clicks = 0;
    initZoomEvents(container, canvas, reset, () => clicks++, cancelFillSelection);

    for (const tool of ['paintStroke', 'eraserStroke']) {
        AppState.zoomState = { scale: 1, fitScale: 1, x: 0, y: 0 };
        AppState.stagedPixelData = [initial[1], initial[1]];
        AppState[tool] = { indices: [0], prevColors: [initial[0]] };

        container.fire('touchstart', [touch(50, 70), touch(100, 70)]);
        assert.deepEqual(AppState.stagedPixelData, initial);
        assert.equal(AppState[tool], null);
        assert.equal(AppState.editor.undoStack.length, 0);

        container.fire('touchmove', [touch(70, 85), touch(120, 85)]);
        assert.deepEqual([AppState.zoomState.x, AppState.zoomState.y], [20, 15]);
        assert.equal(ratio.textContent, '100%');
        container.fire('touchmove', [touch(45, 85), touch(145, 85)]);
        assert.deepEqual([AppState.zoomState.x, AppState.zoomState.y, AppState.zoomState.scale], [-55, -55, 2]);
        assert.equal(ratio.textContent, '200%');

        assert.ok(container.fire('touchend', [touch(145, 85)]).defaultPrevented);
        windowTarget.fire('touchend', [touch(145, 85)]);
        container.fire('touchmove', [touch(185, 125)]);
        assert.deepEqual([AppState.zoomState.x, AppState.zoomState.y], [-55, -55]);
        assert.ok(container.fire('touchend').defaultPrevented);
        windowTarget.fire('touchend');
        canvas.fire('click');
        assert.equal(clicks, tool === 'paintStroke' ? 0 : 1);
        canvas.fire('click');
    }
    assert.equal(clicks, 2);
});
