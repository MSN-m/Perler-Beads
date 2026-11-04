import { AppState } from '../state.js';
import { renderResult, updateResultTransform } from '../renderer.js';
import { deepClonePixels, recordPixelAction, calculateStats, updateAdjustUndoButton, setActiveEditorTool } from '../editor.js';
import { findSingletons, isSingleton, isOccupied, pixelSignature, suggestRepairs } from './quality-analysis.js';

let review = null, panel = null, shield = null, updateUI = () => {}, drag = null;
const pixels = () => AppState.stagedPixelData || AppState.pixelData || [];
const busy = () => Boolean(AppState.paintStroke || AppState.eraserStroke || AppState.fillSelection || AppState.zoomState?.isDragging);
const valid = () => review && review.patternId === AppState.colorSelectionPatternId && review.width === AppState.gridWidth
    && review.height === AppState.gridHeight && review.mirrored === AppState.isMirrored && AppState.currentStep === 3
    && review.desktop === (AppState.workbenchViewportMode === 'desktop');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentStatus = item => pixels()[item.index]?.id !== item.colorId || !isSingleton(pixels(), item.index, review.width, review.height)
    ? '已修改' : item.ignored ? '已忽略' : '待检查';
const pending = () => review.items.filter(item => currentStatus(item) === '待检查');
const positionLabel = item => `第 ${item.index % review.width + 1} 列 / 第 ${Math.floor(item.index / review.width) + 1} 行`;
const paint = () => {
    const canvas = document.getElementById('result-canvas');
    if (canvas && pixels().length) renderResult(canvas, pixels(), AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
};
function setZoom(zoom) {
    Object.assign(AppState.zoomState, zoom, { isDragging: false });
    const canvas = document.getElementById('result-canvas');
    if (canvas) { canvas.style.transition = 'none'; updateResultTransform(canvas, AppState.zoomState, document.getElementById('zoom-reset-btn')); }
}
function positionDesktopPanel() {
    if (!panel || !review?.desktop) return;
    const rect = document.getElementById('result-container')?.getBoundingClientRect();
    if (!rect) return;
    panel.style.left = `${rect.left + rect.width / 2}px`;
    panel.style.top = `${rect.top + 12}px`;
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
}
function fitOverview() {
    const container = document.getElementById('result-container'), canvas = document.getElementById('result-canvas');
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    if (review?.desktop) {
        const top = 206, padding = 20;
        const availableWidth = Math.max(120, rect.width - padding * 2);
        const availableHeight = Math.max(120, rect.height - top - 90);
        const scale = Math.max(0.02, Math.min(availableWidth / canvas.width, availableHeight / canvas.height, 1));
        setZoom({ scale, x: (rect.width - canvas.width * scale) / 2, y: top + (availableHeight - canvas.height * scale) / 2 });
        return;
    }
    const available = Math.max(120, rect.width - (rect.width > 760 ? 390 : 24));
    const availableHeight = Math.max(120, rect.height - (rect.width > 760 ? 140 : 350));
    const scale = Math.max(0.02, Math.min(available / canvas.width, availableHeight / canvas.height, 1));
    setZoom({ scale, x: (available - canvas.width * scale) / 2 + 12, y: (availableHeight - canvas.height * scale) / 2 + 40 });
}
function focusItem(index) {
    if (!valid() || busy() || !review.items[index]) return;
    review.cursor = index;
    setActiveEditorTool('pan');
    review.message = '';
    refreshQualityIssues(); paint();
    const item = review.items[index], container = document.getElementById('result-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(150, rect.width - (review.desktop ? 0 : rect.width > 760 ? 390 : 24));
    const height = Math.max(150, rect.height - (review.desktop ? 240 : rect.width > 760 ? 140 : 350));
    const scale = Math.min(2, Math.max(0.5, Math.min(width, height) / 330));
    const cx = (item.index % review.width - AppState.renderedMinX + 1.5) * 30;
    const cy = (Math.floor(item.index / review.width) - AppState.renderedMinY + 1.5) * 30;
    setZoom({ scale, x: width / 2 - cx * scale, y: height / 2 + (review.desktop ? 130 : 40) - cy * scale });
    renderPanel();
}
function closeReview() {
    review = null; drag = null;
    AppState.qualityOverlayVisible = false; AppState.qualityIssues = [];
    if (panel) { panel.hidden = true; panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
    if (shield) shield.hidden = true;
    paint();
}
function cancelPreview(message = '') {
    if (!review?.preview) return;
    const zoom = review.preview.zoom;
    review.preview = null; review.message = message;
    if (shield) shield.hidden = true;
    setZoom(zoom); refreshQualityIssues(); paint(); renderPanel();
    panel?.querySelector('[data-quality-action="auto"]')?.focus({ preventScroll: true });
}
export function analyzeQualityIssues() {
    return findSingletons(pixels(), AppState.gridWidth, AppState.gridHeight);
}
export function refreshQualityIssues() {
    if (review && (!valid() || !AppState.qualityOverlayVisible)) { closeReview(); return []; }
    const issues = analyzeQualityIssues();
    if (!review) { AppState.qualityIssues = issues; return issues; }
    if (review.preview && review.preview.signature !== pixelSignature(pixels())) {
        if (review.desktop) {
            // Editing stays available in the PC overview. Rebase suggestions without moving the camera.
            refreshDesktopPreview();
        } else {
            const zoom = review.preview.zoom;
            review.preview = null; review.mode = 'single'; review.message = '图纸已变化，请重新预览修复。';
            if (shield) shield.hidden = true;
            setZoom(zoom);
        }
    }
    const active = review.items[review.cursor];
    AppState.qualityIssues = review.preview
        ? review.preview.plans.map(plan => ({ ...plan, selected: review.preview.selected.has(plan.index), suggestion: plan.nextColor }))
        : active && currentStatus(active) !== '已修改' ? [{ ...active, active: true }] : [];
    renderPanel();
    return AppState.qualityIssues;
}
export function refreshQualityOverlay() {
    if (!AppState.qualityOverlayVisible) return;
    refreshQualityIssues(); paint();
}
export function openQualityCheckModal() {
    if (busy() || AppState.currentStep !== 3 || !pixels().length) return;
    if (review) { closeReview(); return; }
    review = { patternId: AppState.colorSelectionPatternId, width: AppState.gridWidth, height: AppState.gridHeight,
        mirrored: AppState.isMirrored, desktop: AppState.workbenchViewportMode === 'desktop', mode: 'single',
        items: analyzeQualityIssues(), cursor: 0, preview: null, message: '' };
    AppState.qualityOverlayVisible = true;
    if (panel) { panel.hidden = false; panel.style.left = ''; panel.style.top = ''; panel.style.right = ''; panel.style.bottom = ''; }
    if (shield) shield.style.cssText = '';
    setActiveEditorTool('pan');
    refreshQualityIssues(); paint();
    if (review.items.length) focusItem(0);
}
export const toggleQualityCheck = openQualityCheckModal;

/** Validate the full batch before any write, then record one reversible edit. */
export function commitQualityRepairs(plans, signature) {
    const source = pixels();
    if (pixelSignature(source) !== signature || busy()) return false;
    const changes = plans.filter(plan => plan.nextColor && !plan.blocked && source[plan.index]?.id === plan.colorId
        && isSingleton(source, plan.index, AppState.gridWidth, AppState.gridHeight));
    if (changes.length !== plans.length || !changes.length) return false;
    const remaining = source.filter(isOccupied).length - changes.filter(plan => plan.nextColor.id === 'NONE').length;
    if (remaining < 1) return false;
    if (!AppState.stagedPixelData) AppState.stagedPixelData = deepClonePixels(source);
    const action = { indices: changes.map(plan => plan.index), prevColors: changes.map(plan => ({ ...source[plan.index] })),
        nextColors: changes.map(plan => ({ ...plan.nextColor })) };
    changes.forEach((plan, i) => { AppState.stagedPixelData[plan.index] = { ...action.nextColors[i] }; });
    recordPixelAction(action);
    return true;
}
function previewRepairs() {
    if (!valid() || busy()) return;
    const plans = suggestRepairs(pixels(), review.width, review.height, pending(), { resolveUncertain: review.desktop });
    review.mode = 'auto';
    review.preview = { plans, selected: new Set(plans.filter(plan => plan.recommended && !plan.blocked).map(plan => plan.index)),
        signature: pixelSignature(pixels()), zoom: { scale: AppState.zoomState.scale, x: AppState.zoomState.x, y: AppState.zoomState.y } };
    review.message = '';
    if (shield) shield.hidden = review.desktop;
    refreshQualityIssues(); paint(); fitOverview();
    panel?.querySelector('[data-quality-action="cancel-preview"]')?.focus({ preventScroll: true });
}
function refreshDesktopPreview() {
    const plans = suggestRepairs(pixels(), review.width, review.height, pending(), { resolveUncertain: true });
    review.preview = { plans, selected: new Set(plans.filter(plan => !plan.blocked).map(plan => plan.index)),
        signature: pixelSignature(pixels()), zoom: review.preview?.zoom };
}
function confirmRepairs() {
    if (!valid() || !review.preview || busy()) return;
    const preview = review.preview;
    const selected = preview.plans.filter(plan => preview.selected.has(plan.index));
    if (!commitQualityRepairs(selected, preview.signature)) {
        if (review.desktop) {
            refreshDesktopPreview();
            review.message = '图纸已变化或本批次无法应用，请核对后再修复。';
            refreshQualityIssues(); paint(); return;
        }
        cancelPreview('图纸已变化或本批次无法安全应用，请重新检查。'); return;
    }
    review.preview = null; review.message = `已应用 ${selected.length} 处修改，可通过撤销一次还原。`;
    if (shield) shield.hidden = true;
    if (review.desktop) {
        // Keep the fixed session total and the full-pattern view after applying one snapshot.
        review.preview = preview;
        refreshDesktopPreview();
    }
    calculateStats(); updateAdjustUndoButton();
    refreshQualityIssues(); paint(); updateUI();
}
function renderPanel() {
    if (!panel || !review) return;
    panel.hidden = false;
    const preview = review.preview;
    const modal = Boolean(preview && !review.desktop);
    panel.setAttribute('role', modal ? 'dialog' : 'region');
    if (modal) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
    panel.querySelector('#quality-review-title').textContent = preview ? '确认自动修复' : '单格排查';
    panel.querySelector('[data-quality-action="close"]').setAttribute('aria-label', preview ? '取消修复预览' : '关闭单格排查');
    panel.classList.toggle('quality-review-desktop', review.desktop);
    if (review.desktop) { renderDesktopPanel(); return; }
    const body = panel.querySelector('.quality-review-body');
    const pendingCount = pending().length;
    const ignoredCount = review.items.filter(item => currentStatus(item) === '已忽略').length;
    const modifiedCount = review.items.length - pendingCount - ignoredCount;
    let html = `<p class="quality-review-count">待检查 <strong>${pendingCount}</strong> · 已修改 ${modifiedCount} · 已忽略 ${ignoredCount}</p>`;
    if (review.message) html += `<p class="quality-review-message" role="status">${escape(review.message)}</p>`;
    if (preview) {
        html += `<p>已显示全图。描边标出全部待确认单格；粉色为已勾选，橙色为未勾选。确认前不会修改图纸。</p><div class="quality-repair-list">`;
        for (const plan of preview.plans) {
            const target = plan.nextColor?.id === 'NONE' ? '擦除' : plan.nextColor?.id || '手动处理';
            html += `<label class="quality-repair-row"><input type="checkbox" data-quality-index="${plan.index}" aria-label="修复第${plan.index % review.width + 1}列第${Math.floor(plan.index / review.width) + 1}行" ${preview.selected.has(plan.index) ? 'checked' : ''} ${!plan.nextColor || plan.blocked ? 'disabled' : ''}><span><b>${escape(plan.colorId)} → ${escape(target)}</b><small>${positionLabel(plan)}<br>${escape(plan.reason)}</small></span></label>`;
        }
        html += `</div><p class="quality-review-note">建议均取自修复前图纸，不重复迭代；完成后可重新检查。并列邻色需手动处理，未过半默认不选；忽略项不参与。</p><div class="quality-review-actions"><button data-quality-action="cancel-preview">取消预览</button><button class="is-primary" data-quality-action="confirm" ${preview.selected.size ? '' : 'disabled'}>确认修复 ${preview.selected.size} 处</button></div>`;
    } else {
        const item = review.items[review.cursor];
        if (item) {
            html += `<div class="quality-review-target"><span>第 ${review.cursor + 1} / ${review.items.length} 处 · ${currentStatus(item)}</span><strong>${escape(item.colorId)}</strong><span>${positionLabel(item)}</span></div><p>仅检查八邻域没有同色的单格。有斜角同色不算落单。可直接用画笔、吸管或橡皮处理，修改后点下一处。</p><div class="quality-review-actions"><button data-quality-action="prev" ${review.cursor === 0 ? 'disabled' : ''}>上一处</button><button data-quality-action="next" ${review.cursor >= review.items.length - 1 ? 'disabled' : ''}>下一处</button><button data-quality-action="ignore" ${currentStatus(item) === '已修改' ? 'disabled' : ''}>${item.ignored ? '取消忽略' : '忽略并下一处'}</button></div>`;
        } else html += '<p class="quality-review-empty">没有发现落单单格。</p>';
        html += `<div class="quality-review-actions"><button data-quality-action="rescan">重新检查</button><button class="is-primary" data-quality-action="auto" ${!pendingCount ? 'disabled' : ''}>自动修复预览</button></div>`;
        if (review.items.length) html += `<details><summary>查看全部 ${review.items.length} 处</summary><div class="quality-review-list">${review.items.map((entry, i) => `<button data-quality-action="goto" data-quality-item="${i}">${escape(entry.colorId)} · ${positionLabel(entry)} · ${currentStatus(entry)}</button>`).join('')}</div></details>`;
        html += '<p class="quality-review-note">待检查不代表错误。忽略仅本轮有效，不改变像素或草稿。重新检查可发现本轮编辑后产生的新单格。</p>';
    }
    if (body._html === html) return;
    const active = document.activeElement;
    const action = body.contains(active) ? active?.dataset?.qualityAction : null;
    const checkbox = body.contains(active) ? active?.dataset?.qualityIndex : null;
    const scroll = body.scrollTop, listScroll = body.querySelector('.quality-repair-list')?.scrollTop || 0;
    const expanded = body.querySelector('details')?.open;
    body.innerHTML = html; body._html = html; body.scrollTop = scroll;
    if (body.querySelector('.quality-repair-list')) body.querySelector('.quality-repair-list').scrollTop = listScroll;
    if (expanded && body.querySelector('details')) body.querySelector('details').open = true;
    if (action) body.querySelector(`[data-quality-action="${action}"]`)?.focus({ preventScroll: true });
    if (checkbox) body.querySelector(`[data-quality-index="${checkbox}"]`)?.focus({ preventScroll: true });
}
function renderDesktopPanel() {
    const automatic = review.mode === 'auto', item = review.items[review.cursor];
    panel.classList.toggle('quality-review-automatic', automatic);
    panel.querySelector('#quality-review-title').textContent = automatic ? '自动排查' : '单格排查';
    panel.querySelector('[data-quality-action="close"]').setAttribute('aria-label', '关闭排查');
    const body = panel.querySelector('.quality-review-body');
    const total = review.items.length;
    const tabs = `<div class="quality-mode-tabs" role="tablist" aria-label="排查方式"><button id="quality-single-tab" role="tab" aria-controls="quality-desktop-content" aria-selected="${!automatic}" data-quality-action="single">单格排查</button><button id="quality-auto-tab" role="tab" aria-controls="quality-desktop-content" aria-selected="${automatic}" data-quality-action="auto">自动排查</button></div>`;
    let content;
    if (automatic) {
        const count = review.preview?.selected.size || 0;
        content = `<div class="quality-auto-summary"><p class="quality-total">共${total}处</p><p class="quality-auto-caution">仅根据单格周围颜色修复请谨慎使用</p></div><button class="is-primary quality-auto-apply" data-quality-action="confirm" ${count ? '' : 'disabled'}>自动修复</button>`;
    } else {
        content = `<div class="quality-single-row"><button data-quality-action="prev" ${!item || review.cursor === 0 ? 'disabled' : ''}>上一处</button><span class="quality-progress">${item ? review.cursor + 1 : 0}/${total}处</span><span class="quality-coordinates">${item ? `${item.index % review.width + 1}列 ${Math.floor(item.index / review.width) + 1}行` : '暂无单格'}</span><button data-quality-action="ignore" ${!item || currentStatus(item) === '已修改' ? 'disabled' : ''}>${item?.ignored ? '取消忽略' : '忽略'}</button><button class="is-primary" data-quality-action="next" ${!item || review.cursor >= total - 1 ? 'disabled' : ''}>下一处</button></div>`;
    }
    const html = `${tabs}<div id="quality-desktop-content" role="tabpanel" aria-labelledby="${automatic ? 'quality-auto-tab' : 'quality-single-tab'}">${content}</div>${review.message ? `<p class="quality-desktop-message" role="status">${escape(review.message)}</p>` : ''}`;
    if (body._html !== html) {
        const activeAction = body.contains(document.activeElement) ? document.activeElement?.dataset?.qualityAction : null;
        body.innerHTML = html; body._html = html;
        if (activeAction) body.querySelector(`[data-quality-action="${activeAction}"]`)?.focus({ preventScroll: true });
    }
    positionDesktopPanel();
}
export function installQualityReview({ onUpdate = () => {} } = {}) {
    updateUI = onUpdate;
    if (panel) return;
    shield = document.createElement('div'); shield.className = 'quality-preview-shield'; shield.hidden = true;
    panel = document.createElement('section'); panel.id = 'quality-review-panel'; panel.className = 'quality-review-panel'; panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'quality-review-title');
    panel.innerHTML = '<header class="quality-review-header"><h2 id="quality-review-title">单格排查</h2><button type="button" data-quality-action="close" aria-label="关闭单格排查">×</button></header><div class="quality-review-body"></div>';
    document.body.append(shield, panel);
    panel.addEventListener('click', event => {
        const button = event.target.closest('[data-quality-action]');
        if (!button || !valid() || busy()) return;
        const action = button.dataset.qualityAction;
        if (action === 'close') { if (review.preview && !review.desktop) cancelPreview(); else { closeReview(); updateUI(); } return; }
        if (action === 'single' && review.desktop) {
            review.preview = null; review.mode = 'single'; review.message = '';
            if (shield) shield.hidden = true;
            refreshQualityIssues(); paint();
            if (review.items.length) focusItem(0);
            return;
        }
        if (action === 'cancel-preview') { cancelPreview(); return; }
        if (action === 'confirm') { confirmRepairs(); return; }
        if (action === 'auto') { previewRepairs(); return; }
        if (review.preview) return;
        if (action === 'prev') focusItem(review.cursor - 1);
        if (action === 'next') focusItem(review.cursor + 1);
        if (action === 'goto') focusItem(Number(button.dataset.qualityItem));
        if (action === 'ignore') {
            const item = review.items[review.cursor]; item.ignored = !item.ignored;
            const next = review.items.findIndex((entry, i) => i > review.cursor && currentStatus(entry) === '待检查');
            focusItem(next >= 0 && item.ignored ? next : review.cursor);
        }
        if (action === 'rescan') {
            const ignored = new Set(review.items.filter(item => item.ignored).map(item => `${item.index}:${item.colorId}`));
            review.items = analyzeQualityIssues().map(item => ({ ...item, ignored: ignored.has(`${item.index}:${item.colorId}`) }));
            review.cursor = 0; review.message = ''; refreshQualityIssues(); paint();
            if (review.items.length) focusItem(0);
        }
    });
    panel.addEventListener('change', event => {
        if (!valid() || !review.preview || event.target.dataset.qualityIndex === undefined) return;
        const index = Number(event.target.dataset.qualityIndex);
        const plan = review.preview.plans.find(item => item.index === index);
        if (!plan?.nextColor || plan.blocked) return;
        if (event.target.checked) review.preview.selected.add(index); else review.preview.selected.delete(index);
        refreshQualityIssues(); paint();
    });
    const header = panel.querySelector('header');
    header.addEventListener('pointerdown', event => {
        if (!valid() || review.desktop || event.button !== 0 || event.target.closest('button')) return;
        const rect = panel.getBoundingClientRect();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        header.setPointerCapture(event.pointerId); event.preventDefault();
    });
    header.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        const rect = panel.getBoundingClientRect();
        panel.style.left = `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, drag.left + event.clientX - drag.x))}px`;
        panel.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 8, drag.top + event.clientY - drag.y))}px`;
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) header.addEventListener(type, () => { drag = null; });
    window.addEventListener('blur', () => { drag = null; });
    window.addEventListener('resize', () => {
        if (panel.hidden) return;
        if (review?.desktop) { positionDesktopPanel(); return; }
        const rect = panel.getBoundingClientRect();
        panel.style.left = `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, rect.left))}px`;
        panel.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 8, rect.top))}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto';
    });
    window.addEventListener('keydown', event => {
        if (!valid() || event.isComposing || event.defaultPrevented) return;
        if (event.key === 'Escape' && !busy()) {
            if ((!review.preview || review.desktop) && (AppState.palettePanelOpen || AppState.allColorsPanelOpen || AppState.draftDrawerOpen || AppState.workbenchTabletPanel)) return;
            const otherDialog = [...document.querySelectorAll('[role="dialog"],dialog[open]')].some(el => el !== panel && !el.hidden && !el.classList.contains('hidden') && el.getClientRects().length);
            if (otherDialog) return;
            if (review.preview && !review.desktop) cancelPreview(); else { closeReview(); updateUI(); }
            event.preventDefault(); event.stopImmediatePropagation();
        } else if (review.preview && !review.desktop && event.key === 'Tab') {
            const controls = [...panel.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
            const i = controls.indexOf(document.activeElement);
            controls[(i + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
            event.preventDefault();
        }
    }, true);
}
