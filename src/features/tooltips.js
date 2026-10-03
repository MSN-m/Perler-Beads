/** PC hover help. Reads DOM metadata only; never writes editor or history state. */
const SCOPE = '#workbench-figma-main-toolbar, #workbench-figma-brush-toolbar, #workbench-figma-eraser-toolbar, #palette-panel, #all-colors-panel';
const TOOLS = {
    'figma-main-pan-btn': '拖动画布（H），按住空格临时拖动',
    'figma-main-brush-btn': '选择上色工具（B）',
    'figma-main-eyedropper-btn': '从图纸取色（I）',
    'figma-main-palette-btn': '查看和选择颜色（C）',
    'figma-main-eraser-btn': '选择擦除工具（E）',
    'figma-main-undo-btn': '撤销上一步（Ctrl/⌘+Z）',
    'figma-main-redo-btn': '重做已撤销的操作（Ctrl/⌘+Shift+Z）',
    'figma-palette-sort': '切换颜色数量排序',
    'close-palette-panel-btn': '关闭色板，返回原工具',
    'close-all-colors-panel-btn': '关闭色板，返回原工具'
};
const SUBTOOLS = {
    brush: '按住拖动，为格子上色',
    bucket: '填充相连的同色区域',
    edge: '点击高亮边缘，为整圈上色',
    eraser: '按住拖动，擦除格子',
    'area-erase': '擦除相连的同色区域',
    'color-erase': '擦除图纸中全部同色格子'
};

export function getToolTooltipText(element) {
    if (TOOLS[element.id]) return TOOLS[element.id];
    const data = element.dataset;
    if (data.toolAction) return SUBTOOLS[data.toolAction] || '';
    if (data.paletteAction === 'highlight') return '显示同色格子';
    if (data.paletteAction === 'pick') return '从图纸取色，替换全部此颜色';
    if (data.paletteAction === 'secondary' || data.paletteColorId || data.allColorId) return '选择该颜色进入画笔';
    if (data.recentColor !== undefined && !element.disabled) return `使用颜色「${data.renderedColorId || element.textContent.trim()}」`;
    return '';
}

export function installWorkbenchTooltips() {
    if (document.getElementById('workbench-hover-tooltip')) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'workbench-hover-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    let target = null;
    let timer = null;
    let describedElement = null;
    let oldDescription = null;
    let lastPointerDown = 0;
    const desktop = () => window.innerWidth >= 1024;
    const findTarget = (node) => {
        const element = node instanceof Element ? node.closest('[data-palette-action], button') : null;
        return desktop() && element?.closest(SCOPE) && getToolTooltipText(element) ? element : null;
    };
    const stripNativeTitles = (element) => {
        // Parent cards also carry titles; avoid two overlapping descriptions on icons.
        for (let node = element; node && !node.matches(SCOPE); node = node.parentElement) node.removeAttribute('title');
    };
    const hide = () => {
        clearTimeout(timer);
        timer = null;
        tooltip.hidden = true;
        if (describedElement) {
            if (oldDescription === null) describedElement.removeAttribute('aria-describedby');
            else describedElement.setAttribute('aria-describedby', oldDescription);
        }
        describedElement = null;
        target = null;
    };
    const show = () => {
        timer = null;
        if (!target?.isConnected || !desktop() || !target.getClientRects().length) { hide(); return; }
        stripNativeTitles(target);
        tooltip.textContent = getToolTooltipText(target);
        tooltip.hidden = false;
        const rect = target.getBoundingClientRect();
        const width = tooltip.offsetWidth;
        const height = tooltip.offsetHeight;
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
        const top = rect.top >= height + 8 ? rect.top - height - 8 : rect.bottom + 8;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, top))}px`;
        describedElement = target;
        oldDescription = target.getAttribute('aria-describedby');
        target.setAttribute('aria-describedby', [oldDescription, tooltip.id].filter(Boolean).join(' '));
    };
    const schedule = (element) => {
        hide();
        if (!element) return;
        target = element;
        stripNativeTitles(element);
        timer = setTimeout(show, 600);
    };
    document.addEventListener('pointerover', event => {
        if (event.pointerType === 'touch') return;
        const next = findTarget(event.target);
        if (next !== target) schedule(next);
    });
    document.addEventListener('pointermove', event => {
        // Wait until the pointer rests, instead of showing help during a sweep.
        if (timer && (event.movementX || event.movementY)) {
            clearTimeout(timer);
            timer = setTimeout(show, 600);
        }
    });
    document.addEventListener('pointerout', event => {
        if (target && findTarget(event.relatedTarget) !== target) hide();
    });
    document.addEventListener('pointerdown', () => { lastPointerDown = Date.now(); hide(); }, true);
    document.addEventListener('focusin', event => {
        if (Date.now() - lastPointerDown > 100) schedule(findTarget(event.target));
    });
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', hide, true);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    new MutationObserver(() => {
        if (target && (!target.isConnected || !target.getClientRects().length)) hide();
    }).observe(document.getElementById('workbench-stage') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
