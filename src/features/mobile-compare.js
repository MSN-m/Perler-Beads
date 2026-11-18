/** Mobile-only original-image pinch; desktop and tablet retain their existing handlers. */
import { AppState } from '../state.js';
import { updateResultTransform, getResetZoomState } from '../renderer.js';

export function installMobileCompareGestures(frame) {
    if (!frame) return;
    let gesture = null;
    let suppressClick = false;
    const points = touches => {
        if (touches.length !== 2 || !Array.from(touches).every(touch => frame.contains(touch.target))) return null;
        const [a, b] = touches;
        return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2,
            distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
    };
    frame.addEventListener('touchstart', event => {
        if (AppState.workbenchViewportMode !== 'mobile' || !AppState.comparePreviewVisible) return;
        if (event.touches.length === 1 && !gesture) { suppressClick = false; return; }
        const current = points(event.touches);
        if (!current && !gesture) return;
        gesture = { points: current };
        suppressClick = true;
        AppState.comparePreviewDragging = false;
        AppState.comparePreviewDidDrag = true;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, { capture: true, passive: false });
    frame.addEventListener('touchmove', event => {
        if (!gesture || AppState.workbenchViewportMode !== 'mobile') return;
        event.preventDefault();
        event.stopPropagation();
        const current = points(event.touches);
        const previous = gesture.points;
        gesture.points = current;
        if (!current || !previous || !previous.distance) return;
        const canvas = document.getElementById('compare-source-preview');
        if (!canvas) return;
        const rect = frame.getBoundingClientRect();
        const oldScale = AppState.comparePreviewScale;
        const scale = Math.min(8, Math.max(.01, oldScale * current.distance / previous.distance));
        const ratio = scale / oldScale;
        const left = parseFloat(canvas.style.left) || 0;
        const top = parseFloat(canvas.style.top) || 0;
        const nextLeft = current.x - rect.left - (previous.x - rect.left - left) * ratio;
        const nextTop = current.y - rect.top - (previous.y - rect.top - top) * ratio;
        AppState.comparePreviewScale = scale;
        AppState.comparePreviewOffsetX = nextLeft - (frame.clientWidth - canvas.width * scale) / 2;
        AppState.comparePreviewOffsetY = nextTop - (frame.clientHeight - canvas.height * scale) / 2;
        canvas.style.width = `${canvas.width * scale}px`;
        canvas.style.height = `${canvas.height * scale}px`;
        canvas.style.left = `${nextLeft}px`;
        canvas.style.top = `${nextTop}px`;
    }, { passive: false });
    const end = event => {
        if (!gesture) return;
        AppState.comparePreviewDragging = false;
        AppState.comparePreviewDidDrag = true;
        if (event.type === 'touchcancel' || !event.touches.length) gesture = null;
        else gesture.points = points(event.touches);
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    frame.addEventListener('click', event => {
        if (AppState.workbenchViewportMode !== 'mobile' || !suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
}

/** Keep both panes usable, even on a short landscape viewport. */
export function clampMobileCompareRatio(y, height) {
    const topMin = Math.min(120, height * .3);
    const bottomMin = Math.min(220, height * .4);
    return Math.max(topMin, Math.min(height - bottomMin, y)) / height;
}

export function installMobileCompareDivider(divider) {
    if (!divider) return;
    const stage = document.getElementById('workbench-edit-stage');
    const pane = document.getElementById('compare-source-pane');
    const container = document.getElementById('result-container');
    const canvas = document.getElementById('result-canvas');
    let drag = null;
    let pending = null;
    let frame = null;
    const availableHeight = () => pane.clientHeight + container.clientHeight;
    const active = () => AppState.workbenchViewportMode === 'mobile' && AppState.comparePreviewVisible;
    const apply = ratio => {
        const oldTop = pane.clientHeight;
        stage.style.setProperty('--mobile-compare-ratio', ratio);
        const delta = pane.clientHeight - oldTop;
        const original = document.getElementById('compare-source-preview');
        if (original) original.style.top = `${(parseFloat(original.style.top) || 0) + delta / 2}px`;
        AppState.zoomState.y -= delta / 2;
        AppState.zoomState.fitScale = getResetZoomState(container, canvas).fitScale;
        updateResultTransform(canvas, AppState.zoomState, document.getElementById('zoom-reset-btn'));
        divider.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    };
    const flush = () => {
        frame = null;
        if (pending !== null && active()) apply(pending);
        pending = null;
    };
    divider.addEventListener('pointerdown', event => {
        if (!active() || (event.button !== undefined && event.button !== 0) || drag) return;
        event.preventDefault();
        event.stopPropagation();
        drag = { id: event.pointerId, y: event.clientY, top: pane.clientHeight, height: availableHeight() };
        divider.setPointerCapture(event.pointerId);
    });
    divider.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id || !active()) return;
        event.preventDefault();
        event.stopPropagation();
        pending = clampMobileCompareRatio(drag.top + event.clientY - drag.y, drag.height);
        if (frame === null) frame = requestAnimationFrame(flush);
    });
    const end = event => {
        if (!drag || event.pointerId !== drag.id) return;
        if (frame !== null) cancelAnimationFrame(frame);
        flush();
        drag = null;
        if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
    };
    divider.addEventListener('pointerup', end);
    divider.addEventListener('pointercancel', end);
    divider.addEventListener('lostpointercapture', end);
    divider.addEventListener('keydown', event => {
        if (!active() || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const height = availableHeight();
        apply(clampMobileCompareRatio(pane.clientHeight + (event.key === 'ArrowDown' ? 16 : -16), height));
    });
}
