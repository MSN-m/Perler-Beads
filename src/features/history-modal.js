import { AppState } from '../state.js';
import { unpackDraftVersion } from './draft-versions.js';

/** The editor owns one document; the home drawer remains the document library. */
export function getCurrentPatternHistory(state = AppState) {
    const draft = (state.drafts || []).find(item => item.id === state.currentDraftId) || null;
    const versions = draft ? (draft.versions?.length ? draft.versions.map((version, index) => {
        try { return { key: version.id, versionId: version.id, latest: index === 0, data: unpackDraftVersion(draft, version) }; }
        catch { return { key: version.id, versionId: version.id, latest: index === 0, data: null }; }
    }) : [{ key: 'legacy', versionId: null, latest: true, data: draft }]) : [];
    const automatic = (state.autoSaves || []).filter(record => state.currentDraftId
        ? record.baseDraftId === state.currentDraftId
        : !record.baseDraftId && record.sourcePatternId === state.colorSelectionPatternId)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null;
    return { draft, versions, automatic };
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const timestamp = value => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '时间未知';
    const pad = number => String(number).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Derive small previews from saved pixels, never persist extra images per version.
function renderPixels(data, large = false) {
    const canvas = document.createElement('canvas');
    const cell = large ? Math.min(30, Math.max(1, Math.floor(1600 / Math.max(data.gridWidth, data.gridHeight))))
        : Math.max(1, Math.floor(96 / Math.max(data.gridWidth, data.gridHeight)));
    canvas.width = data.gridWidth * cell;
    canvas.height = data.gridHeight * cell;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    data.pixelData.forEach((pixel, index) => {
        if (!pixel || pixel.id === 'NONE') return;
        context.fillStyle = `rgb(${pixel.r},${pixel.g},${pixel.b})`;
        context.fillRect(index % data.gridWidth * cell, Math.floor(index / data.gridWidth) * cell, cell, cell);
    });
    return canvas.toDataURL('image/png');
}

let controller = null;
export function renderWorkbenchHistory() { controller?.sync(); }

export function installWorkbenchHistory({ updateUI, restore }) {
    const overlay = document.getElementById('workbench-history-modal');
    if (!overlay) return;
    const panel = document.getElementById('history-main-dialog');
    const preview = document.getElementById('history-preview-dialog');
    const confirmation = document.getElementById('history-confirm-dialog');
    const list = document.getElementById('history-version-list');
    const automaticBox = document.getElementById('history-automatic-record');
    const error = document.getElementById('history-error');
    let openedPatternId = null;
    let previousFocus = null;
    let returnFocus = null;
    let inertElements = [];
    let renderedKey = null;
    let current = null;
    let pending = null;
    let busy = false;
    const show = target => {
        [panel, preview, confirmation].forEach(element => { element.hidden = element !== target; });
        target.focus();
    };
    const release = () => {
        overlay.hidden = true;
        inertElements.forEach(([element, original]) => { element.inert = original; });
        inertElements = [];
        pending = null;
        renderedKey = null;
        document.getElementById('history-preview-image').removeAttribute('src');
        if (previousFocus?.isConnected) previousFocus.focus();
    };
    const close = () => {
        if (busy) return;
        AppState.draftDrawerOpen = false;
        release();
        updateUI();
    };
    const returnToList = () => {
        if (busy) return;
        pending = null;
        show(panel);
        document.getElementById('history-preview-image').removeAttribute('src');
        if (returnFocus?.isConnected) returnFocus.focus();
    };
    const sync = () => {
        const editing = AppState.currentStep === 3 && AppState.pixelData?.length > 0;
        if (!editing || !AppState.draftDrawerOpen) {
            if (!overlay.hidden) release();
            return;
        }
        if (!overlay.hidden && openedPatternId !== AppState.colorSelectionPatternId) { close(); return; }
        current = getCurrentPatternHistory();
        const key = JSON.stringify([AppState.colorSelectionPatternId, AppState.patternName, current.draft, current.automatic, AppState.autoSaveError]);
        if (key !== renderedKey) {
            list.innerHTML = current.versions.length ? current.versions.map((entry, index) => {
                const data = entry.data;
                if (!data) return '<div class="history-empty" role="status">此保存版本数据不完整，无法恢复。</div>';
                let href = '';
                try { href = renderPixels(data); } catch { /* Text and restore remain available if preview encoding fails. */ }
                const brand = String(data.brand || 'mard').toUpperCase() + (data.brand === 'mard' ? ` ${data.mardSet || 221}` : '');
                const colorCount = new Set(data.pixelData.filter(pixel => pixel.id !== 'NONE').map(pixel => pixel.id)).size;
                return `<div class="history-version-row"><button type="button" class="history-thumbnail" data-history-preview="${index}" aria-label="放大查看 ${escape(timestamp(data.updatedAt))} 保存版本" ${href ? '' : 'disabled'}>${href ? `<img class="history-pixel-image" src="${href}" alt="保存版本图纸">` : '<span>无预览</span>'}<span class="history-expand"><img src="assets/figma-ui/history-expand.svg" alt=""></span></button><div class="history-version-info"><div class="history-version-time"><time>${escape(timestamp(data.updatedAt))}</time>${entry.latest ? '<span class="history-latest">最新保存</span>' : ''}</div><p>${data.gridWidth}x${data.gridHeight}·${escape(brand)}·${colorCount}色</p></div><button type="button" class="history-restore" data-history-restore="${index}" aria-label="恢复 ${escape(timestamp(data.updatedAt))} 保存版本"><span class="history-restore-icon"><img src="assets/figma-ui/history-restore.svg" alt=""><img class="history-hover-icon" src="assets/figma-ui/history-restore-hover.svg" alt=""></span>恢复</button></div>`;
            }).join('') : '<p class="history-empty">暂无保存版本，保存草稿后会显示在这里。</p>';
            automaticBox.innerHTML = current.automatic
                ? `<time>${escape(timestamp(current.automatic.updatedAt))}</time><button type="button" data-history-automatic>恢复</button>`
                : '<span class="history-empty">暂无自动恢复记录</span>';
            error.textContent = AppState.autoSaveError ? '自动保存失败，请手动保存草稿。' : '';
            error.hidden = !AppState.autoSaveError;
            renderedKey = key;
        }
        if (overlay.hidden) {
            openedPatternId = AppState.colorSelectionPatternId;
            previousFocus = document.activeElement;
            inertElements = [...document.body.children].filter(element => element !== overlay && element instanceof HTMLElement).map(element => [element, element.inert]);
            inertElements.forEach(([element]) => { element.inert = true; });
            overlay.hidden = false;
            show(panel);
        }
    };
    const askRestore = (target, focus) => {
        if (busy) return;
        pending = target;
        returnFocus = focus;
        document.getElementById('history-confirm-title').textContent = target.automatic ? '恢复自动保存的进度？' : '恢复此保存版本？';
        document.getElementById('history-confirm-description').textContent = '当前未保存修改将被替换，已保存的版本仍会保留。';
        show(confirmation);
        document.getElementById('history-confirm-cancel').focus();
    };
    list.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || busy || button.disabled) return;
        if (button.dataset.historyRestore !== undefined) {
            const entry = current.versions[Number(button.dataset.historyRestore)];
            if (entry?.data) askRestore({ draftId: current.draft.id, versionId: entry.versionId, automatic: false }, button);
        } else if (button.dataset.historyPreview !== undefined) {
            const entry = current.versions[Number(button.dataset.historyPreview)];
            if (!entry?.data) return;
            try {
                document.getElementById('history-preview-image').src = renderPixels(entry.data, true);
                document.getElementById('history-preview-caption').textContent = `${timestamp(entry.data.updatedAt)} · ${entry.data.gridWidth}x${entry.data.gridHeight}`;
                returnFocus = button;
                show(preview);
            } catch { error.hidden = false; error.textContent = '暂时无法生成大图预览，保存版本仍然保留。'; }
        }
    });
    automaticBox.addEventListener('click', event => {
        const button = event.target.closest('[data-history-automatic]');
        if (button && current.automatic) askRestore({ draftId: current.automatic.id, versionId: null, automatic: true }, button);
    });
    document.getElementById('history-confirm-restore').addEventListener('click', () => {
        if (busy || !pending) return;
        // Validate the document and record again after the user confirms.
        const latest = getCurrentPatternHistory();
        const valid = openedPatternId === AppState.colorSelectionPatternId && (pending.automatic
            ? latest.automatic?.id === pending.draftId
            : latest.draft?.id === pending.draftId && latest.versions.some(entry => entry.versionId === pending.versionId && entry.data));
        if (!valid) { close(); return; }
        busy = true;
        try {
            const restored = restore(pending.draftId, pending.versionId, pending.automatic, { confirmed: true });
            if (restored === false) {
                returnToListAfterFailure();
            } else {
                AppState.draftDrawerOpen = false;
                release();
                updateUI();
            }
        } catch {
            returnToListAfterFailure();
        } finally { busy = false; }
    });
    function returnToListAfterFailure() {
        pending = null;
        show(panel);
        error.hidden = false;
        error.textContent = '暂时无法恢复，请稍后重试。当前图纸仍然保留。';
    }
    overlay.querySelectorAll('[data-history-close]').forEach(button => button.addEventListener('click', close));
    overlay.querySelectorAll('[data-history-back]').forEach(button => button.addEventListener('click', returnToList));
    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            if (!confirmation.hidden || !preview.hidden) returnToList();
            else close();
        }
    });
    document.addEventListener('keydown', event => {
        if (overlay.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopImmediatePropagation();
            if (!confirmation.hidden || !preview.hidden) returnToList();
            else close();
        } else if (event.key === 'Tab') {
            const active = !confirmation.hidden ? confirmation : !preview.hidden ? preview : panel;
            const controls = [...active.querySelectorAll('button:not(:disabled)')];
            const first = controls[0], last = controls.at(-1);
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
    }, true);
    controller = { sync };
    sync();
}
