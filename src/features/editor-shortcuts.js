/** PC editor keyboard policy; actions share the existing button/edit paths. */
export function createEditorShortcuts(actions) {
    let spaceHeld = false;
    let temporaryPan = false;
    let releasePending = false;
    const tools = { b: 'brush', h: 'pan', i: 'eyedropper', c: 'palette', e: 'eraser' };
    const finishPan = () => {
        if (temporaryPan) actions.endTemporaryPan();
        temporaryPan = false;
        releasePending = false;
    };
    return {
        keydown(event) {
            const context = actions.context(event);
            if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || !context.enabled || context.typing || context.busy) return;
            const key = event.key.toLowerCase();
            if (key === 'escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                if (spaceHeld) return;
                event.preventDefault();
                actions.escape();
                return;
            }
            if (context.modal || spaceHeld || event.altKey) return;
            if (event.ctrlKey || event.metaKey) {
                const undo = key === 'z' && !event.shiftKey;
                const redo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
                if (!undo && !redo) return;
                event.preventDefault();
                actions[undo ? 'undo' : 'redo']();
                return;
            }
            if (key === ' ' && !event.shiftKey) {
                if (context.panel) return;
                event.preventDefault();
                spaceHeld = true;
                temporaryPan = context.tool !== 'pan';
                if (temporaryPan) actions.beginTemporaryPan();
                return;
            }
            const tool = tools[key];
            if (!tool) return;
            event.preventDefault();
            const family = ['brush', 'bucket', 'edge'].includes(context.tool) ? 'brush'
                : ['eraser', 'area-erase', 'color-eraser'].includes(context.tool) ? 'eraser' : context.tool;
            if ((tool === 'palette' && context.palette) || (tool === family && !context.palette)) return;
            actions.selectTool(tool);
        },
        keyup(event) {
            if (event.key !== ' ' || !spaceHeld) return;
            event.preventDefault();
            spaceHeld = false;
            if (actions.context(event).dragging) releasePending = true;
            else finishPan();
        },
        pointerup() {
            // Restore after the mouseup-generated click has been suppressed by pan mode.
            if (releasePending) actions.defer(finishPan);
        },
        blur() {
            spaceHeld = false;
            actions.stopPan();
            finishPan();
        }
    };
}
