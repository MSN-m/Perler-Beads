import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressSaver } from '../src/platform/minitool/progress-saver.js';

function setup(save) {
    let time = 0, value = 1, safe = true, active = true;
    const writes = [], statuses = [];
    const saver = createProgressSaver({
        read: () => active ? { token: [value], safe } : null,
        now: () => time,
        save: async current => { writes.push(current.token[0]); return save ? save(current) : true; },
        status: phase => statuses.push(phase)
    });
    return { saver, writes, statuses, at: t => { time = t; }, change: () => { value++; }, busy: flag => { safe = !flag; }, home: () => { active = false; } };
}

test('coalesces edits after two idle seconds and performs no unchanged writes', async () => {
    const c = setup();
    await c.saver.tick(); c.at(1000); c.change(); await c.saver.tick();
    c.at(2999); await c.saver.tick(); assert.equal(c.writes.length, 0);
    c.at(3000); await c.saver.tick(); assert.deepEqual(c.writes, [2]);
    c.at(100000); await c.saver.tick(); assert.equal(c.writes.length, 1);
});

test('continuous operations save within fifteen seconds but never mid-stroke', async () => {
    const c = setup(); await c.saver.tick();
    for (let t = 1000; t <= 15000; t += 1000) { c.at(t); c.change(); c.busy(true); await c.saver.tick(); }
    assert.equal(c.writes.length, 0);
    c.busy(false); await c.saver.tick(); assert.deepEqual(c.writes, [16]);
});

test('does not mark changes made during a slow write as saved or start overlapping writes', async () => {
    let finish;
    const c = setup(() => new Promise(resolve => { finish = resolve; }));
    await c.saver.tick(); c.at(2000); const pending = c.saver.tick();
    c.change(); c.at(4000); await c.saver.tick(); assert.equal(c.writes.length, 1);
    finish(true); await pending;
    assert.equal(c.statuses.at(-1), 'pending');
    c.at(6000); const next = c.saver.tick(); assert.equal(c.writes.length, 2);
    finish(true); await next; assert.equal(c.statuses.at(-1), 'saved');
});

test('failures retain pending revision, report error and back off instead of retrying each poll', async () => {
    let fail = true;
    const c = setup(() => { if (fail) throw new Error('quota'); return true; });
    await c.saver.tick(); c.at(2000); await c.saver.tick(); assert.equal(c.statuses.at(-1), 'error');
    c.change(); c.at(4000); await c.saver.tick(); assert.equal(c.writes.length, 1);
    fail = false; c.at(17000); await c.saver.tick(); assert.equal(c.writes.length, 2);
    assert.equal(c.statuses.at(-1), 'saved');
});

test('leaving the page before debounce does not save a stale project snapshot', async () => {
    const c = setup(); await c.saver.tick(); c.home(); c.at(4000); await c.saver.tick(); assert.equal(c.writes.length, 0);
});

test('busy save result is retried and never presented as persisted', async () => {
    const c = setup(() => false); await c.saver.tick(); c.at(2000); await c.saver.tick();
    assert.ok(!c.statuses.includes('saved')); c.at(3000); await c.saver.tick(); assert.equal(c.writes.length, 2);
});
