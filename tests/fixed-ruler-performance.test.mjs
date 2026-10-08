import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { renderFixedRuler } from '../src/features/fixed-ruler.js';

test('ruler coalesces requests, uses the latest geometry, bounds dots and preserves its backing store', () => {
    const frames = [], dots = [];
    let clears = 0, resets = 0, zoom = 0.15, viewport = 'desktop';
    const ctx = new Proxy({
        clearRect() { clears++; }, arc(x, y) { dots.push([x, y]); },
        measureText() { return { width: 22 }; }
    }, { get: (obj, key) => obj[key] ?? (() => {}) });
    const ruler = { classList: { toggle() {} }, getContext: () => ctx };
    for (const prop of ['width', 'height']) {
        let value = 0;
        Object.defineProperty(ruler, prop, { get: () => value, set: next => { resets++; value = next; } });
    }
    const canvas = { classList: { contains: () => false }, getBoundingClientRect: () => ({ left: 10, top: 20 }) };
    const container = { clientWidth: 1000, clientHeight: 700, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    const elements = { 'fixed-ruler-canvas': ruler, 'result-canvas': canvas, 'result-container': container,
        'workbench-layout': { dataset: { get viewport() { return viewport; } } } };
    globalThis.document = { getElementById: id => elements[id] };
    globalThis.window = { devicePixelRatio: 1 };
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
    globalThis.requestAnimationFrame = fn => { frames.push(fn); };
    Object.assign(AppState, { currentStep: 3, renderedMinX: 0, renderedMinY: 0 });
    AppState.zoomState.scale = zoom;
    for (let i = 0; i < 30; i++) renderFixedRuler();
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(clears, 1);
    assert.equal(resets, 2);
    assert.ok(dots.length < 11000, `Too many full-view dots: ${dots.length}`);
    const xPositions = [...new Set(dots.map(dot => dot[0]))].sort((a, b) => a - b);
    assert.ok(xPositions[1] - xPositions[0] >= 8);
    for (const x of xPositions) assert.ok(Math.abs((x - 10 - 30 * zoom) / (30 * zoom) * 2 - Math.round((x - 10 - 30 * zoom) / (30 * zoom) * 2)) < 1e-8);
    dots.length = 0;
    renderFixedRuler();
    AppState.zoomState.scale = 1;
    frames.shift()();
    assert.equal(resets, 2);
    const enlargedX = [...new Set(dots.map(dot => dot[0]))].sort((a, b) => a - b);
    assert.equal(enlargedX[1] - enlargedX[0], 15);
    window.devicePixelRatio = 2;
    renderFixedRuler(); frames.shift()();
    assert.equal(ruler.width, 2000); assert.equal(ruler.height, 1400);
    assert.equal(resets, 4);
    viewport = 'mobile';
    renderFixedRuler(); frames.shift()();
    assert.equal(clears, 3);
});
