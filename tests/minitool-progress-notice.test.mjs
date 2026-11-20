import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressNotice } from '../src/platform/minitool/progress-notice.js';

function setup() {
    let time = 0, callback = null, visible = null, delay;
    const shown = [];
    const notice = createProgressNotice({ now: () => time,
        show: (phase, text) => { visible = { phase, text }; shown.push(visible); },
        hide: () => { visible = null; },
        setTimer: (fn, ms) => { callback = fn; delay = ms; return 1; },
        clearTimer: () => { callback = null; }
    });
    return { notice, shown, at: t => { time = t; }, get visible() { return visible; }, get delay() { return delay; }, expire: () => callback?.() };
}

test('waiting and saving are silent, success disappears after 1.5 seconds', () => {
    const c = setup(); c.notice.update('pending'); c.notice.update('saving'); assert.equal(c.visible, null);
    c.notice.update('saved'); assert.equal(c.visible.text, '进度已保存'); assert.equal(c.delay, 1500);
    c.expire(); assert.equal(c.visible, null);
});

test('frequent successful saves do not repeatedly show a toast within thirty seconds', () => {
    const c = setup(); c.notice.update('saved'); c.expire();
    c.at(2000); c.notice.update('saved'); c.at(15000); c.notice.update('saved'); assert.equal(c.shown.length, 1);
    c.at(30000); c.notice.update('saved'); assert.equal(c.shown.length, 2);
});

test('failures stay visible during retries and recovery can bypass the success cooldown', () => {
    const c = setup(); c.notice.update('saved'); c.at(2000); c.notice.update('error', new Error('空间不足'));
    c.notice.update('pending'); c.notice.update('saving'); assert.equal(c.visible.text, '空间不足');
    c.at(4000); c.notice.update('saved'); assert.equal(c.visible.phase, 'saved'); c.expire(); assert.equal(c.visible, null);
});

test('leaving the page or an unchanged snapshot produces no persistent or false success', () => {
    const c = setup(); c.notice.update('saved'); c.notice.dismiss(); assert.equal(c.visible, null);
    c.at(31000); c.notice.update('settled'); assert.equal(c.visible, null); assert.equal(c.shown.length, 1);
});
