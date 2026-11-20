import { miniToolStore } from './storage.js';

// All supplied rectangles are already in container coordinates. Do not add the
// status bar or screenTop a second time, and do not reserve hidden buttons.
export function getNativeChromeBottom(info) {
    const value = number => Number.isFinite(number) && number > 0 ? number : 0;
    let bottom = value(info && info.safeArea && info.safeArea.top);
    const buttons = info && info.menuButtons;
    const capsule = buttons && buttons.capsule;
    const visible = rect => rect && Number.isFinite(rect.width) && rect.width > 0
        && Number.isFinite(rect.height) && rect.height > 0 && Number.isFinite(rect.bottom);
    const validCapsule = visible(capsule);
    const rects = validCapsule ? [capsule] : ['back', 'me', 'share'].map(name => buttons && buttons[name]);
    rects.forEach(rect => {
        if (visible(rect)) bottom = Math.max(bottom, value(rect.bottom));
    });
    return bottom;
}

// Keep the editor title in the native control row only when its central band is clear.
export function getEditorChromeLayout(info) {
    const width = info && info.windowWidth;
    if (!Number.isFinite(width) || width <= 0) return null;
    const buttons = info.menuButtons || {};
    const visible = rect => rect && Number.isFinite(rect.width) && rect.width > 0
        && Number.isFinite(rect.height) && rect.height > 0 && Number.isFinite(rect.bottom)
        && Number.isFinite(rect.left) && Number.isFinite(rect.right);
    const rects = visible(buttons.capsule) ? [buttons.capsule]
        : ['back', 'me', 'share'].map(name => buttons[name]).filter(visible);
    if (!rects.length) return null;
    const middle = width / 2;
    let left = 8, right = width - 8;
    rects.forEach(rect => {
        if ((rect.left + rect.right) / 2 < middle) left = Math.max(left, rect.right + 8);
        else right = Math.min(right, rect.left - 8);
    });
    const titleWidth = Math.floor(2 * Math.min(middle - left, right - middle));
    const center = Math.max(...rects.map(rect => rect.bottom - rect.height / 2));
    const safeTop = info.safeArea && Number.isFinite(info.safeArea.top) ? Math.max(0, info.safeArea.top) : 0;
    // Two title lines occupy at most 40px; fall back below the controls if space is unsafe.
    if (titleWidth < 96 || center - 20 < safeTop) return null;
    return { titleCenter: center, titleWidth, rowTop: Math.max(getNativeChromeBottom(info) + 8, center + 28) };
}

export function getHomeChromeInset(info) {
    const bottom = getNativeChromeBottom(info);
    const top = Math.max(79, bottom + 20);
    return { top, extra: top - 79 };
}

export function installMiniToolHomeChrome() {
    const home = document.getElementById('mobile-home');
    if (!home) return;
    const root = document.documentElement;
    const apply = info => {
        if (!info) return;
        const bottom = getNativeChromeBottom(info);
        root.style.setProperty('--minitool-content-top', Math.max(44, bottom + 8) + 'px');
        const editor = getEditorChromeLayout(info);
        ['--minitool-editor-row-top', '--minitool-editor-title-top', '--minitool-editor-title-width', '--minitool-editor-title-transform'].forEach(name => root.style.removeProperty(name));
        if (editor) {
            root.style.setProperty('--minitool-editor-row-top', editor.rowTop + 'px');
            root.style.setProperty('--minitool-editor-title-top', editor.titleCenter + 'px');
            root.style.setProperty('--minitool-editor-title-width', editor.titleWidth + 'px');
            root.style.setProperty('--minitool-editor-title-transform', 'translate(-50%, -50%)');
        }
        const inset = getHomeChromeInset(info);
        home.style.setProperty('--mobile-home-top', inset.top + 'px');
        home.style.setProperty('--mobile-home-menu-extra', inset.extra + 'px');
        if (info.safeArea && Number.isFinite(info.windowHeight) && Number.isFinite(info.safeArea.bottom)) {
            const safeBottom = Math.max(0, info.windowHeight - info.safeArea.bottom) + 'px';
            root.style.setProperty('--safe-area-inset-bottom', safeBottom);
            home.style.setProperty('--safe-area-inset-bottom', safeBottom);
        }
    };
    const launch = window.xhs && window.xhs.launchOptions;
    if (Math.floor(Number(launch && launch.miniToolEnv && launch.miniToolEnv.buildVersion) / 1000) >= 9490) {
        apply(launch.miniToolEnv.windowInfo);
    }
    let generation = 0;
    let timer;
    const refresh = async () => {
        const current = ++generation;
        await miniToolStore.initialize();
        const api = window.xhs && window.xhs.miniTool;
        if (miniToolStore.clientVersion < 9490 || !api || typeof api.getWindowInfo !== 'function') return;
        try {
            const info = await api.getWindowInfo();
            if (current !== generation || !info || info.errMsg !== 'getWindowInfo:ok') return;
            apply(info);
        } catch (failure) { console.warn('Native home layout information unavailable; using the default inset.', failure); }
    };
    refresh();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(refresh, 150); });
}
