import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportDelivery } from '../src/features/export-files.js';
import { createExportBatch } from '../src/features/export-modal.js';
import { unzipSync } from '../src/vendor/fflate-0.8.2.js';

const files = ['pattern', 'mirrored', 'raw'].map((type, index) => ({
    type, filename: `大橘猫-${['拼豆图纸', '镜像图纸', '无标注图'][index]}.png`, archiveFilename: '大橘猫-图纸合集.zip',
    href: `data:image/png;base64,${Buffer.from([137, 80, 78, 71, index, 0, 255]).toString('base64')}`
}));

function setup(options = {}) {
    const downloads = [], blobs = [], revoked = [], timers = [];
    const delivery = createExportDelivery({
        download: value => downloads.push(value),
        urls: {
            createObjectURL(blob) { blobs.push(blob); return `blob:zip-${blobs.length}`; },
            revokeObjectURL(url) { revoked.push(url); }
        },
        schedule: callback => timers.push(callback),
        ...options
    });
    return { delivery, downloads, blobs, revoked, timers };
}

test('single selection downloads the original PNG synchronously without ZIP or object URLs', () => {
    for (const file of files) {
        const { delivery, downloads, blobs, timers } = setup({ zip: () => assert.fail('single PNG must not zip') });
        delivery.start([file]);
        assert.deepEqual(downloads, [[file]]);
        assert.equal(delivery.mode, 'png');
        assert.equal(blobs.length + timers.length, 0);
    }
});

test('all two/three image combinations produce one ZIP with exact PNG bytes and UTF8 names', async () => {
    for (const selected of [[files[0], files[1]], [files[0], files[2]], [files[1], files[2]], files]) {
        const { delivery, downloads, blobs, timers, revoked } = setup();
        const before = structuredClone(selected);
        delivery.start(selected);
        assert.equal(delivery.mode, 'zip');
        assert.deepEqual(downloads, [[{ type: 'archive', filename: '大橘猫-图纸合集.zip', href: 'blob:zip-1' }]]);
        assert.equal(blobs[0].type, 'application/zip');
        const bytes = new Uint8Array(await blobs[0].arrayBuffer());
        const entries = unzipSync(bytes);
        assert.deepEqual(Object.keys(entries), selected.map(file => file.filename));
        for (const file of selected) assert.deepEqual(entries[file.filename], new Uint8Array(Buffer.from(file.href.split(',')[1], 'base64')));
        // Independent ZIP local-header checks: STORE (no image recompression), UTF8,
        // exact lengths and bytes. Last local entry is followed by the central directory.
        const view = new DataView(bytes.buffer);
        let offset = 0;
        for (const file of selected) {
            assert.equal(view.getUint32(offset, true), 0x04034b50);
            assert.equal(view.getUint16(offset + 8, true), 0);
            assert.ok(view.getUint16(offset + 6, true) & 0x800);
            const size = view.getUint32(offset + 18, true);
            assert.equal(size, view.getUint32(offset + 22, true));
            const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
            assert.deepEqual(bytes.slice(start, start + size), entries[file.filename]);
            offset = start + size;
        }
        assert.equal(view.getUint32(offset, true), 0x02014b50);
        assert.deepEqual(selected, before);
        assert.deepEqual(revoked, []);
        delivery.reset();
        assert.equal(delivery.mode, null);
        assert.deepEqual(revoked, []); // Closing cannot revoke a pending download.
        timers[0]();
        assert.deepEqual(revoked, ['blob:zip-1']);
    }
});

test('empty selection starts no download or allocation', () => {
    const { delivery, downloads, blobs } = setup();
    assert.throws(() => delivery.start([]), /至少/);
    assert.equal(downloads.length + blobs.length, 0);
});

test('invalid image data prevents the whole archive download', () => {
    for (const href of ['not a PNG', 'data:image/png;base64,???']) {
        const { delivery, downloads, blobs } = setup();
        assert.throws(() => delivery.start([files[0], { ...files[1], href }]));
        assert.equal(delivery.mode, null);
        assert.equal(downloads.length + blobs.length, 0);
    }
});

test('duplicate or path filenames cannot silently drop an image or create ZIP folders', () => {
    for (const filename of [files[0].filename, '../test.png', 'dir\\test.png', '']) {
        const { delivery, downloads } = setup();
        assert.throws(() => delivery.start([files[0], { ...files[1], filename }]), /文件名/);
        assert.equal(downloads.length, 0);
    }
});

test('ZIP creation failure downloads and saves nothing; retry keeps the same render snapshot', async () => {
    let fail = true, saves = 0, renders = 0;
    const { delivery, downloads, blobs } = setup({ zip: () => { if (fail) throw new Error('pack failed'); return new Uint8Array([80, 75]); } });
    const batch = createExportBatch({
        prepare: () => { renders++; return files; }, start: value => delivery.start(value),
        save: async () => { saves++; return true; }
    });
    await assert.rejects(batch.run(['pattern', 'mirrored', 'raw']), /pack failed/);
    assert.equal(downloads.length + blobs.length + saves, 0);
    assert.equal(batch.busy, false);
    assert.equal(batch.filesPending, true);
    fail = false;
    assert.deepEqual(await batch.run([]), { complete: true });
    assert.equal(renders, 1);
    assert.equal(downloads.length, 1);
    assert.equal(saves, 1);
});

test('download request exception revokes the allocated ZIP URL immediately', () => {
    const { delivery, revoked, timers } = setup({ download: () => { throw new Error('download failed'); } });
    assert.throws(() => delivery.start(files), /download failed/);
    assert.equal(delivery.mode, null);
    assert.deepEqual(revoked, ['blob:zip-1']);
    assert.equal(timers.length, 0);
});

test('object URL allocation failure cannot start downloads or draft saving', async () => {
    const { delivery, downloads } = setup({ urls: { createObjectURL: () => { throw new Error('allocation failed'); } } });
    const batch = createExportBatch({ prepare: () => files, start: value => delivery.start(value), save: () => assert.fail('must not save') });
    await assert.rejects(batch.run(['pattern', 'raw']), /allocation failed/);
    assert.equal(downloads.length, 0);
    assert.equal(batch.filesPending, true);
});

test('draft-save retry never starts another ZIP download', async () => {
    let failSave = true;
    const { delivery, downloads } = setup();
    const batch = createExportBatch({ prepare: () => files, start: value => delivery.start(value), save: async () => !failSave });
    assert.deepEqual(await batch.run(['pattern', 'mirrored', 'raw']), { complete: false });
    assert.equal(batch.savePending, true);
    assert.equal(batch.filesPending, false);
    failSave = false;
    assert.deepEqual(await batch.run([]), { complete: true });
    assert.equal(downloads.length, 1);
});

test('all seven selections request exactly one file with the original draft-save rules', async () => {
    for (let mask = 1; mask < 8; mask++) {
        const selected = files.filter((_, i) => mask & (1 << i));
        let saves = 0;
        const { delivery, downloads } = setup();
        const batch = createExportBatch({
            prepare: () => selected, start: value => delivery.start(value),
            save: async () => { saves++; return true; }
        });
        const pending = batch.run(selected.map(file => file.type));
        assert.equal(downloads.length, 1); // Stays in the initiating click, without folder permission.
        assert.equal(downloads[0].length, 1);
        // Raw-only finishes synchronously because it intentionally has no draft save.
        assert.equal(batch.busy, mask !== 4);
        if (mask !== 4) assert.equal(await batch.run(selected.map(file => file.type)), null);
        assert.deepEqual(await pending, { complete: true });
        assert.equal(saves, mask === 4 ? 0 : 1);
        assert.ok(downloads[0][0].filename.endsWith(selected.length > 1 ? '.zip' : '.png'));
    }
});
