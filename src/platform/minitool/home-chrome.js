import { miniToolStore } from './storage.js';

// All supplied rectangles are already in container coordinates. Do not add the
// status bar or screenTop a second time, and do not reserve hidden buttons.
export function getHomeChromeInset(info) {
    const value = number => Number.isFinite(number) && number > 0 ? number : 0;
    let bottom = value(info && info.safeArea && info.safeArea.top);
    const buttons = info && info.menuButtons;
    if (buttons) ['back', 'me', 'share'].forEach(name => {
        if (buttons[name]) bottom = Math.max(bottom, value(buttons[name].bottom));
    });
    const top = Math.max(79, bottom + 20);
    return { top, extra: top - 79 };
}

export function installMiniToolHomeChrome() {
    const home = document.getElementById('mobile-home');
    if (!home) return;
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
            const inset = getHomeChromeInset(info);
            home.style.setProperty('--mobile-home-top', inset.top + 'px');
            home.style.setProperty('--mobile-home-menu-extra', inset.extra + 'px');
            if (info.safeArea && Number.isFinite(info.windowHeight) && Number.isFinite(info.safeArea.bottom)) {
                home.style.setProperty('--safe-area-inset-bottom', Math.max(0, info.windowHeight - info.safeArea.bottom) + 'px');
            }
        } catch (failure) { console.warn('Native home layout information unavailable; using the default inset.', failure); }
    };
    refresh();
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(refresh, 150); });
}
