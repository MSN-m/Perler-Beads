import { AppState } from '../state.js';
import { EXPORT_TYPES, downloadImage, preparePatternExports, startPatternDownloads } from '../exporter.js';
import { createExportDelivery } from './export-files.js';

/** One export batch, one save at most. Raw-only retains the existing download-only rule. */
export function createExportBatch(actions) {
    let busy = false;
    let savePending = false;
    let pendingFiles = null;
    let needsSave = false;
    return {
        get busy() { return busy; },
        get savePending() { return savePending; },
        get filesPending() { return !!pendingFiles; },
        reset() { if (!busy) { savePending = false; pendingFiles = null; needsSave = false; actions.reset?.(); } },
        async run(types) {
            const selected = EXPORT_TYPES.filter(type => types.includes(type));
            if (busy || (!savePending && !pendingFiles && !selected.length)) return null;
            busy = true;
            try {
                if (!savePending && !pendingFiles) {
                    // All renders/encodings finish before requesting the first download.
                    pendingFiles = actions.prepare(selected);
                    needsSave = selected.some(type => type !== 'raw');
                }
                if (pendingFiles) {
                    const started = actions.start(pendingFiles);
                    if (started?.then) await started;
                    pendingFiles = null;
                    savePending = needsSave;
                }
                if (savePending) {
                    if (!await actions.save()) return { complete: false };
                    savePending = false;
                }
                return { complete: true };
            } finally { busy = false; }
        }
    };
}

export function createWorkbenchExportModal({ saveDraft, returnHome }) {
    const overlay = document.getElementById('workbench-export-modal');
    if (!overlay) return { open: () => false };
    const choice = document.getElementById('export-choice-dialog');
    const enlarged = document.getElementById('export-preview-dialog');
    const result = document.getElementById('export-result-dialog');
    const submit = document.getElementById('export-selected-btn');
    const error = document.getElementById('export-dialog-error');
    const preview = document.getElementById('export-dialog-preview-image');
    const options = [...overlay.querySelectorAll('[data-export-type]')];
    const selection = new Set(EXPORT_TYPES);
    let previousFocus = null;
    let inertElements = [];
    let pixels = null;
    let patternId = null;
    const delivery = createExportDelivery({
        download: startPatternDownloads
    });
    const batch = createExportBatch({
        reset: () => delivery.reset(),
        prepare: types => {
            if (patternId !== AppState.colorSelectionPatternId) throw new Error('图纸已切换，请重新打开导出弹窗');
            return preparePatternExports(types, pixels);
        },
        start: files => {
            if (patternId !== AppState.colorSelectionPatternId) throw new Error('图纸已切换，请重新打开导出弹窗');
            return delivery.start(files);
        },
        save: () => patternId === AppState.colorSelectionPatternId && saveDraft({ inlineError: true })
    });

    const visiblePanel = () => !enlarged.hidden ? enlarged : !result.hidden ? result : choice;
    const showPanel = panel => {
        [choice, enlarged, result].forEach(item => { item.hidden = item !== panel; });
        panel.focus();
    };
    const showError = message => {
        error.textContent = message;
        error.hidden = !message;
    };
    const updateSelection = () => {
        options.forEach(button => {
            button.setAttribute('aria-pressed', String(selection.has(button.dataset.exportType)));
            button.disabled = batch.busy || batch.savePending || batch.filesPending;
        });
        submit.disabled = batch.busy || (!batch.savePending && !batch.filesPending && selection.size === 0);
        submit.textContent = batch.busy ? '处理中…' : batch.savePending ? '重试保存草稿' : batch.filesPending ? '重试导出' : `导出${selection.size}张图纸`;
        submit.title = selection.size > 1 ? '下载一个ZIP压缩包，解压后查看所选图片' : '直接下载一张PNG图片';
        overlay.dataset.exportSaveMode = selection.size > 1 ? 'zip' : 'png';
        overlay.querySelectorAll('[data-export-close]').forEach(button => { button.disabled = batch.busy; });
        document.getElementById('export-preview-enlarge').disabled = batch.busy;
    };
    const close = () => {
        if (batch.busy) return false;
        overlay.hidden = true;
        inertElements.forEach(([element, original]) => { element.inert = original; });
        inertElements = [];
        pixels = null;
        preview.removeAttribute('src');
        document.getElementById('export-dialog-large-image').removeAttribute('src');
        batch.reset();
        if (previousFocus?.isConnected) previousFocus.focus();
        return true;
    };
    const open = () => {
        if (!overlay.hidden) return false;
        if (AppState.currentStep !== 3 || AppState.draftRestorePending || AppState.paintStroke || AppState.eraserStroke || AppState.zoomState.isDragging) return false;
        const source = AppState.stagedPixelData || AppState.pixelData;
        if (!source?.some(pixel => pixel && pixel.id !== 'NONE')) return false;
        previousFocus = document.activeElement;
        pixels = source.map(pixel => ({ ...pixel }));
        patternId = AppState.colorSelectionPatternId;
        selection.clear();
        EXPORT_TYPES.forEach(type => selection.add(type));
        batch.reset();
        showError('');
        // The preview always depicts the current-direction annotated diagram, not selections.
        const canvas = downloadImage({ renderOnly: true, pixelData: pixels });
        preview.src = canvas.toDataURL('image/png');
        const beads = pixels.filter(pixel => pixel.id !== 'NONE');
        document.getElementById('export-dialog-name').textContent = String(AppState.patternName || '').trim() || '未命名图纸';
        const brand = AppState.brand.toUpperCase() + (AppState.brand === 'mard' ? ` ${AppState.mardSet}色` : '');
        document.getElementById('export-dialog-spec').textContent = `${AppState.gridWidth}x${AppState.gridHeight}·${brand}`;
        document.getElementById('export-dialog-stats').textContent = `共${new Set(beads.map(pixel => pixel.id)).size}种颜色，${beads.length}颗豆子`;
        inertElements = [...document.body.children].filter(element => element !== overlay && element instanceof HTMLElement).map(element => [element, element.inert]);
        inertElements.forEach(([element]) => { element.inert = true; });
        overlay.hidden = false;
        updateSelection();
        showPanel(choice);
        return true;
    };
    options.forEach(button => button.addEventListener('click', () => {
        if (batch.busy || batch.savePending || batch.filesPending) return;
        const type = button.dataset.exportType;
        if (selection.has(type)) selection.delete(type);
        else selection.add(type);
        updateSelection();
    }));
    overlay.querySelectorAll('[data-export-close]').forEach(button => button.addEventListener('click', close));
    overlay.addEventListener('click', event => {
        if (event.target !== overlay || batch.busy) return;
        if (!enlarged.hidden) showPanel(choice);
        else close();
    });
    document.getElementById('export-preview-enlarge').addEventListener('click', () => {
        if (batch.busy) return;
        document.getElementById('export-dialog-large-image').src = preview.src;
        showPanel(enlarged);
    });
    document.getElementById('export-preview-shrink').addEventListener('click', () => {
        showPanel(choice);
        document.getElementById('export-preview-enlarge').focus();
    });
    submit.addEventListener('click', async () => {
        if (batch.busy || (!batch.savePending && !batch.filesPending && !selection.size)) return;
        showError('');
        try {
            const pending = batch.run([...selection]);
            updateSelection();
            const outcome = await pending;
            if (outcome?.complete) {
                document.getElementById('export-result-title').textContent = '已发起下载';
                document.getElementById('export-result-description').textContent = delivery.mode === 'zip'
                    ? `ZIP内含${selection.size}张图片，请确认下载结果并解压查看。` : '请确认浏览器下载结果。';
                showPanel(result);
            } else if (outcome) showError('草稿保存失败，请重试保存草稿。图片不会重复导出。');
        } catch (failure) {
            console.warn('Export dialog failed.', failure);
            showError(batch.savePending ? '草稿保存失败，请重试保存草稿。图片不会重复导出。'
                : '导出未完成，请重试。当前图纸仍然保留。');
        } finally { updateSelection(); }
    });
    document.getElementById('export-return-home').addEventListener('click', async () => {
        if (close()) await returnHome();
    });
    // Capture before editor shortcuts: Esc only closes this layer, never changes tools.
    document.addEventListener('keydown', event => {
        if (overlay.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (batch.busy) return;
            if (!enlarged.hidden) showPanel(choice);
            else close();
        } else if (event.key === 'Tab') {
            const controls = [...visiblePanel().querySelectorAll('button:not(:disabled)')];
            if (!controls.length) { event.preventDefault(); return; }
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
    }, true);
    window.addEventListener('resize', () => {
        if (window.innerWidth < 1024 && !overlay.hidden && !batch.busy) close();
    });
    return { open, close };
}
