import { paintMobilePatternCover } from './mobile-pattern-cover.js';

const mobileViewport = '(max-width: 767px)';

function renderPatternCard(grid, record, openExample) {
    const { name, colors, indices, gridWidth, gridHeight } = record;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mobile-home-card';
    card.setAttribute('aria-label', `打开示例图纸：${name}`);
    card.style.setProperty('--cover-width', `${Math.min(80, 85 * (225 / 169) * (gridWidth / gridHeight))}%`);

    const pixelData = indices.map(colorIndex => {
        const [id, r, g, b] = colors[colorIndex];
        return { id, r, g, b };
    });
    const pattern = { name, gridWidth, gridHeight, brand: record.brand, mardSet: record.mardSet, pixelData };
    const canvas = document.createElement('canvas');
    paintMobilePatternCover(canvas, card, pattern);
    card.addEventListener('click', () => openExample(pattern));
    card.append(canvas);
    grid.append(card);
}

function installHomeIconMotion(home) {
    const scrollArea = home.querySelector('.mobile-home-scroll');
    const icons = home.querySelector('.mobile-home-icons');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lastScrollTop = scrollArea.scrollTop;
    let lag = 0;
    let previousTime = null;
    let frame = null;

    const reset = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        previousTime = null;
        lag = 0;
        lastScrollTop = scrollArea.scrollTop;
        icons.style.removeProperty('--home-icon-lag');
    };

    const settle = time => {
        frame = null;
        if (home.hidden || reducedMotion.matches) {
            reset();
            return;
        }

        const elapsed = previousTime === null ? 0 : time - previousTime;
        previousTime = time;
        lag *= Math.exp(-elapsed / 105);
        if (Math.abs(lag) < 0.1) {
            reset();
            return;
        }
        icons.style.setProperty('--home-icon-lag', `${lag.toFixed(2)}px`);
        frame = requestAnimationFrame(settle);
    };

    scrollArea.addEventListener('scroll', () => {
        const scrollTop = scrollArea.scrollTop;
        const delta = scrollTop - lastScrollTop;
        lastScrollTop = scrollTop;
        if (!delta || home.hidden || reducedMotion.matches) return;

        // Offset some of the scroll distance in the opposite direction.
        lag = Math.max(-14, Math.min(14, lag + delta * 0.22));
        if (frame === null) frame = requestAnimationFrame(settle);
    }, { passive: true });
    reducedMotion.addEventListener('change', reset);
}

export function installMobileHome({ openExample }) {
    const home = document.getElementById('mobile-home');
    if (!home) return;

    installHomeIconMotion(home);
    document.getElementById('mobile-home-upload').addEventListener('click', () => {
        document.getElementById('file-upload').click();
    });

    const grid = document.getElementById('mobile-home-grid');
    const status = document.getElementById('mobile-home-error');
    const viewport = window.matchMedia(mobileViewport);
    const loadPatterns = async () => {
        if (!viewport.matches) return;
        viewport.removeEventListener('change', loadPatterns);
        try {
            const response = await fetch('assets/data/mobile-home-patterns.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const records = await response.json();
            records.forEach(record => renderPatternCard(grid, record, openExample));
        } catch (error) {
            console.warn('Mobile example patterns could not be loaded.', error);
            status.textContent = '示例图纸加载失败，请刷新后重试。';
            status.hidden = false;
        }
    };
    viewport.addEventListener('change', loadPatterns);
    loadPatterns();
}
