// Only installed by the MiniTool entry. The website keeps its existing breakpoints.
export function isMiniToolHomeViewport(view = window) {
    const navigator = view.navigator || {};
    const iPad = navigator.maxTouchPoints > 1 && /MacIntel|iPad/.test(navigator.platform || '');
    return view.innerWidth < 1024 || view.matchMedia('(pointer: coarse)').matches || iPad;
}

export function installMiniToolHomeLayout(updateUI, view = window, doc = document) {
    const home = doc.getElementById('mobile-home');
    const hero = home && home.querySelector('.mobile-home-hero');
    const actions = home && home.querySelector('.mobile-home-actions');
    if (!home || !hero || !actions) return;
    const sync = (refresh = true) => {
        const tablet = view.innerWidth >= 768 && isMiniToolHomeViewport(view);
        const changed = doc.documentElement.hasAttribute('data-minitool-tablet-home') !== tablet;
        doc.documentElement.toggleAttribute('data-minitool-tablet-home', tablet);
        const parent = tablet ? hero : home;
        if (actions.parentElement !== parent) parent.appendChild(actions);
        if (refresh && changed) updateUI();
    };
    // Defer runs after the HTML is parsed and before the main DOMContentLoaded handlers.
    sync(false);
    view.addEventListener('resize', () => sync());
    view.matchMedia('(pointer: coarse)').addEventListener('change', () => sync());
}
