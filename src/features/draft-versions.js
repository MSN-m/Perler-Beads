/** Compact saved versions. Images are shared; editing undo history stays separate. */
export const DRAFT_VERSION_LIMIT = 5;
const clone = value => JSON.parse(JSON.stringify(value));
const fields = ['name', 'patternName', 'gridWidth', 'gridHeight', 'brand', 'mardSet', 'colorCount', 'isMirrored', 'colorSelection', 'cropRect', 'generationSettings'];
export function packDraftVersion(draft) {
    const colors = [], indices = [], known = new Map();
    for (const p of draft.pixelData) {
        const tuple = [p.id, p.r, p.g, p.b, p.a ?? null];
        const key = JSON.stringify(tuple);
        if (!known.has(key)) { known.set(key, colors.length); colors.push(tuple); }
        indices.push(known.get(key));
    }
    const version = { id: `version_${Date.now()}_${Math.random().toString(36).slice(2)}`, savedAt: draft.updatedAt, colors, indices };
    for (const field of fields) if (draft[field] !== undefined) version[field] = clone(draft[field]);
    return version;
}
export function unpackDraftVersion(draft, version) {
    if (!version || !Array.isArray(version.colors) || !Array.isArray(version.indices)) throw new Error('版本数据不完整');
    const result = { id: draft.id, updatedAt: version.savedAt };
    for (const field of fields) if (version[field] !== undefined) result[field] = clone(version[field]);
    if (!Number.isInteger(result.gridWidth) || !Number.isInteger(result.gridHeight) || result.gridWidth < 1 || result.gridHeight < 1
        || version.indices.length !== result.gridWidth * result.gridHeight) throw new Error('版本尺寸不完整');
    result.pixelData = version.indices.map(index => {
        if (!Number.isInteger(index) || !Array.isArray(version.colors[index])) throw new Error('版本颜色不完整');
        const [id, r, g, b, a] = version.colors[index];
        return { id, r, g, b, ...(a == null ? {} : { a }) };
    });
    result.sourceImageDataUrl = version.sourceRef === 'current' ? draft.sourceImageDataUrl || null
        : version.sourceRef ? draft.versionSources?.[version.sourceRef] || null : null;
    return result;
}
function comparable(version) {
    const value = clone(version); delete value.id; delete value.savedAt; delete value.sourceRef;
    if (value.colorSelection) delete value.colorSelection.updatedAt;
    return JSON.stringify(value);
}
export function buildDraftWithVersions(next, previous = null) {
    let past = [];
    if (previous) {
        if (Array.isArray(previous.versions) && previous.versions.length) {
            past = previous.versions.map(version => ({ version, source: unpackDraftVersion(previous, version).sourceImageDataUrl }));
        } else {
            past = [{ version: packDraftVersion(previous), source: previous.sourceImageDataUrl || null }];
        }
    }
    const newest = packDraftVersion(next);
    const changed = !past.length || comparable(past[0].version) !== comparable(newest) || past[0].source !== (next.sourceImageDataUrl || null);
    if (changed) {
        past.unshift({ version: newest, source: next.sourceImageDataUrl || null });
    }
    const versionSources = {}, known = new Map();
    const versions = past.slice(0, changed ? DRAFT_VERSION_LIMIT : past.length).map(({ version, source }) => {
        let sourceRef = null;
        if (source === (next.sourceImageDataUrl || null) && source) sourceRef = 'current';
        else if (source) {
            if (!known.has(source)) { const key = `source_${known.size + 1}`; known.set(source, key); versionSources[key] = source; }
            sourceRef = known.get(source);
        }
        return { ...version, sourceRef };
    });
    return { ...next, schemaVersion: 2, versions, versionSources };
}
