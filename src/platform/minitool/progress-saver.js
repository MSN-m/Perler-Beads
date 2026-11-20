// Timing has no canvas/storage dependencies. A save always belongs to one captured revision.
export function createProgressSaver({ read, save, status = () => {}, now = Date.now }) {
    let token = null, revision = 0, savedRevision = 0, firstAt = 0, lastAt = 0;
    let running = false, retryAt = 0, stopped = false;
    const observe = () => {
        const current = read();
        if (!current) { token = null; savedRevision = revision; return null; }
        if (!token || token.length !== current.token.length || token.some((value, i) => value !== current.token[i])) {
            const hadPending = revision !== savedRevision;
            token = current.token;
            revision++;
            lastAt = now();
            if (!hadPending) firstAt = lastAt;
            if (now() >= retryAt) status('pending');
        }
        return current;
    };
    return {
        async tick(force = false) {
            if (stopped) return;
            const current = observe();
            if (!current || running || !current.safe || revision === savedRevision || now() < retryAt) return;
            if (!force && now() - lastAt < 2000 && now() - firstAt < 15000) return;
            const captured = revision;
            running = true;
            status('saving');
            try {
                const success = await save(current);
                observe();
                if (success) {
                    savedRevision = captured;
                    retryAt = 0;
                    if (revision === captured) status('saved');
                    else { firstAt = now(); status('pending'); }
                } else retryAt = now() + 1000; // Busy changed during preparation; do not report success.
            } catch (error) {
                retryAt = now() + 15000;
                status('error', error);
            } finally { running = false; }
        },
        stop() { stopped = true; }
    };
}
