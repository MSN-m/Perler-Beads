// Display-only FLIP animation: color identity, not slot index, follows the move.
const patternIds = new WeakMap();

export function captureRecentColors(container) {
    if (!container) return null;
    const colors = [...container.querySelectorAll('[data-recent-color]')].map(button => ({
        id: button.dataset.renderedColorId,
        rect: button.getBoundingClientRect()
    }));
    return { patternId: patternIds.get(container), colors };
}

export function animateRecentColors(container, before, patternId, reducedMotion = false) {
    if (!container) return;
    patternIds.set(container, patternId);
    const buttons = [...container.querySelectorAll('[data-recent-color]')];
    const changed = before?.colors.map(color => color.id || '').join('|') !== buttons.map(button => button.dataset.renderedColorId || '').join('|');
    if (!changed) return; // Frequent UI refreshes must not restart an in-flight move.
    buttons.forEach(button => button.getAnimations?.().forEach(animation => {
        if (animation.id === 'recent-color-reorder') animation.cancel();
    }));
    if (!before || before.patternId !== patternId || reducedMotion) return;
    if (!before.colors.some(color => color.id && color.rect.width > 0)) return;
    const previous = new Map(before.colors.filter(color => color.id).map(color => [color.id, color.rect]));
    buttons.forEach(button => {
        if (!button.dataset.renderedColorId || !button.animate) return;
        const rect = button.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const old = previous.get(button.dataset.renderedColorId);
        if (old?.width) {
            const x = old.left + old.width / 2 - rect.left - rect.width / 2;
            const y = old.top + old.height / 2 - rect.top - rect.height / 2;
            if (Math.abs(x) < .5 && Math.abs(y) < .5) return;
            const selected = button.classList.contains('is-current');
            button.animate([
                { transform: `translate(${x}px, ${y}px)` },
                ...(selected ? [{ transform: `translate(${x * .55}px, ${y - 2}px)`, offset: .45 }] : []),
                { transform: 'translate(0, 0)' }
            ], { id: 'recent-color-reorder', duration: 360, easing: 'cubic-bezier(.22,.68,.2,1)' });
        } else {
            button.animate([
                { opacity: 0, transform: 'translateY(6px) scale(.92)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }
            ], { id: 'recent-color-reorder', duration: 240, easing: 'ease-out' });
        }
    });
}
