import test from 'node:test';
import assert from 'node:assert/strict';
import { captureRecentColors, animateRecentColors } from '../src/features/recent-color-motion.js';

function fixture() {
    const calls = [];
    const buttons = ['A', 'B', 'C'].map((id, index) => ({
        dataset: { renderedColorId: id },
        classList: { contains: () => index === 0 },
        getBoundingClientRect: () => ({ left: index * 36, top: 0, width: 28, height: 28 }),
        getAnimations: () => [],
        animate: (frames, options) => calls.push({ id: buttons[index].dataset.renderedColorId, frames, options })
    }));
    const container = { querySelectorAll: () => buttons };
    animateRecentColors(container, null, 'pattern');
    return { calls, buttons, container };
}

test('reordered colors animate from their own old position, not the old slot content', () => {
    const { calls, buttons, container } = fixture();
    const before = captureRecentColors(container);
    ['C', 'A', 'B'].forEach((id, index) => { buttons[index].dataset.renderedColorId = id; });
    animateRecentColors(container, before, 'pattern');
    assert.equal(calls.length, 3);
    assert.equal(calls[0].frames[0].transform, 'translate(72px, 0px)');
    assert.equal(calls[1].frames[0].transform, 'translate(-36px, 0px)');
    assert.equal(calls[0].frames.length, 3);
    assert.equal(calls[0].frames[1].transform, 'translate(39.6px, -2px)');
    assert.equal(calls[0].options.duration, 360);
});

test('unchanged UI refresh does not replay movement', () => {
    const { calls, container } = fixture();
    animateRecentColors(container, captureRecentColors(container), 'pattern');
    assert.equal(calls.length, 0);
});

test('new color enters with opacity feedback', () => {
    const { calls, buttons, container } = fixture();
    const before = captureRecentColors(container);
    buttons[0].dataset.renderedColorId = 'D';
    animateRecentColors(container, before, 'pattern');
    assert.equal(calls[0].frames[0].opacity, 0);
});

test('restoring another pattern or reduced motion does not animate old colors across patterns', () => {
    for (const [patternId, reduced] of [['other-pattern', false], ['pattern', true]]) {
        const { calls, buttons, container } = fixture();
        const before = captureRecentColors(container);
        buttons[0].dataset.renderedColorId = 'C';
        animateRecentColors(container, before, patternId, reduced);
        assert.equal(calls.length, 0);
    }
});
