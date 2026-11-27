import test from 'node:test';
import assert from 'node:assert/strict';
import { isMiniToolHomeViewport, installMiniToolHomeLayout } from '../src/platform/minitool/home-layout.js';

function view(width, coarse = false, navigator = {}) {
    const events = {};
    return { innerWidth: width, navigator, events,
        matchMedia: () => ({ matches: coarse, addEventListener(type, callback) { events.pointer = callback; } }),
        addEventListener(type, callback) { events[type] = callback; } };
}

test('native home supports phones, tablet windows and large iPads without changing normal desktop entry', () => {
    assert.equal(isMiniToolHomeViewport(view(375)), true);
    assert.equal(isMiniToolHomeViewport(view(900)), true);
    assert.equal(isMiniToolHomeViewport(view(1366, true)), true);
    assert.equal(isMiniToolHomeViewport(view(1366, false, { platform: 'MacIntel', maxTouchPoints: 5 })), true);
    assert.equal(isMiniToolHomeViewport(view(1440, false, { platform: 'MacIntel', maxTouchPoints: 0 })), false);
});

test('tablet actions move below the slogan as the same nodes and return to mobile footer on resize', () => {
    const win = view(834), flags = new Set(); let updates = 0;
    const hero = { children: [], appendChild(node) { this.children.push(node); node.parentElement = this; } };
    const home = { children: [], appendChild(node) { this.children.push(node); node.parentElement = this; },
        querySelector(selector) { return selector === '.mobile-home-hero' ? hero : actions; } };
    const actions = { parentElement: home, listener: () => 'original action' };
    const doc = { getElementById: () => home, documentElement: {
        hasAttribute: name => flags.has(name),
        toggleAttribute(name, enabled) { if (enabled) flags.add(name); else flags.delete(name); }
    } };
    installMiniToolHomeLayout(() => updates++, win, doc);
    assert.equal(actions.parentElement, hero);
    assert.equal(flags.has('data-minitool-tablet-home'), true);
    assert.equal(updates, 0);
    win.events.resize(); assert.equal(hero.children.length, 1);
    win.innerWidth = 375; win.events.resize();
    assert.equal(actions.parentElement, home); assert.equal(flags.size, 0);
    assert.equal(updates, 1); assert.equal(actions.listener(), 'original action');
    win.innerWidth = 900; win.events.resize();
    assert.equal(actions.parentElement, hero); assert.equal(updates, 2);
});
