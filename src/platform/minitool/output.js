import { AppState } from '../../state.js';
import { preparePatternExports } from '../../exporter.js';
import { miniToolStore } from './storage.js';

export function createPostNoteCopy({ gridWidth, gridHeight, pixelData }) {
    const colors = new Set();
    let beads = 0;
    for (const pixel of pixelData) {
        if (!pixel || pixel.id === 'NONE' || pixel.a === 0) continue;
        colors.add(String(pixel.id));
        beads++;
    }
    return {
        title: '我用小豆鸡做了一张拼豆图纸，准备开拼！',
        content: `图纸做好了，准备把它拼出来\n${gridWidth}×${gridHeight}格，${colors.size}色，共${beads}颗豆。\n从图片到图纸，用小豆鸡就能完成🧩#拼豆 #拼豆图纸 #拼豆图纸生成器 #图片转拼豆 #小豆鸡`
    };
}

// Testable transaction: save first, render once, retry only unfinished album images.
export function createNativeOutput({ save, prepare, native, current, markSubmitted }) {
    let busy = false;
    let files = null;
    let saved = null;
    let completed = 0;
    let albumComplete = false;
    let posted = false;
    let selected = null;
    const invoke = async (api, method, payload, message) => {
        try { return await api[method](payload); }
        catch (failure) { console.warn('Native output did not complete.', method, failure); throw new Error(message); }
    };
    return {
        get busy() { return busy; },
        get locked() { return saved !== null; },
        async run(destination, types) {
            if (busy) return null;
            if (!['album', 'post'].includes(destination) || !types.length) throw new Error('请至少选择一张图片。');
            busy = true;
            try {
                const api = native();
                const method = destination === 'album' ? 'saveImageToPhotosAlbum' : 'postNote';
                if (!api || typeof api[method] !== 'function' || typeof api.writeTempFile !== 'function') throw new Error('当前客户端不支持此操作，请升级小红书后重试。');
                if (!saved) {
                    const identity = current();
                    if (!await save()) throw new Error('草稿保存失败，当前编辑仍保留，请检查存储空间后重试。');
                    saved = current();
                    if (saved.patternId !== identity.patternId || saved.signature !== identity.signature) { saved = null; throw new Error('图纸已变化，请关闭后重新打开。'); }
                    selected = types.slice();
                }
                const now = current();
                if (now.patternId !== saved.patternId || now.signature !== saved.signature) throw new Error('图纸已变化，请关闭后重新打开。');
                if (!files) {
                    try { files = prepare(selected); }
                    catch { throw new Error('图片生成失败，当前图纸和草稿已保留，请重试。'); }
                }
                if (destination === 'album') {
                    if (albumComplete) return { message: '所选图片已保存到相册，草稿已保存。' };
                    for (; completed < files.length; completed++) {
                        const result = await invoke(api, 'writeTempFile', { data: files[completed].href }, '图片准备失败，草稿已保留，请重试。');
                        if (!result || result.errMsg !== 'writeTempFile:ok' || !result.filePath) throw new Error('图片准备失败，请重试。');
                        const outcome = await invoke(api, 'saveImageToPhotosAlbum', { filePath: result.filePath }, '相册保存未完成，请检查相册权限后重试。');
                        if (!outcome || outcome.errMsg !== 'saveImageToPhotosAlbum:ok') throw new Error('图片尚未保存，请检查相册权限后重试。');
                    }
                    albumComplete = true;
                    return { message: '已保存' + files.length + '张图片到相册，草稿已保存。' };
                }
                if (posted) return { message: '已收到发布提交回执，最终审核由小红书处理。' };
                const images = [];
                for (const file of files) {
                    const result = await invoke(api, 'writeTempFile', { data: file.href }, '图片准备失败，草稿已保留，请重试。');
                    if (!result || result.errMsg !== 'writeTempFile:ok' || !result.filePath) throw new Error('图片准备失败，请重试。');
                    images.push({ url: result.filePath });
                }
                const outcome = await invoke(api, 'postNote', { ...saved.postCopy, pageType: 'photo_publish', mediaInfo: { image_resources: images } }, '已取消或未完成发布，草稿已保留。');
                if (!outcome || outcome.errMsg !== 'postNote:ok') return { message: '未收到发布提交回执，草稿已保留。' };
                posted = true;
                try { await markSubmitted(saved.draftId, saved.versionId); }
                catch { return { message: '已收到发布提交回执，但本地状态记录失败；请勿重复发布。草稿已保留。' }; }
                return { message: '已收到发布提交回执，最终审核由小红书处理。' };
            } catch (failure) {
                const reason = failure.message || failure.errMsg || '操作未完成，请重试。';
                throw new Error((completed && !albumComplete ? '已保存' + completed + '张，重试将继续剩余图片。' : '') + reason);
            } finally { busy = false; }
        }
    };
}

export function createWorkbenchExportModal({ saveDraft }) {
    const overlay = document.getElementById('minitool-output');
    const checks = Array.from(overlay.querySelectorAll('input[type=checkbox]'));
    const buttons = Array.from(overlay.querySelectorAll('button'));
    const status = overlay.querySelector('[role=status]');
    const panel = overlay.querySelector('[role=dialog]');
    let batch = null;
    let focus = null;
    let inert = [];
    const current = () => {
        const pixels = AppState.stagedPixelData || AppState.pixelData;
        return {
            patternId: AppState.colorSelectionPatternId,
            signature: JSON.stringify([AppState.patternName, AppState.gridWidth, AppState.gridHeight, AppState.isMirrored, pixels]),
            draftId: AppState.currentDraftId,
            versionId: AppState.currentDraftVersionId,
            postCopy: createPostNoteCopy({ gridWidth: AppState.gridWidth, gridHeight: AppState.gridHeight, pixelData: pixels })
        };
    };
    const update = () => {
        const count = checks.filter(input => input.checked).length;
        checks.forEach(input => { input.disabled = batch.busy || batch.locked; });
        buttons.forEach(button => { button.disabled = batch.busy || (button.dataset.destination && !count); });
        panel.setAttribute('aria-busy', String(batch.busy));
    };
    const close = () => {
        if (!batch || batch.busy) return false;
        overlay.hidden = true;
        inert.forEach(([element, value]) => { element.inert = value; });
        inert = [];
        if (focus && focus.isConnected) focus.focus();
        batch = null;
        return true;
    };
    checks.forEach(input => input.addEventListener('change', update));
    overlay.querySelector('[data-output-close]').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    buttons.filter(button => button.dataset.destination).forEach(button => button.addEventListener('click', async () => {
        if (!batch || batch.busy) return;
        status.textContent = '正在保存草稿和准备图片…';
        try {
            const pending = batch.run(button.dataset.destination, checks.filter(input => input.checked).map(input => input.value));
            update();
            const result = await pending;
            if (result) status.textContent = result.message;
        } catch (failure) { status.textContent = failure.message; }
        finally { update(); }
    }));
    document.addEventListener('keydown', event => {
        if (overlay.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
        if (event.key === 'Tab') {
            const controls = Array.from(panel.querySelectorAll('button:not(:disabled),input:not(:disabled)'));
            const first = controls[0], last = controls[controls.length - 1];
            if (!first) { event.preventDefault(); panel.focus(); }
            else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
    }, true);
    return {
        close,
        open() {
            if (!overlay.hidden || AppState.currentStep !== 3 || AppState.paintStroke || AppState.eraserStroke || AppState.draftRestorePending) return false;
            focus = document.activeElement;
            checks.forEach(input => { input.checked = input.value === 'pattern'; });
            status.textContent = '操作前会保存当前草稿。';
            batch = createNativeOutput({ save: () => saveDraft({ inlineError: true }), prepare: preparePatternExports,
                native: () => window.xhs && window.xhs.miniTool, current,
                markSubmitted: (id, version) => miniToolStore.markSubmitted(id, version) });
            inert = Array.from(document.body.children).filter(element => element !== overlay && element instanceof HTMLElement).map(element => [element, element.inert]);
            inert.forEach(([element]) => { element.inert = true; });
            overlay.hidden = false;
            update();
            panel.focus();
            return true;
        }
    };
}
