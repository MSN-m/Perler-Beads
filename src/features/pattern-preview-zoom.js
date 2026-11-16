const MAX_SCALE = 8;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function createPatternPreviewZoom(layer) {
    const canvas = layer.querySelector('#pattern-preview-canvas');
    const frame = canvas.parentElement;
    let enabled = false;
    let zoom = { scale: 1, x: 0, y: 0 };
    let gesture = null;

    function applyZoom(scale, x, y) {
        const maxX = Math.max(0, (canvas.offsetWidth * scale - frame.clientWidth) / 2);
        const maxY = Math.max(0, (canvas.offsetHeight * scale - frame.clientHeight) / 2);
        zoom = { scale, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
        frame.toggleAttribute('data-zoomed', scale > 1);
        canvas.style.transform = scale > 1
            ? `translate(${zoom.x}px, ${zoom.y}px) scale(${scale})`
            : '';
    }

    function measure(touches) {
        const [first, second] = touches;
        const rect = frame.getBoundingClientRect();
        return {
            distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
            x: (first.clientX + second.clientX) / 2 - (rect.left + rect.width / 2),
            y: (first.clientY + second.clientY) / 2 - (rect.top + rect.height / 2)
        };
    }

    function preventPageZoom(event) {
        if (enabled && event.cancelable) event.preventDefault();
    }

    layer.addEventListener('touchstart', event => {
        if (!enabled || event.touches.length < 2) return;
        preventPageZoom(event);
        gesture = null;
        const touches = Array.from(event.touches);
        if (touches.length !== 2 || !touches.every(touch => frame.contains(touch.target))) return;
        const { distance, x, y } = measure(touches);
        if (!distance) return;
        gesture = {
            ids: touches.map(touch => touch.identifier),
            distance,
            scale: zoom.scale,
            anchorX: (x - zoom.x) / zoom.scale,
            anchorY: (y - zoom.y) / zoom.scale
        };
    }, { passive: false });

    layer.addEventListener('touchmove', event => {
        if (!enabled || event.touches.length < 2) return;
        preventPageZoom(event);
        if (!gesture || event.touches.length !== 2) return;
        const touches = Array.from(event.touches);
        if (!touches.every(touch => gesture.ids.includes(touch.identifier))) return;
        const { distance, x, y } = measure(touches);
        const scale = clamp(gesture.scale * distance / gesture.distance, 1, MAX_SCALE);
        applyZoom(scale, x - gesture.anchorX * scale, y - gesture.anchorY * scale);
    }, { passive: false });

    // Safari also dispatches gesture events for native pinch zoom.
    layer.addEventListener('gesturestart', preventPageZoom, { passive: false });
    layer.addEventListener('gesturechange', preventPageZoom, { passive: false });
    layer.addEventListener('touchend', () => { gesture = null; });
    layer.addEventListener('touchcancel', () => { gesture = null; });

    return {
        setEnabled(active) {
            if (enabled === active) return;
            enabled = active;
            layer.toggleAttribute('data-touch-preview', active);
            gesture = null;
            if (!active) applyZoom(1, 0, 0);
        },
        refresh() {
            if (zoom.scale > 1) applyZoom(zoom.scale, zoom.x, zoom.y);
        }
    };
}
