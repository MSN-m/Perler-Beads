import test from 'node:test';
import assert from 'node:assert/strict';
import { createMiniToolStore } from '../src/platform/minitool/storage.js';
import { createNativeOutput } from '../src/platform/minitool/output.js';

function nativeStore(version = 9533001) {
    const data = new Map();
    let failure = null;
    const events = [];
    const api = {
        async getStorage({ key }) { events.push(['get', key]); if (failure?.('get', key)) throw new Error('read failed'); return { errMsg: 'getStorage:ok', data: data.get(key) ?? null }; },
        async setStorage({ key, data: value }) { events.push(['set', key]); if (failure?.('set', key)) throw new Error('write failed'); assert.ok(new Blob([value]).size < 1024 * 1024); data.set(key, value); return { errMsg: 'setStorage:ok' }; },
        async getStorageInfo() { return { errMsg: 'getStorageInfo:ok', keys: [...data.keys()], usedBytes: [...data.values()].reduce((sum, v) => sum + new Blob([v]).size, 0), limitBytes: 10 * 1024 * 1024 }; },
        async removeStorage({ key }) { events.push(['remove', key]); data.delete(key); return { errMsg: 'removeStorage:ok' }; }
    };
    const store = createMiniToolStore(() => ({ launchOptions: { miniToolEnv: { buildVersion: version } }, miniTool: api }));
    return { store, api, data, events, fail(fn) { failure = fn; } };
}

test('native drafts round-trip large Unicode and source images without exceeding a single-key quota', async () => {
    const { store } = nativeStore();
    const draft = { id: 'large', name: '测试😀', sourceImageDataUrl: 'data:image/png;base64,' + 'A'.repeat(150000), versions: [{ id: 'v1' }], pixelData: [{ id: 'A1' }] };
    await store.put(draft);
    assert.deepEqual(await store.list(), [draft]);
});

test('a failed new chunk keeps the previous saved draft and cleans only the failed generation', async () => {
    const ctx = nativeStore();
    await ctx.store.put({ id: 'd1', value: 'old' });
    const old = new Map(ctx.data);
    ctx.fail((method, key) => method === 'set' && key.startsWith('perler.v1.chunk.'));
    await assert.rejects(ctx.store.put({ id: 'd1', value: 'new' }), /write failed/);
    assert.deepEqual(ctx.data, old);
    ctx.fail(null);
    assert.deepEqual(await ctx.store.list(), [{ id: 'd1', value: 'old' }]);
});

test('pointer commit failure preserves previous chunks and pointer; no false success', async () => {
    const ctx = nativeStore();
    await ctx.store.put({ id: 'd1', value: 'old' });
    const before = ctx.data.get('perler.v1.draft.d1');
    ctx.fail((method, key) => method === 'set' && key.startsWith('perler.v1.draft.'));
    await assert.rejects(ctx.store.put({ id: 'd1', value: 'new' }), /write failed/);
    assert.equal(ctx.data.get('perler.v1.draft.d1'), before);
    ctx.fail(null);
    assert.deepEqual(await ctx.store.list(), [{ id: 'd1', value: 'old' }]);
});

test('missing chunk is a read error rather than an empty library', async () => {
    const ctx = nativeStore();
    await ctx.store.put({ id: 'd1', value: 'old' });
    ctx.data.delete(JSON.parse(ctx.data.get('perler.v1.draft.d1')).chunks[0]);
    await assert.rejects(ctx.store.list(), /分片缺失/);
});

test('storage quota failure leaves existing data untouched', async () => {
    const ctx = nativeStore();
    await ctx.store.put({ id: 'd1', value: 'old' });
    const before = new Map(ctx.data);
    ctx.api.getStorageInfo = async () => ({ errMsg: 'getStorageInfo:ok', keys: [...ctx.data.keys()], usedBytes: 999, limitBytes: 1000 });
    await assert.rejects(ctx.store.put({ id: 'd1', value: 'new' }), /空间不足/);
    assert.deepEqual(ctx.data, before);
});

test('unsupported or unknown client version never writes to native or browser storage', async () => {
    for (const version of [0, 9459001]) {
        const ctx = nativeStore(version);
        await assert.rejects(ctx.store.put({ id: 'd1' }), /9.46/);
        assert.equal(ctx.data.size, 0);
    }
});

test('native recent colors and submission metadata do not become draft records', async () => {
    const ctx = nativeStore();
    await ctx.store.setColorSelections({ p: { recentColorIds: ['A1'] } });
    await ctx.store.markSubmitted('d1', 'v1');
    assert.deepEqual(ctx.store.getColorSelections(), { p: { recentColorIds: ['A1'] } });
    assert.deepEqual(await ctx.store.list(), []);
});

test('deleting one draft leaves other drafts and their chunks intact', async () => {
    const ctx = nativeStore();
    await ctx.store.put({ id: 'a', value: 1 });
    await ctx.store.put({ id: 'b', value: 2 });
    await ctx.store.remove('a');
    assert.deepEqual(await ctx.store.list(), [{ id: 'b', value: 2 }]);
});

function outputSetup({ save = true } = {}) {
    const events = [];
    let albumCalls = 0, albumFailAt = 0, cancel = false;
    const identity = { patternId: 'p1', signature: 's1', draftId: 'd1', versionId: 'v1', title: 'test' };
    const batch = createNativeOutput({
        async save() { events.push('save'); return save; },
        prepare(types) { events.push(['prepare', types]); return types.map(type => ({ href: type })); },
        current: () => ({ ...identity }),
        native: () => ({
            async writeTempFile({ data }) { events.push(['temp', data]); return { errMsg: 'writeTempFile:ok', filePath: 'tmp://' + data }; },
            async saveImageToPhotosAlbum({ filePath }) { albumCalls++; events.push(['album', filePath]); if (albumCalls === albumFailAt) throw new Error('permission'); return { errMsg: 'saveImageToPhotosAlbum:ok' }; },
            async postNote(payload) { events.push(['post', payload]); if (cancel) throw { errMsg: 'postNote:fail cancel' }; return { errMsg: 'postNote:ok' }; }
        }),
        async markSubmitted(id, version) { events.push(['submitted', id, version]); }
    });
    return { batch, events, identity, failAlbumAt(value) { albumFailAt = value; }, cancel(value) { cancel = value; } };
}

test('all seven image combinations save first, including unannotated-only output', async () => {
    for (let mask = 1; mask < 8; mask++) {
        const ctx = outputSetup();
        const types = ['pattern', 'mirrored', 'raw'].filter((_, i) => mask & (1 << i));
        await ctx.batch.run('album', types);
        assert.equal(ctx.events[0], 'save');
        assert.deepEqual(ctx.events[1], ['prepare', types]);
        assert.equal(ctx.events.filter(event => event[0] === 'album').length, types.length);
    }
});

test('save failure prevents rendering, album and publishing', async () => {
    const ctx = outputSetup({ save: false });
    await assert.rejects(ctx.batch.run('post', ['pattern']), /草稿保存失败/);
    assert.deepEqual(ctx.events, ['save']);
});

test('partial album failure retries only remaining images and saves the draft once', async () => {
    const ctx = outputSetup();
    ctx.failAlbumAt(2);
    await assert.rejects(ctx.batch.run('album', ['pattern', 'mirrored', 'raw']), /已保存1张/);
    ctx.failAlbumAt(0);
    await ctx.batch.run('album', ['pattern', 'mirrored', 'raw']);
    assert.equal(ctx.events.filter(event => event === 'save').length, 1);
    assert.equal(ctx.events.filter(event => event[0] === 'album' && event[1] === 'tmp://pattern').length, 1);
    assert.equal(ctx.events.filter(event => event[0] === 'album' && event[1] === 'tmp://raw').length, 1);
    await ctx.batch.run('album', ['pattern']);
    assert.equal(ctx.events.filter(event => event[0] === 'album').length, 4);
});

test('cancelled publishing preserves saved draft and never marks a submitted version', async () => {
    const ctx = outputSetup();
    ctx.cancel(true);
    await assert.rejects(ctx.batch.run('post', ['pattern']), /未完成发布，草稿已保留/);
    assert.equal(ctx.events.filter(event => event === 'save').length, 1);
    assert.equal(ctx.events.filter(event => event[0] === 'submitted').length, 0);
});

test('post uses all images in one note and marks the saved version only after a successful receipt', async () => {
    const ctx = outputSetup();
    await ctx.batch.run('post', ['pattern', 'raw']);
    const post = ctx.events.find(event => event[0] === 'post')[1];
    assert.deepEqual(post.mediaInfo.image_resources, [{ url: 'tmp://pattern' }, { url: 'tmp://raw' }]);
    assert.deepEqual(ctx.events[ctx.events.length - 1], ['submitted', 'd1', 'v1']);
    await ctx.batch.run('post', ['pattern', 'raw']);
    assert.equal(ctx.events.filter(event => event[0] === 'post').length, 1);
});

test('double submission is ignored and changed document cannot use a stale output batch', async () => {
    const ctx = outputSetup();
    const first = ctx.batch.run('album', ['pattern']);
    assert.equal(await ctx.batch.run('post', ['pattern']), null);
    await first;
    ctx.identity.patternId = 'p2';
    await assert.rejects(ctx.batch.run('post', ['pattern']), /图纸已变化/);
});
