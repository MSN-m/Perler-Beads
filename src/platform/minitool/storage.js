// Native storage only. Each draft is committed by changing one small pointer.
// New immutable chunks are written first; a failed save leaves the old pointer intact.
export function createMiniToolStore(getXhs = () => window.xhs) {
    const prefix = 'perler.v1.';
    const pointerPrefix = prefix + 'draft.';
    const chunkPrefix = prefix + 'chunk.';
    let native = null;
    let clientVersion = 0;
    let ready;
    let queue = Promise.resolve();
    let colors = {};
    let error = '';
    const previousParts = new Map();
    const call = async (name, options) => {
        if (!native || typeof native[name] !== 'function') throw new Error('当前小红书暂不支持草稿存储，请升级客户端后重试。');
        const result = await native[name](options || {});
        if (!result || result.errMsg !== name + ':ok') throw new Error('草稿存储未完成：' + name);
        return result;
    };
    const initialize = () => ready || (ready = (async () => {
        try {
            const xhs = getXhs();
            native = xhs && xhs.miniTool;
            let options = xhs && xhs.launchOptions;
            if (!(options && options.miniToolEnv && options.miniToolEnv.buildVersion) && native && typeof native.getLaunchOptions === 'function') {
                options = await native.getLaunchOptions();
            }
            clientVersion = Math.floor(Number(options && options.miniToolEnv && options.miniToolEnv.buildVersion || 0) / 1000);
            if (clientVersion < 9460) throw new Error('保存草稿需要小红书 9.46 或以上版本。');
            for (const method of ['setStorage', 'getStorage', 'getStorageInfo', 'removeStorage']) {
                if (!native || typeof native[method] !== 'function') throw new Error('当前环境暂不支持草稿存储。');
            }
            const result = await call('getStorage', { key: prefix + 'colors' });
            if (result.data !== null && result.data !== undefined && result.data !== '') {
                const value = JSON.parse(result.data);
                if (value && typeof value === 'object' && !Array.isArray(value)) colors = value;
            }
            return true;
        } catch (failure) {
            error = failure.message || failure.errMsg || '暂时无法读取草稿，请重试。';
            return false;
        }
    })().then(result => { if (!result) ready = null; return result; }));
    const requireReady = async () => { if (!await initialize()) throw new Error(error); };
    const serial = operation => {
        const pending = queue.then(operation);
        queue = pending.catch(() => {});
        return pending;
    };
    const read = async key => {
        const result = await call('getStorage', { key });
        return result.data === null || result.data === undefined || result.data === '' ? null : JSON.parse(result.data);
    };
    const write = (key, value) => call('setStorage', { key, data: JSON.stringify(value) });
    const checksum = text => {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
        return (hash >>> 0).toString(16);
    };
    const validatePointer = pointer => {
        if (!pointer || !Array.isArray(pointer.chunks) || !pointer.chunks.length || pointer.chunks.some(key => typeof key !== 'string' || key.indexOf(chunkPrefix) !== 0)) {
            throw new Error('草稿记录不完整，请保留数据后重试。');
        }
    };
    const clean = async (pointer, keep = []) => {
        if (!pointer) return;
        validatePointer(pointer);
        for (const key of pointer.chunks) {
            if (keep.includes(key)) continue;
            try { await call('removeStorage', { key }); }
            catch (failure) { console.warn('旧草稿分片暂未清理。', failure); }
        }
    };
    return {
        initialize,
        get clientVersion() { return clientVersion; },
        get error() { return error; },
        getColorSelections() { return colors; },
        setColorSelections(value) {
            colors = value;
            return serial(async () => { await requireReady(); await write(prefix + 'colors', value); });
        },
        async list() {
            await requireReady();
            await queue;
            const info = await call('getStorageInfo');
            if (!Array.isArray(info.keys)) throw new Error('无法读取草稿目录。');
            const drafts = [];
            for (const key of info.keys.filter(key => key.indexOf(pointerPrefix) === 0)) {
                const pointer = await read(key);
                // A concurrent deletion can remove a listed pointer. Other read failures are errors.
                if (!pointer) continue;
                validatePointer(pointer);
                const parts = [];
                for (const part of pointer.chunks) {
                    const text = await read(part);
                    if (typeof text !== 'string') throw new Error('草稿分片缺失，未将读取失败视为空草稿。');
                    parts.push(text);
                }
                const serialized = parts.join('');
                if (serialized.length !== pointer.length || checksum(serialized) !== pointer.checksum) throw new Error('草稿数据校验失败。');
                const draft = JSON.parse(serialized);
                if (pointer.id !== draft.id) throw new Error('草稿身份不匹配。');
                drafts.push(draft);
            }
            return drafts;
        },
        put(draft) {
            return serial(async () => {
                await requireReady();
                if (!draft || typeof draft.id !== 'string' || !draft.id) throw new Error('草稿身份缺失。');
                const key = pointerPrefix + encodeURIComponent(draft.id);
                const old = await read(key);
                if (old) validatePointer(old);
                const text = JSON.stringify(draft);
                const textChecksum = checksum(text);
                const revision = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
                const chunks = [], parts = [], fresh = [];
                // Isolate the unchanged source value: edits before it cannot shift its chunk boundaries.
                const marker = '"sourceImageDataUrl":';
                const start = typeof draft.sourceImageDataUrl === 'string' ? text.indexOf(marker) + marker.length : 0;
                const source = start ? JSON.stringify(draft.sourceImageDataUrl) : '';
                const segments = start && text.slice(start, start + source.length) === source
                    ? [text.slice(0, start), source, text.slice(start + source.length)] : [text];
                segments.forEach(segment => {
                    for (let i = 0; i < segment.length; i += 65536) parts.push(segment.slice(i, i + 65536));
                });
                const reusable = new Map();
                const cached = previousParts.get(draft.id);
                if (old) {
                    const prior = cached && cached.checksum === old.checksum ? cached.parts
                        : await Promise.all(old.chunks.map(part => read(part)));
                    prior.forEach((part, i) => { if (typeof part === 'string') reusable.set(part, old.chunks[i]); });
                }
                parts.forEach((part, i) => {
                    const reused = reusable.get(part);
                    const chunk = reused || chunkPrefix + encodeURIComponent(draft.id) + '.' + revision + '.' + i;
                    chunks.push(chunk);
                    if (!reused) fresh.push({ key: chunk, part });
                });
                const info = await call('getStorageInfo');
                const needed = fresh.reduce((sum, item) => sum + new Blob([JSON.stringify(item.part)]).size, 0) + 16384;
                if (Number.isFinite(info.limitBytes) && Number.isFinite(info.usedBytes) && info.usedBytes + needed > info.limitBytes) {
                    throw new Error('小工具存储空间不足，请保留当前图纸并清理不需要的草稿后重试。');
                }
                let committing = false;
                try {
                    for (const item of fresh) await write(item.key, item.part);
                    committing = true;
                    await write(key, { id: draft.id, chunks, length: text.length, checksum: textChecksum });
                } catch (failure) {
                    // An ambiguous pointer result must retain both generations; reused old chunks stay intact.
                    if (!committing) await clean({ chunks: fresh.map(item => item.key) });
                    previousParts.delete(draft.id);
                    throw failure;
                }
                // Only autosaves need the warm source cache. Bound it to the current record.
                previousParts.clear();
                if (draft.kind === 'autosave' || draft.kind === 'setup-recovery') previousParts.set(draft.id, { checksum: textChecksum, parts });
                await clean(old, chunks);
            });
        },
        remove(id) {
            return serial(async () => {
                await requireReady();
                const key = pointerPrefix + encodeURIComponent(id);
                const old = await read(key);
                await call('removeStorage', { key });
                await clean(old);
                previousParts.delete(id);
            });
        },
        markSubmitted(draftId, versionId) {
            return serial(async () => {
                await requireReady();
                if (!draftId || !versionId) throw new Error('发布版本缺失。');
                await write(prefix + 'submission.' + encodeURIComponent(draftId) + '.' + encodeURIComponent(versionId), { status: 'submitted', at: new Date().toISOString() });
            });
        }
    };
}

export const miniToolStore = createMiniToolStore();
