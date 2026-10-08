import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportBatch } from '../src/features/export-modal.js';

function setup({ failSave = false, failPrepare = false } = {}) {
    const events = [];
    let fail = failSave;
    const batch = createExportBatch({
        prepare(types) { events.push(['prepare', [...types]]); if (failPrepare) throw new Error('canvas'); return types; },
        start(files) { events.push(['start', [...files]]); },
        async save() { events.push(['save']); return !fail; }
    });
    return { batch, events, recover() { fail = false; } };
}

test('all selected downloads start before exactly one draft save', async () => {
    const { batch, events } = setup();
    const pending = batch.run(['raw', 'pattern', 'mirrored']);
    assert.deepEqual(events, [['prepare', ['pattern', 'mirrored', 'raw']], ['start', ['pattern', 'mirrored', 'raw']], ['save']]);
    assert.equal(batch.busy, true);
    assert.equal(await batch.run(['pattern']), null);
    assert.deepEqual(await pending, { complete: true });
    assert.equal(batch.busy, false);
});

test('every nonempty combination downloads only selections; raw alone does not save', async () => {
    for (let mask = 1; mask < 8; mask++) {
        const types = ['pattern', 'mirrored', 'raw'].filter((_, i) => mask & (1 << i));
        const { batch, events } = setup();
        assert.deepEqual(await batch.run(types), { complete: true });
        assert.deepEqual(events[1], ['start', types]);
        assert.equal(events.filter(([event]) => event === 'save').length, mask === 4 ? 0 : 1);
    }
});

test('no selections never prepare, download or save', async () => {
    const { batch, events } = setup();
    assert.equal(await batch.run([]), null);
    assert.equal(await batch.run(['unknown']), null);
    assert.deepEqual(events, []);
});

test('save failure retains retry state; retry saves without redownloading', async () => {
    const { batch, events, recover } = setup({ failSave: true });
    assert.deepEqual(await batch.run(['mirrored', 'raw']), { complete: false });
    assert.equal(batch.savePending, true);
    assert.equal(batch.busy, false);
    recover();
    assert.deepEqual(await batch.run([]), { complete: true });
    assert.equal(batch.savePending, false);
    assert.deepEqual(events.map(([event]) => event), ['prepare', 'start', 'save', 'save']);
});

test('prepare failure starts no partial downloads and saves nothing', async () => {
    const { batch, events } = setup({ failPrepare: true });
    await assert.rejects(batch.run(['pattern', 'raw']), /canvas/);
    assert.equal(batch.busy, false);
    assert.equal(batch.savePending, false);
    assert.deepEqual(events, [['prepare', ['pattern', 'raw']]]);
});

test('reset after dismissal drops the old retry state', async () => {
    const { batch, events, recover } = setup({ failSave: true });
    await batch.run(['pattern']);
    batch.reset();
    recover();
    await batch.run(['raw']);
    assert.deepEqual(events.at(-1), ['start', ['raw']]);
    assert.equal(events.filter(([event]) => event === 'save').length, 1);
});
