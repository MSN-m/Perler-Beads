
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyImageAdjustments, normalizeImageAdjustments } from '../src/features/image-adjustments.js';
globalThis.ImageData ??= class ImageData {
    constructor(data, width, height) { Object.assign(this, { data, width, height }); }
};
const image = rgba => new ImageData(new Uint8ClampedArray(rgba), rgba.length / 4, 1);
test('neutral and normalized settings preserve exact source; invalid values are bounded integers', () => {
    const source = image([11, 24, 68, 0, 200, 140, 19, 128]);
    assert.equal(applyImageAdjustments(source, {}), source);
    assert.deepEqual(normalizeImageAdjustments({ brightness: 99, contrast: -99, saturation: NaN }), { brightness: 10, contrast: -10, saturation: 0 });
    assert.deepEqual(normalizeImageAdjustments({ brightness: 2.7, contrast: Infinity, saturation: '3' }), { brightness: 3, contrast: 0, saturation: 3 });
});
test('brightness moves both ways without mutating source or alpha, including transparent hidden RGB', () => {
    const source = image([100, 100, 100, 128, 40, 70, 80, 0]);
    const original = [...source.data];
    const light = applyImageAdjustments(source, { brightness: 2 });
    const dark = applyImageAdjustments(source, { brightness: -2 });
    assert.ok(light.data[0] > 100 && dark.data[0] < 100);
    assert.equal(light.data[3], 128);
    assert.deepEqual([...light.data.slice(4)], original.slice(4));
    assert.deepEqual([...source.data], original);
    assert.deepEqual([...applyImageAdjustments(source, {}).data], original);
});
test('contrast expands and compresses around mid gray; saturation -10 gives grayscale', () => {
    const source = image([64, 128, 192, 255]);
    const high = applyImageAdjustments(source, { contrast: 5 });
    const low = applyImageAdjustments(source, { contrast: -5 });
    assert.ok(high.data[0] < 64 && high.data[2] > 192);
    assert.ok(low.data[0] > 64 && low.data[2] < 192);
    const gray = applyImageAdjustments(source, { saturation: -10 });
    assert.equal(gray.data[0], gray.data[1]); assert.equal(gray.data[1], gray.data[2]);
    const saturated = applyImageAdjustments(source, { saturation: 5 });
    assert.ok(saturated.data[2] - saturated.data[0] > 192 - 64);
});
test('combined extreme adjustments stay finite and preserve all alpha bytes and source pixels', () => {
    const source = image([0, 255, 20, 1, 255, 0, 200, 127, 255, 255, 255, 255]);
    const original = [...source.data];
    for (const brightness of [-10, 10]) for (const contrast of [-10, 10]) for (const saturation of [-10, 10]) {
        const result = applyImageAdjustments(source, { brightness, contrast, saturation });
        for (let i = 0; i < result.data.length; i++) {
            assert.ok(Number.isFinite(result.data[i]) && result.data[i] >= 0 && result.data[i] <= 255);
            if (i % 4 === 3) assert.equal(result.data[i], source.data[i]);
        }
    }
    assert.deepEqual([...source.data], original);
});
