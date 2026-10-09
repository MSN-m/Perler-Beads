import test from 'node:test';
import assert from 'node:assert/strict';
import { createPatternRename } from '../src/features/pattern-rename.js';

function setup() {
    const state = { workbenchViewportMode: 'desktop', pixelData: [{ id: 'A1' }], colorSelectionPatternId: 'one',
        patternName: '原名称', currentDraftId: 'draft-one', stagedActions: [1], workbenchTabletPanel: null };
    const node = () => ({ hidden: true, value: '', attributes: {}, focus() { this.focused = true; }, select() { this.selected = true; },
        setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; } });
    const nodes = { root: { classList: { toggle() {} } }, title: node(), input: node(), form: node() };
    let updates = 0;
    const controller = createPatternRename({ state, nodes, updateUI() { updates++; } });
    return { state, nodes, controller, updates: () => updates };
}
test('inline rename commits only on confirmation, without saving or editing pixels', () => {
    const { state, nodes, controller, updates } = setup();
    const pixels = state.pixelData, actions = state.stagedActions;
    controller.begin(); assert.equal(nodes.form.hidden, false); assert.equal(nodes.input.selected, true);
    nodes.input.value = ' 新名称 '; assert.equal(state.patternName, '原名称');
    controller.confirm(); assert.equal(state.patternName, '新名称'); assert.equal(nodes.form.hidden, true);
    assert.equal(updates(), 1); assert.equal(state.currentDraftId, 'draft-one');
    assert.equal(state.pixelData, pixels); assert.equal(state.stagedActions, actions);
});
test('cancel keeps the original name, empty name uses existing placeholder semantics, length is bounded', () => {
    const { state, nodes, controller, updates } = setup();
    controller.begin(); nodes.input.value = '取消的名称'; controller.cancel();
    assert.equal(state.patternName, '原名称'); assert.equal(updates(), 0);
    controller.begin(); nodes.input.value = '  '; controller.confirm(); assert.equal(state.patternName, '');
    controller.begin(); nodes.input.value = 'a'.repeat(60); controller.confirm(); assert.equal(state.patternName.length, 40);
});
test('switching diagrams cannot commit the previous input into a new diagram', () => {
    const { state, nodes, controller, updates } = setup();
    controller.begin(); nodes.input.value = '旧图纸未确认'; state.colorSelectionPatternId = 'two'; state.patternName = '新图纸';
    controller.confirm(); assert.equal(state.patternName, '新图纸'); assert.equal(updates(), 0);
    controller.begin(); state.colorSelectionPatternId = 'three'; controller.sync(); assert.equal(nodes.form.hidden, true);
});
test('PAD/mobile and setup do not activate the new PC editor', () => {
    const { state, nodes, controller } = setup();
    for (const mode of ['tablet', 'mobile']) {
        state.workbenchViewportMode = mode; controller.begin(); controller.sync();
        assert.equal(nodes.form.hidden, true); assert.equal(nodes.title.attributes.tabindex, '-1');
    }
    state.workbenchViewportMode = 'desktop'; state.pixelData = []; controller.begin(); assert.equal(nodes.form.hidden, true);
    state.pixelData = [{ id: 'A1' }]; controller.begin(); state.workbenchViewportMode = 'tablet'; controller.sync();
    assert.equal(nodes.form.hidden, true); assert.equal(state.patternName, '原名称');
});
