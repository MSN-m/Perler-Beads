// Runs before the bundled application. No general-purpose runtime dependency.
(function () {
    if (typeof globalThis === 'undefined') window.globalThis = window;
    if (!Object.fromEntries) Object.defineProperty(Object, 'fromEntries', { value: function (entries) {
        const result = {};
        for (const entry of entries) Object.defineProperty(result, entry[0], { value: entry[1], enumerable: true, writable: true, configurable: true });
        return result;
    }, configurable: true, writable: true });
    if (!Object.hasOwn) Object.defineProperty(Object, 'hasOwn', { value: (object, key) => Object.prototype.hasOwnProperty.call(object, key), configurable: true, writable: true });
    if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value: function (index) {
        index = Math.trunc(Number(index)) || 0;
        return this[index < 0 ? this.length + index : index];
    }, configurable: true, writable: true });
    if (!Element.prototype.toggleAttribute) Element.prototype.toggleAttribute = function (name, force) {
        const enabled = force === undefined ? !this.hasAttribute(name) : Boolean(force);
        if (enabled) this.setAttribute(name, ''); else this.removeAttribute(name);
        return enabled;
    };
    // Native dialog is present in Chrome 61; inert was added much later.
    if (!('inert' in HTMLElement.prototype)) Object.defineProperty(HTMLElement.prototype, 'inert', {
        get() { return this.hasAttribute('data-pb-inert'); },
        set(value) { if (value) this.setAttribute('data-pb-inert', ''); else this.removeAttribute('data-pb-inert'); }
    });
    document.addEventListener('focusin', event => {
        if (event.target.closest('[data-pb-inert]')) {
            const active = document.querySelector('#minitool-output:not([hidden]) [role=dialog], [role=dialog]:not([hidden]):not(.hidden)');
            if (active) active.focus();
        }
    }, true);
    ['pointerdown', 'click', 'keydown'].forEach(type => document.addEventListener(type, event => {
        if (event.target.closest && event.target.closest('[data-pb-inert]')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true));
})();
