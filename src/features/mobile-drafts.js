import { paintMobilePatternCover } from './mobile-pattern-cover.js';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function installMobileDraftDialog({ getDrafts, openDraft }) {
    const dialog = document.getElementById('mobile-draft-dialog');
    if (!dialog) return;

    const trigger = document.getElementById('mobile-home-drafts');
    const stack = dialog.querySelector('.mobile-draft-stack');
    const empty = dialog.querySelector('.mobile-draft-empty');
    const caption = dialog.querySelector('.mobile-draft-caption');
    const name = caption.querySelector('.mobile-draft-name');
    const summary = caption.querySelector('.mobile-draft-summary');
    const time = caption.querySelector('time');
    const enter = dialog.querySelector('.mobile-draft-open');
    let drafts = [];
    let selected = 0;
    let opening = 0;
    let gesture = null;
    let suppressClick = false;
    let wheelDistance = 0;
    let wheelEnd = 0;
    let wheelStepped = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function showDraft() {
        const draft = drafts[selected];
        stack.hidden = caption.hidden = enter.hidden = !draft;
        empty.hidden = Boolean(draft);
        stack.replaceChildren();
        if (!draft) {
            empty.textContent = '暂无草稿';
            return;
        }

        // The next draft sits to the left, revealed by swiping right.
        const offsets = drafts.length > 3 ? [-2, 2, -1, 1, 0] : drafts.length > 1 ? [-1, 1, 0] : [0];
        for (const offset of offsets) {
            const cardDraft = drafts[(selected + offset + drafts.length) % drafts.length];
            const card = document.createElement('div');
            card.className = 'mobile-draft-card';
            card.dataset.offset = String(offset);
            card.setAttribute('aria-hidden', 'true');
            const cover = document.createElement('canvas');
            paintMobilePatternCover(cover, card, cardDraft);
            card.appendChild(cover);
            stack.appendChild(card);
        }

        name.textContent = draft.name || '未命名图纸';
        summary.textContent = `${draft.gridWidth}×${draft.gridHeight}·${draft.brand.toUpperCase()}·${draft.colorCount || 0}色`;
        const updated = new Date(draft.updatedAt);
        time.textContent = '';
        time.removeAttribute('datetime');
        if (Number.isFinite(updated.getTime())) {
            time.dateTime = updated.toISOString();
            time.textContent = dateFormatter.format(updated).replace(',', '');
        }
    }

    function cardAt(offset) {
        return stack.querySelector(`[data-offset="${offset}"]`);
    }

    function moveCardToSlot(card, from, opacity) {
        const to = card.getBoundingClientRect();
        const x = from.left + from.width / 2 - to.left - to.width / 2;
        const y = from.top + from.height / 2 - to.top - to.height / 2;
        const style = getComputedStyle(card);
        card.animate([
            { transform: `translate(${x}px, ${y}px) ${style.transform} scale(${from.width / to.width}, ${from.height / to.height})`, opacity },
            { transform: style.transform, opacity: style.opacity }
        ], { duration: 230, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }

    function step(direction) {
        if (drafts.length < 2) return;
        const center = cardAt(0);
        const incoming = cardAt(direction);
        const centerPosition = center.getBoundingClientRect();
        const incomingPosition = incoming.getBoundingClientRect();
        const incomingOpacity = getComputedStyle(incoming).opacity;
        resetGesture();
        selected = (selected + direction + drafts.length) % drafts.length;
        showDraft();
        if (reducedMotion.matches) return;
        moveCardToSlot(cardAt(-direction), centerPosition, 1);
        moveCardToSlot(cardAt(0), incomingPosition, incomingOpacity);
    }

    function resetGesture() {
        gesture = null;
        stack.style.removeProperty('--draft-drag');
    }

    trigger.addEventListener('click', async () => {
        if (dialog.open) return;
        const request = ++opening;
        drafts = [];
        selected = 0;
        showDraft();
        empty.textContent = '正在读取草稿…';
        dialog.showModal();
        const records = await getDrafts();
        if (!dialog.open || request !== opening) return;
        drafts = records.filter(draft => Number.isInteger(draft.gridWidth) && draft.gridWidth > 0
            && Number.isInteger(draft.gridHeight) && draft.gridHeight > 0
            && draft.pixelData?.length === draft.gridWidth * draft.gridHeight);
        showDraft();
    });

    dialog.querySelector('.mobile-draft-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', resetGesture);
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
    });
    enter.addEventListener('click', () => {
        if (drafts[selected] && openDraft(drafts[selected].id)) dialog.close();
    });
    window.matchMedia('(max-width: 767px)').addEventListener('change', event => {
        if (!event.matches && dialog.open) dialog.close();
    });

    stack.addEventListener('pointerdown', event => {
        if (drafts.length < 2 || !event.isPrimary || event.button !== 0) return;
        suppressClick = false;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
    });
    stack.addEventListener('pointermove', event => {
        if (event.pointerId !== gesture?.id) return;
        const x = event.clientX - gesture.x;
        const y = event.clientY - gesture.y;
        if (!gesture.horizontal) {
            if (Math.abs(y) >= 10 && Math.abs(y) > Math.abs(x)) {
                resetGesture();
                return;
            }
            if (Math.abs(x) < 10) return;
            gesture.horizontal = true;
            stack.setPointerCapture(event.pointerId);
        }
        stack.style.setProperty('--draft-drag', `${Math.max(-56, Math.min(56, x * 0.65))}px`);
    });
    stack.addEventListener('pointerup', event => {
        if (event.pointerId !== gesture?.id) return;
        const x = event.clientX - gesture.x;
        const y = event.clientY - gesture.y;
        suppressClick = gesture.horizontal || Math.abs(x) > Math.abs(y) && Math.abs(x) >= 28;
        if (suppressClick && Math.abs(x) >= 28) step(Math.sign(x));
        resetGesture();
    });
    stack.addEventListener('pointercancel', resetGesture);
    stack.addEventListener('lostpointercapture', resetGesture);
    stack.addEventListener('wheel', event => {
        if (drafts.length < 2 || event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        if (event.timeStamp - wheelEnd > 160) {
            wheelDistance = 0;
            wheelStepped = false;
        }
        wheelEnd = event.timeStamp;
        if (wheelStepped) return;
        wheelDistance += event.deltaX * (event.deltaMode === 0 ? 1 : 16);
        if (Math.abs(wheelDistance) < 24) return;
        wheelStepped = true;
        step(Math.sign(wheelDistance));
    }, { passive: false });
    stack.addEventListener('click', event => {
        if (suppressClick) return;
        const offset = Number(event.target.closest('.mobile-draft-card')?.dataset.offset);
        if (offset) step(Math.sign(offset));
    });
}
