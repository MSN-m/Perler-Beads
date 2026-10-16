/** Desktop canvas actions; shares editor coordinates, colors and undo history. */
import { AppState } from '../state.js';
import { beginGlobalEditorSession, deepClonePixels, resetBatchReplaceState, setActiveEditorTool } from '../editor.js';
import { getGridHitFromEvent, selectPaletteFillColor } from './adjust.js';
import { handleDeleteClick } from './delete.js';
import { renderResult, updateResultTransform } from '../renderer.js';
import { resetZoom } from './zoom.js';

export function isDesktopContext() {
    const width = window.innerWidth;
    return document.body.dataset.layout === 'workbench' && width >= 1024
        && !(width <= 1180 && window.matchMedia?.('(pointer: coarse)').matches);
}

export function centerCanvas(container, canvas) {
    const zoom = AppState.zoomState;
    zoom.x = (container.clientWidth - canvas.width * zoom.scale) / 2;
    zoom.y = (container.clientHeight - canvas.height * zoom.scale) / 2;
    zoom.isDragging = false;
    canvas.style.transition = 'none';
    updateResultTransform(canvas, zoom, document.getElementById('zoom-reset-btn'));
}

export function applyCanvasContextAction(action, index, canvas) {
    const pixels = AppState.stagedPixelData || AppState.pixelData;
    const color = pixels?.[index];
    if (!color || color.id === 'NONE') return false;
    if (action === 'pick') {
        AppState.palettePanelOpen = false;
        AppState.allColorsPanelOpen = false;
        AppState.paletteToolSnapshot = null;
        AppState.highlightedColorId = null;
        resetBatchReplaceState();
        selectPaletteFillColor({ ...color });
    } else if (action === 'highlight') {
        // Inspection must not be obscured by bucket/edge/eraser operation previews.
        resetBatchReplaceState();
        AppState.receiverIndex = null;
        AppState.adjustPhase = 'waiting_receiver';
        setActiveEditorTool('pan');
        AppState.highlightedColorId = AppState.highlightedColorId === String(color.id) ? null : String(color.id);
        renderResult(canvas, pixels, AppState.gridWidth, AppState.gridHeight, AppState.highlightedColorId);
    } else if (action === 'delete') {
        if (!AppState.stagedPixelData) {
            AppState.stagedPixelData = deepClonePixels(AppState.pixelData);
            beginGlobalEditorSession(AppState.pixelData);
        }
        return handleDeleteClick(index, canvas);
    } else return false;
    return true;
}

export function initCanvasContextMenu(container, canvas, onUpdate) {
    if (!container || !canvas) return;
    const menu = document.createElement('div');
    menu.id = 'canvas-context-menu';
    menu.className = 'canvas-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', '画布菜单');
    menu.hidden = true;
    document.body.appendChild(menu);
    let target = null, suppressClickUntil = 0, previousFocus = null;
    const busy = () => Boolean(AppState.paintStroke || AppState.eraserStroke || AppState.fillSelection || AppState.zoomState?.isDragging || AppState.comparePreviewDragging);
    const enabled = () => isDesktopContext() && AppState.currentStep === 3
        && (AppState.stagedPixelData || AppState.pixelData)?.length && !busy()
        && ![...document.querySelectorAll('[role="dialog"], dialog[open], #delete-confirm-modal')].some(el => !el.hidden && !el.classList.contains('hidden') && el.getClientRects().length);
    const close = (restoreFocus = false) => {
        menu.hidden = true;
        target = null;
        if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
    const valid = () => target && enabled() && target.pattern === AppState.colorSelectionPatternId
        && target.pixels === (AppState.stagedPixelData || AppState.pixelData);
    const addButton = (label, action, danger = false) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        button.dataset.action = action;
        button.textContent = label;
        if (danger) button.className = 'is-danger';
        button.addEventListener('click', () => {
            if (!valid()) { close(); return; }
            const index = target.index;
            close(true);
            if (action === 'reset') resetZoom();
            else if (action === 'center') centerCanvas(container, canvas);
            else { applyCanvasContextAction(action, index, canvas); onUpdate(); }
        });
        menu.appendChild(button);
    };
    container.addEventListener('contextmenu', event => {
        if (!enabled() || event.pointerType === 'touch') return;
        event.preventDefault();
        event.stopPropagation();
        const hit = event.target === canvas ? getGridHitFromEvent(event) : null;
        const pixels = AppState.stagedPixelData || AppState.pixelData;
        const color = hit && pixels[hit.idx]?.id !== 'NONE' ? pixels[hit.idx] : null;
        target = { index: color ? hit.idx : null, pixels, pattern: AppState.colorSelectionPatternId };
        previousFocus = document.activeElement;
        menu.replaceChildren();
        if (color) {
            const info = document.createElement('div');
            info.className = 'canvas-context-color';
            const hex = '#' + [color.r, color.g, color.b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase();
            const swatch = document.createElement('span');
            swatch.style.backgroundColor = hex;
            const text = document.createElement('span');
            text.textContent = String(color.id) + ' · ' + hex + '\nRGB(' + [color.r, color.g, color.b].join(', ') + ')';
            info.append(swatch, text);
            menu.appendChild(info);
            addButton('吸取颜色', 'pick');
            addButton(AppState.highlightedColorId === String(color.id) ? '取消查看所有' : '查看所有', 'highlight');
            addButton('删除', 'delete', true);
        } else {
            addButton('重置缩放', 'reset');
            addButton('居中显示', 'center');
        }
        menu.hidden = false;
        const rect = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8)) + 'px';
        menu.style.top = Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8)) + 'px';
        menu.querySelector('button').focus({ preventScroll: true });
    });
    // Right presses must never start brush strokes or canvas panning.
    container.addEventListener('mousedown', event => {
        if (isDesktopContext() && event.button === 2) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    document.addEventListener('pointerdown', event => {
        if (menu.hidden || menu.contains(event.target)) return;
        close();
        if (event.button === 0) {
            suppressClickUntil = Date.now() + 600;
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    for (const type of ['mousedown', 'click']) document.addEventListener(type, event => {
        if (Date.now() < suppressClickUntil && !menu.contains(event.target)) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);
    window.addEventListener('keydown', event => {
        if (menu.hidden) return;
        if (event.key === 'Escape' || !valid()) {
            close(true); event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab'].includes(event.key)) {
            const buttons = [...menu.querySelectorAll('button')];
            const current = buttons.indexOf(document.activeElement);
            const backwards = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (current + (backwards ? -1 : 1) + buttons.length) % buttons.length;
            buttons[next].focus();
            event.preventDefault(); event.stopImmediatePropagation();
        } else if (!['Enter', ' '].includes(event.key)) {
            event.preventDefault(); event.stopImmediatePropagation();
        } else event.stopImmediatePropagation();
    }, true);
    window.addEventListener('resize', () => close());
    window.addEventListener('blur', () => close());
    document.addEventListener('scroll', () => close(), true);
    container.addEventListener('wheel', () => close(), { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
}
