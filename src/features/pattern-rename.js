import { AppState } from '../state.js';

// Rename is a local input transaction, not a pixel edit or a draft save.
export function createPatternRename({ state, nodes, updateUI }) {
    let patternId = null;
    let editing = false;
    const available = () => state.workbenchViewportMode === 'desktop' && state.pixelData?.length > 0;
    const sync = () => {
        if (editing && (!available() || patternId !== state.colorSelectionPatternId)) editing = false;
        nodes.form.hidden = !editing;
        nodes.root.classList.toggle('is-renaming', editing);
        nodes.title.setAttribute('role', available() ? 'button' : 'text');
        nodes.title.setAttribute('tabindex', available() ? '0' : '-1');
        if (available()) nodes.title.setAttribute('aria-label', `修改图纸名称：${state.patternName || '未命名图纸'}`);
        else nodes.title.removeAttribute('aria-label');
    };
    const begin = () => {
        if (!available() || editing || state.draftRestorePending) return;
        patternId = state.colorSelectionPatternId;
        editing = true;
        nodes.input.value = state.patternName || '';
        sync();
        nodes.input.focus();
        nodes.input.select();
    };
    const finish = apply => {
        if (!editing) return;
        const samePattern = available() && patternId === state.colorSelectionPatternId;
        if (apply && samePattern) state.patternName = nodes.input.value.trim().slice(0, 40);
        editing = false;
        sync();
        if (apply && samePattern) updateUI();
        if (samePattern) nodes.title.focus();
    };
    return { sync, begin, confirm: () => finish(true), cancel: () => finish(false) };
}

let controller = null;
export function syncWorkbenchRename() { controller?.sync(); }
export function installWorkbenchRename({ updateUI }) {
    const ids = { root: 'workbench-name-editor', title: 'workbench-pattern-title', input: 'workbench-rename-input',
        form: 'workbench-rename-form', trigger: 'workbench-rename-btn', cancel: 'workbench-rename-cancel' };
    const nodes = Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)]));
    if (Object.values(nodes).some(node => !node)) return;
    controller = createPatternRename({ state: AppState, nodes, updateUI });
    nodes.title.addEventListener('click', controller.begin);
    nodes.trigger.addEventListener('click', controller.begin);
    nodes.title.addEventListener('keydown', event => {
        if (event.isComposing || !['Enter', ' '].includes(event.key) || AppState.workbenchViewportMode !== 'desktop') return;
        event.preventDefault(); event.stopPropagation(); controller.begin();
    });
    nodes.form.addEventListener('submit', event => { event.preventDefault(); controller.confirm(); });
    nodes.cancel.addEventListener('click', controller.cancel);
    nodes.form.addEventListener('keydown', event => {
        if (event.isComposing || event.keyCode === 229) {
            if (event.key === 'Enter') event.preventDefault();
            return;
        }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); controller.cancel(); }
    });
    controller.sync();
}
