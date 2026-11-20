// Notification timing is independent of how often progress is persisted.
export function createProgressNotice({ show, hide, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
    let timer = null, lastSuccess = -Infinity, failed = false;
    const dismiss = () => {
        if (timer !== null) clearTimer(timer);
        timer = null;
        hide();
    };
    return {
        dismiss,
        update(phase, error) {
            if (phase === 'error') {
                dismiss();
                failed = true;
                show('error', error?.message || '进度保存失败，请手动保存草稿。');
            } else if (phase === 'saved') {
                const recovering = failed;
                failed = false;
                dismiss();
                if (!recovering && now() - lastSuccess < 30000) return;
                lastSuccess = now();
                show('saved', '进度已保存');
                timer = setTimer(dismiss, 1500);
            } else if (phase === 'settled') {
                failed = false;
                dismiss();
            }
            // Pending/saving remain silent; an outstanding failure stays visible until settled.
        }
    };
}
