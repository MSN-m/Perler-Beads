import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { installMobileCompareGestures } from '../src/features/mobile-compare.js';

function target() {
    const handlers = {};
    return {
        addEventListener(type, callback) { (handlers[type] ||= []).push(callback); },
        fire(type, touches = []) {
            const event = { type, touches, prevented: false, stopped: false,
                preventDefault() { this.prevented = true; },
                stopPropagation() { this.stopped = true; },
                stopImmediatePropagation() { this.stopped = true; } };
            for (const callback of handlers[type] || []) callback(event);
            return event;
        }
    };
}

test('mobile original pinch keeps its focus, pans and cannot trigger a color pick after release', () => {
    const frame = target();
    const win = target();
    const canvas = { width: 200, height: 200, style: { left: '50px', top: '0px' } };
    Object.assign(frame, { clientWidth: 300, clientHeight: 200,
        contains: value => value === canvas,
        getBoundingClientRect: () => ({ left: 10, top: 20 }) });
    globalThis.window = win;
    globalThis.document = { getElementById: () => canvas };
    Object.assign(AppState, { workbenchViewportMode: 'mobile', comparePreviewVisible: true,
        comparePreviewScale: 1, comparePreviewOffsetX: 0, comparePreviewOffsetY: 0 });
    const touch = (clientX, clientY) => ({ clientX, clientY, target: canvas });
    installMobileCompareGestures(frame);
    assert.ok(frame.fire('touchstart', [touch(110, 120), touch(210, 120)]).prevented);
    frame.fire('touchmove', [touch(80, 140), touch(280, 140)]);
    assert.equal(AppState.comparePreviewScale, 2);
    assert.equal(canvas.style.left, '-30px');
    assert.equal(canvas.style.top, '-80px');
    assert.equal(AppState.comparePreviewOffsetX, 20);
    assert.equal(AppState.comparePreviewOffsetY, 20);
    assert.equal(AppState.comparePreviewDragging, false);
    win.fire('touchend', [touch(280, 140)]);
    frame.fire('touchmove', [touch(300, 160)]);
    assert.equal(canvas.style.left, '-30px');
    win.fire('touchend');
    assert.ok(frame.fire('click').stopped);
    assert.equal(frame.fire('touchstart', [touch(100, 100)]).prevented, false);
    assert.equal(frame.fire('click').stopped, false);
    AppState.workbenchViewportMode = 'desktop';
    assert.equal(frame.fire('touchstart', [touch(110, 120), touch(210, 120)]).prevented, false);
    AppState.workbenchViewportMode = 'tablet';
    assert.equal(frame.fire('touchstart', [touch(110, 120), touch(210, 120)]).prevented, false);
});

test('mobile split limits keep both panes usable on tall and short screens', async () => {
    const { clampMobileCompareRatio } = await import('../src/features/mobile-compare.js');
    assert.equal(clampMobileCompareRatio(300, 600), .5);
    assert.equal(clampMobileCompareRatio(-100, 600), .2);
    assert.equal(clampMobileCompareRatio(900, 600), 380 / 600);
    assert.equal(clampMobileCompareRatio(-100, 200), .3);
    assert.equal(clampMobileCompareRatio(900, 200), .6);
});
