import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { renderResult } from '../src/renderer.js';

test('only the PC editor with a fixed overlay omits embedded guides; fine grid and labels remain', () => {
    let viewport = 'desktop', overlay = true;
    globalThis.document = { getElementById: id => id === 'fixed-ruler-canvas' ? (overlay ? {} : null)
        : id === 'workbench-layout' ? { dataset: { viewport } } : null };
    globalThis.requestAnimationFrame = () => {};
    Object.assign(AppState, { currentStep: 3, edgeSelectionMode: false, eraserStroke: null,
        fillMode: false, clearBaseMode: false, qualityOverlayVisible: false });
    AppState.editor.activeTool = 'pan';
    const pixels = Array.from({ length: 144 }, () => ({ id: 'A1', r: 240, g: 200, b: 160 }));
    const original = structuredClone(pixels);
    function draw(id = 'result-canvas') {
        const strokes = [], labels = [];
        const ctx = new Proxy({ stroke() { strokes.push(this.strokeStyle); }, fillText(...args) { labels.push(args); } },
            { get: (obj, key) => obj[key] ?? (() => {}) });
        renderResult({ id, getContext: () => ctx }, pixels, 12, 12);
        return { guides: strokes.filter(style => style !== 'rgba(0,0,0,0.05)').length,
            fine: strokes.filter(style => style === 'rgba(0,0,0,0.05)').length, labels: labels.length };
    }
    assert.deepEqual(draw(), { guides: 0, fine: 26, labels: 144 });
    for (viewport of ['tablet', 'mobile']) assert.equal(draw().guides, 4);
    viewport = 'desktop'; overlay = false;
    assert.equal(draw().guides, 4);
    overlay = true;
    assert.equal(draw('preview-canvas').guides, 4);
    AppState.currentStep = 4;
    assert.equal(draw().guides, 4);
    assert.deepEqual(pixels, original);
});
