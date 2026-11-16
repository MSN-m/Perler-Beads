const STAGE_MESSAGES = {
    upload: '正在加载图片…',
    image: '小豆鸡在给豆豆点名…',
    grid: '小豆鸡在给豆豆排队…',
    palette: '小豆鸡在鼓励走错的豆豆…'
};

export function isMobileLoadingActive() {
    return Boolean(document.getElementById('mobile-operation-loading')?.open);
}

export function beginMobileLoading(initialStage) {
    if (document.body.dataset.layout !== 'workbench' || !window.matchMedia('(max-width: 767px)').matches) return null;
    const dialog = document.getElementById('mobile-operation-loading');
    const message = document.getElementById('mobile-operation-message');
    if (!dialog || !message || dialog.open) return null;

    const setStage = stage => {
        dialog.dataset.stage = stage;
        message.textContent = STAGE_MESSAGES[stage];
    };
    setStage(initialStage);
    dialog.oncancel = event => event.preventDefault();
    dialog.showModal();
    return { setStage, close: () => dialog.close() };
}
