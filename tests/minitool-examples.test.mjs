import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExampleGroupLoader, expandExamplePattern, installMiniToolExamples } from '../src/platform/minitool/example-library.js';

class Element {
    constructor(tag) {
        this.tag = tag; this.children = []; this.attributes = {}; this.events = {};
        this.style = { setProperty() {} }; this.classList = { add() {} };
    }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text || ''; }
    appendChild(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, handler) { this.events[key] = handler; }
    click() { this.events.click(); }
    querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }; }
}
const makeDocument = () => ({ head: new Element('head'), createElement: tag => new Element(tag) });
const pattern = JSON.parse(readFileSync(new URL('../assets/data/minitool-examples/latest/corgi.json', import.meta.url)));
const tick = () => new Promise(resolve => setImmediate(resolve));
const groups = [{ id: 'latest', title: '最新', defaultOpen: true, count: 1, src: './assets/example-groups/latest.js' },
    { id: 'other', title: '另一组', count: 1, src: './assets/example-groups/other.js' }];

test('package loader requests only the selected local script, deduplicates pending loads, and releases it', async () => {
    const host = {}, doc = makeDocument(), load = createExampleGroupLoader(host, doc);
    assert.equal(doc.head.children.length, 0);
    const first = load(groups[0]);
    assert.equal(load(groups[0]), first);
    const script = doc.head.children[0];
    assert.equal(script.src, groups[0].src);
    host.__perlerReceiveExampleGroup('latest', [pattern]); script.onload();
    assert.deepEqual(await first, [pattern]);
    assert.equal(doc.head.children.length, 0);
    const reload = load(groups[0]);
    assert.notEqual(reload, first);
    const next = doc.head.children[0];
    host.__perlerReceiveExampleGroup('latest', [pattern]); next.onload();
    await reload;
});

test('failed or malformed group scripts reject and allow a fresh retry', async () => {
    const host = {}, doc = makeDocument(), load = createExampleGroupLoader(host, doc);
    let result = load(groups[0]); doc.head.children[0].onerror();
    await assert.rejects(result, /unavailable/);
    result = load(groups[0]); doc.head.children[0].onload();
    await assert.rejects(result, /Invalid/);
    result = load(groups[0]);
    host.__perlerReceiveExampleGroup('latest', [pattern]); doc.head.children[0].onload();
    assert.equal((await result).length, 1);
});

test('only default group loads; switching and collapsing releases canvases; editor opens an independent pattern', async () => {
    globalThis.document = makeDocument();
    const root = new Element('div'), requested = [], opened = [];
    installMiniToolExamples(root, groups, value => opened.push(value), async group => { requested.push(group.id); return [pattern]; });
    await tick();
    assert.deepEqual(requested, ['latest']);
    const [first, second] = root.children;
    const oldCanvas = first.querySelectorAll('canvas')[0];
    first.children[1].children[1].children[0].click();
    assert.equal(opened[0].pixelData.length, pattern.indices.length);
    opened[0].pixelData[0].id = 'CHANGED';
    assert.notEqual(expandExamplePattern(pattern).pixelData[0].id, 'CHANGED');
    second.children[0].children[0].click(); await tick();
    assert.equal(oldCanvas.width, 0);
    assert.equal(first.children[1].hidden, true);
    assert.deepEqual(requested, ['latest', 'other']);
    second.children[0].children[0].click();
    assert.equal(root.querySelectorAll('canvas').length, 0);
});

test('late results never reopen a collapsed or replaced group', async () => {
    globalThis.document = makeDocument();
    const root = new Element('div'), pending = [];
    installMiniToolExamples(root, groups, () => {}, group => new Promise(resolve => pending.push({ id: group.id, resolve })));
    root.children[1].children[0].children[0].click();
    pending[0].resolve([pattern]); await tick();
    assert.equal(root.querySelectorAll('canvas').length, 0);
    pending[1].resolve([pattern]); await tick();
    assert.equal(root.children[1].querySelectorAll('canvas').length, 1);
});

test('ungrouped libraries show their cards directly without a latest or group heading', async () => {
    globalThis.document = makeDocument();
    const root = new Element('div');
    const all = { id: 'all', title: '示例图纸', count: 6, defaultOpen: true, ungrouped: true };
    installMiniToolExamples(root, [all], () => {}, async () => Array(6).fill(pattern));
    await tick();
    assert.equal(root.querySelectorAll('h3').length, 0);
    assert.equal(root.querySelectorAll('canvas').length, 6);
    assert.equal(root.children[0].children.length, 1);
});

test('large groups render twelve cards per page and failures offer retry without partial cards', async () => {
    globalThis.document = makeDocument();
    const root = new Element('div'); let fail = true;
    const warn = console.warn; console.warn = () => {};
    try {
        installMiniToolExamples(root, groups.slice(0, 1), () => {}, async () => {
            if (fail) throw new Error('test');
            return Array(25).fill(pattern);
        });
        await tick();
        const body = root.children[0].children[1], [status, grid, more, retry] = body.children;
        assert.equal(retry.hidden, false); assert.equal(grid.children.length, 0);
        fail = false; retry.click(); await tick();
        assert.equal(grid.children.length, 12); assert.equal(retry.hidden, true);
        more.click(); assert.equal(grid.children.length, 24);
        more.click(); assert.equal(grid.children.length, 25); assert.equal(more.hidden, true);
    } finally { console.warn = warn; }
});
