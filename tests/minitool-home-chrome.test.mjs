import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeChromeInset } from '../src/platform/minitool/home-chrome.js';

test('normal native controls fit above the centered logo without a duplicate status bar offset', () => {
    assert.deepEqual(getHomeChromeInset({ statusBarHeight: 54, screenTop: 54, safeArea: { top: 0 }, menuButtons: { back: null, me: { bottom: 44 }, share: { bottom: 44 } } }), { top: 79, extra: 0 });
});

test('larger native button rectangles shift the complete hero and gallery below the controls', () => {
    assert.deepEqual(getHomeChromeInset({ safeArea: { top: 54 }, menuButtons: { back: { bottom: 89.5 }, me: null, share: { bottom: 96 } } }), { top: 116, extra: 37 });
});

test('hidden, missing or invalid native geometry uses the source layout without reserving hidden controls', () => {
    for (const value of [null, {}, { menuButtons: { back: null, me: null, share: null } }, { safeArea: { top: -1 }, menuButtons: { back: { bottom: NaN } } }]) {
        assert.deepEqual(getHomeChromeInset(value), { top: 79, extra: 0 });
    }
});
