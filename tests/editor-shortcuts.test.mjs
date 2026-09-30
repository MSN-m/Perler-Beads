import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorShortcuts } from '../src/features/editor-shortcuts.js';

function fixture() {
    const context = { enabled: true, tool: 'pan' };
    const calls = [];
    const keyboard = createEditorShortcuts({
        context: () => context,
        selectTool: tool => { calls.push(tool); context.tool = tool; },
        undo: () => calls.push('undo'), redo: () => calls.push('redo'),
        escape: () => calls.push('escape'),
        beginTemporaryPan: () => calls.push('begin'), endTemporaryPan: () => calls.push('end'),
        stopPan: () => calls.push('stop'), defer: callback => callback()
    });
    const event = (key, extra = {}) => ({ key, preventDefault() { this.prevented = true; }, ...extra });
    const press = (key, extra) => { const e = event(key, extra); keyboard.keydown(e); return e; };
    return { context, calls, keyboard, event, press };
}

test('visible editor only, repeated keys and active tool family do nothing', () => {
    const f = fixture();
    f.context.enabled = false; f.press('b');
    f.context.enabled = true; f.press('b', { repeat: true });
    f.context.tool = 'bucket'; f.press('B');
    assert.deepEqual(f.calls, []);
    f.press('h'); f.press('h');
    assert.deepEqual(f.calls, ['pan']);
});
test('typing, composition, gestures and confirmation modal block tool changes', () => {
    for (const flag of ['typing', 'busy', 'modal']) {
        const f = fixture(); f.context[flag] = true; f.press('e');
        assert.deepEqual(f.calls, []);
    }
    const f = fixture(); f.press('i', { isComposing: true }); f.press('b', { keyCode: 229 });
    assert.deepEqual(f.calls, []);
});
test('C does not toggle an open palette; other tools can leave it', () => {
    const f = fixture(); f.context.palette = true; f.context.tool = 'palette';
    f.press('c'); f.press('b');
    assert.deepEqual(f.calls, ['brush']);
});
test('Windows and Mac undo/redo prevent browser handling; unrelated combinations stay intact', () => {
    const f = fixture();
    assert.equal(f.press('z', { ctrlKey: true }).prevented, true);
    f.press('z', { metaKey: true, shiftKey: true }); f.press('y', { ctrlKey: true });
    assert.equal(f.press('s', { ctrlKey: true }).prevented, undefined);
    assert.deepEqual(f.calls, ['undo', 'redo', 'redo']);
});
test('space restores once; early release waits for gesture completion', () => {
    const f = fixture(); f.context.tool = 'edge';
    f.press(' '); f.press(' ', { repeat: true }); f.press('e');
    f.context.dragging = true; f.keyboard.keyup(f.event(' '));
    assert.deepEqual(f.calls, ['begin']);
    f.keyboard.pointerup(); f.keyboard.pointerup();
    assert.deepEqual(f.calls, ['begin', 'end']);
});
test('blur restores temporary pan, Esc can close a modal but does not interrupt gestures', () => {
    const f = fixture(); f.context.tool = 'brush'; f.press(' '); f.keyboard.blur();
    assert.deepEqual(f.calls, ['begin', 'stop', 'end']);
    f.context.modal = true; f.press('Escape');
    f.context.busy = true; f.press('Escape');
    assert.deepEqual(f.calls, ['begin', 'stop', 'end', 'escape']);
});
