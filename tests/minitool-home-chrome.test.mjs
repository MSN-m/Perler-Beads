import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeChromeInset, getNativeChromeBottom, getEditorChromeLayout } from '../src/platform/minitool/home-chrome.js';

test('editor title shares the legacy button row and returns its former height to the canvas', () => {
    const info = { windowWidth: 375, safeArea: { top: 0 }, menuButtons: {
        back: { left: 10, right: 42, bottom: 62, width: 32, height: 32 },
        share: { left: 333, right: 365, bottom: 62, width: 32, height: 32 }
    } };
    assert.deepEqual(getEditorChromeLayout(info), { titleCenter: 46, titleWidth: 275, rowTop: 74 });
    assert.equal((getNativeChromeBottom(info) + 8 + 112) - (74 + 68), 40);
});

test('capsule layout limits the centered title to the unobstructed middle band', () => {
    assert.deepEqual(getEditorChromeLayout({ windowWidth: 375, safeArea: { top: 54 }, menuButtons: {
        capsule: { left: 265, right: 355, bottom: 96, width: 90, height: 32 }
    } }), { titleCenter: 80, titleWidth: 139, rowTop: 108 });
});

test('unsafe title space or unknown geometry retains the below-button layout', () => {
    assert.equal(getEditorChromeLayout({}), null);
    assert.equal(getEditorChromeLayout({ windowWidth: 375, menuButtons: { capsule: { left: 180, right: 270, bottom: 50, width: 90, height: 32 } } }), null);
    assert.equal(getEditorChromeLayout({ windowWidth: 375, safeArea: { top: 60 }, menuButtons: { back: { left: 10, right: 42, bottom: 62, width: 32, height: 32 } } }), null);
});

test('new capsule takes priority over legacy rectangles and status bar is not added twice', () => {
    assert.equal(getNativeChromeBottom({ statusBarHeight: 54, safeArea: { top: 54 }, menuButtons: {
        capsule: { width: 90, height: 32, bottom: 94 }, back: { width: 32, height: 32, bottom: 150 }
    } }), 94);
});

test('zero-size capsule and hidden legacy controls do not reserve space', () => {
    assert.equal(getNativeChromeBottom({ menuButtons: { capsule: { width: 0, height: 0, bottom: 900 }, back: { width: 32, height: 32, bottom: 48 } } }), 48);
    assert.equal(getNativeChromeBottom({ menuButtons: { back: { width: 0, height: 0, bottom: 200 } } }), 0);
    assert.equal(getNativeChromeBottom({ menuButtons: { back: { bottom: 200 } } }), 0);
});

test('normal native controls fit above the centered logo without a duplicate status bar offset', () => {
    assert.deepEqual(getHomeChromeInset({ statusBarHeight: 54, screenTop: 54, safeArea: { top: 0 }, menuButtons: { back: null, me: { width: 32, height: 32, bottom: 44 }, share: { width: 32, height: 32, bottom: 44 } } }), { top: 79, extra: 0 });
});

test('larger native button rectangles shift the complete hero and gallery below the controls', () => {
    assert.deepEqual(getHomeChromeInset({ safeArea: { top: 54 }, menuButtons: { back: { width: 32, height: 32, bottom: 89.5 }, me: null, share: { width: 32, height: 32, bottom: 96 } } }), { top: 116, extra: 37 });
});

test('hidden, missing or invalid native geometry uses the source layout without reserving hidden controls', () => {
    for (const value of [null, {}, { menuButtons: { back: null, me: null, share: null } }, { safeArea: { top: -1 }, menuButtons: { back: { bottom: NaN } } }]) {
        assert.deepEqual(getHomeChromeInset(value), { top: 79, extra: 0 });
    }
});
