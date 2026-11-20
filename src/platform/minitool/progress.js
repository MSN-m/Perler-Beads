import { AppState } from '../../state.js';
import { miniToolStore } from './storage.js';
import { createProgressSaver } from './progress-saver.js';
import { createProgressNotice } from './progress-notice.js';
import { getWorkbenchProgressState, captureWorkbenchSetupProgress, restoreWorkbenchSetupProgress,
    saveWorkbenchAutomatically, restoreWorkbenchDraft, getWorkbenchDrafts } from '../../ui.js';

export function installMiniToolProgress() {
    const draftDialog = document.getElementById('mobile-draft-dialog');
    const resume = document.createElement('button');
    resume.id = 'minitool-resume';
    resume.type = 'button';
    resume.hidden = true;
    document.getElementById('mobile-draft-note').insertAdjacentElement('afterend', resume);
    const status = document.createElement('p');
    status.id = 'minitool-progress-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    document.body.append(status);
    let setupRecord = null, candidate = null, restoring = false, ready = false;
    let sourceImage = null, sourceRevision = null, sourceUrl;
    let lastHome = false, lastPhase, didWrite = false;
    const notice = createProgressNotice({
        hide: () => { status.hidden = true; },
        show(phase, text) { status.dataset.phase = phase; status.textContent = text; status.hidden = false; }
    });
    const source = () => {
        if (!AppState.image) return AppState.draftSourceImageDataUrl || null;
        const revision = AppState.history[AppState.history.length - 1];
        if (sourceImage !== AppState.image || sourceRevision !== revision) {
            const canvas = document.getElementById('source-canvas');
            if (!canvas.width || !canvas.height) throw new Error('原图还未就绪，请稍后重试。');
            sourceUrl = canvas.toDataURL('image/png');
            sourceImage = AppState.image;
            sourceRevision = revision;
        }
        return sourceUrl;
    };
    const updateResume = () => {
        const records = [...(AppState.autoSaves || []), ...(setupRecord ? [setupRecord] : [])];
        candidate = records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
        resume.hidden = !candidate;
        if (candidate) resume.textContent = '继续上次制作 · ' + (candidate.kind === 'setup-recovery' ? '图片设置' : candidate.patternName || candidate.name || '未命名图纸');
    };
    const read = () => {
        const current = getWorkbenchProgressState();
        const onHome = !current;
        if (onHome !== lastHome) { lastHome = onHome; updateResume(); }
        if (!current || restoring) { notice.dismiss(); return null; }
        status.dataset.surface = current.phase === 'editor' ? 'editor' : 'setup';
        if (current.phase !== lastPhase) { notice.dismiss(); lastPhase = current.phase; }
        current.safe = ready && current.safe && !document.hidden && !document.getElementById('minitool-output')?.hasAttribute('data-busy');
        return current;
    };
    const saver = createProgressSaver({
        read,
        async save(current) {
            didWrite = false;
            if (!ready || !getWorkbenchProgressState()?.safe) return false;
            const sourceImageDataUrl = source();
            const patternId = AppState.colorSelectionPatternId;
            if (current.phase === 'editor') {
                const beforeRecords = AppState.autoSaves || [];
                if (!await saveWorkbenchAutomatically({ sourceImageDataUrl })) {
                    if (AppState.autoSaveError) throw new Error('进度保存失败，请手动保存草稿。');
                    return false;
                }
                didWrite = (AppState.autoSaves || []).some(record => !beforeRecords.includes(record));
                // An older setup snapshot must never win over the generated editor record.
                if (setupRecord && (setupRecord.sourcePatternId === patternId || setupRecord.sourceImageDataUrl === sourceImageDataUrl)) {
                    const previous = setupRecord;
                    try { await miniToolStore.remove(previous.id); if (setupRecord === previous) setupRecord = null; }
                    catch (error) { console.warn('旧设置恢复记录保留。', error); }
                }
            } else {
                const record = captureWorkbenchSetupProgress(sourceImageDataUrl);
                await miniToolStore.put(record);
                didWrite = true;
                setupRecord = record;
            }
            updateResume();
            return true;
        },
        status(phase, error) {
            const current = getWorkbenchProgressState();
            if (!current) { notice.dismiss(); return; }
            status.dataset.surface = current.phase === 'editor' ? 'editor' : 'setup';
            notice.update(phase === 'saved' && !didWrite ? 'settled' : phase, error);
        }
    });
    document.getElementById('mobile-home-drafts').addEventListener('click', updateResume);
    resume.addEventListener('click', async () => {
        if (restoring || !candidate || getWorkbenchProgressState()) return;
        const record = candidate;
        restoring = true;
        resume.disabled = true;
        try {
            const ok = record.kind === 'setup-recovery' ? await restoreWorkbenchSetupProgress(record)
                : restoreWorkbenchDraft(record.id, null, true);
            if (!ok) throw new Error('暂时无法恢复，记录仍保留，请重试。');
            if (draftDialog.open) draftDialog.close();
        } catch (error) {
            resume.textContent = error.message || '恢复失败，请重试';
        } finally { restoring = false; resume.disabled = false; }
    });
    // Read errors never mean an empty library and never enable a browser-storage fallback.
    let reading = false, retryReadAt = 0;
    const load = async () => {
        if (reading) return;
        reading = true;
        try {
            await getWorkbenchDrafts();
            const records = await miniToolStore.list();
            setupRecord = records.filter(record => record.kind === 'setup-recovery').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null;
            ready = true;
            updateResume();
        } catch (error) {
            retryReadAt = Date.now() + 15000;
            console.warn('进度读取失败，旧记录保留。', error);
        } finally { reading = false; }
    };
    load();
    window.setInterval(() => {
        if (!ready && !document.hidden && Date.now() >= retryReadAt) load();
        saver.tick();
    }, 500);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) saver.tick(); });
}
