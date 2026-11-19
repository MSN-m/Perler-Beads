// Small, feature-tested fallbacks used by this application's shipped code only.
export function installMiniToolCompatibility(hasRules, gapSelectors, aspectSelectors) {
    const root = document.documentElement;
    const height = () => root.style.setProperty('--app-height', window.innerHeight + 'px');
    height();
    window.addEventListener('resize', height);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', height);

    if (window.MediaQueryList && !MediaQueryList.prototype.addEventListener) {
        MediaQueryList.prototype.addEventListener = function (type, listener) { if (type === 'change') this.addListener(listener); };
        MediaQueryList.prototype.removeEventListener = function (type, listener) { if (type === 'change') this.removeListener(listener); };
    }
    const flex = document.createElement('div');
    flex.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    const flexGap = flex.scrollHeight === 1;
    flex.remove();
    // The build replaces :has with these scoped state classes on every target.
    const hasNative = false;
    const aspectRatio = window.CSS && CSS.supports && CSS.supports('aspect-ratio', '1');
    const gapMargins = new WeakMap();
    let pending = false;
    const update = () => {
        pending = false;
        if (!hasNative) hasRules.forEach(rule => {
            document.querySelectorAll(rule.base).forEach(element => {
                element.classList.toggle(rule.name, Boolean(element.querySelector(rule.inner)));
            });
        });
        if (!flexGap) gapSelectors.forEach(selector => {
            let elements;
            try { elements = document.querySelectorAll(selector); } catch { return; }
            elements.forEach(element => {
                const style = getComputedStyle(element);
                if (style.display !== 'flex' && style.display !== 'inline-flex') return;
                const column = style.flexDirection.indexOf('column') === 0;
                const reverse = style.flexDirection.indexOf('reverse') !== -1;
                const prop = column ? (reverse ? 'marginTop' : 'marginBottom') : (reverse ? 'marginLeft' : 'marginRight');
                const gap = style.getPropertyValue(column ? '--pb-gap-y' : '--pb-gap-x').trim();
                Array.from(element.children).forEach((child, index, children) => {
                    let margins = gapMargins.get(child);
                    if (margins) Object.keys(margins).forEach(key => { child.style[key] = margins[key]; });
                    else { margins = {}; gapMargins.set(child, margins); }
                    if (index === children.length - 1 || !gap || gap === '0px') return;
                    margins[prop] = child.style[prop];
                    const base = getComputedStyle(child)[prop];
                    child.style[prop] = 'calc(' + (base || '0px') + ' + ' + gap + ')';
                });
            });
        });
        if (!aspectRatio) aspectSelectors.forEach(selector => {
            let elements;
            try { elements = document.querySelectorAll(selector); } catch { return; }
            elements.forEach(element => {
                const ratio = getComputedStyle(element).getPropertyValue('--pb-aspect').split('/').map(Number);
                if (ratio[0] > 0 && element.clientWidth) element.style.height = element.clientWidth * (ratio[1] || 1) / ratio[0] + 'px';
            });
        });
    };
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
    if (!hasNative || !flexGap) {
        new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true,
            attributeFilter: ['hidden', 'class', 'open', 'data-mode', 'data-viewport'] });
        document.addEventListener('change', schedule, true);
        document.addEventListener('input', schedule, true);
        window.addEventListener('resize', schedule);
        update();
    }
}
