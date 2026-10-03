import test from 'node:test';
import assert from 'node:assert/strict';
import { getToolTooltipText } from '../src/features/tooltips.js';
const element = (id = '', dataset = {}, extra = {}) => ({ id, dataset, ...extra });
test('pan explains both persistent H and temporary Space interaction', () => {
 assert.equal(getToolTooltipText(element('figma-main-pan-btn')), '拖动画布（H），按住空格临时拖动');
});
test('palette action help takes priority over card selection help', () => {
 assert.equal(getToolTooltipText(element('', {paletteAction:'highlight', paletteColorId:'A1'})), '显示同色格子');
 assert.equal(getToolTooltipText(element('', {paletteAction:'pick', paletteColorId:'A1'})), '从图纸取色，替换全部此颜色');
 for (const dataset of [{paletteAction:'secondary'},{paletteColorId:'A1'},{allColorId:'A1'}]) assert.equal(getToolTooltipText(element('',dataset)), '选择该颜色进入画笔');
});
test('every brush and eraser subtool has help; empty recent slots have none', () => {
 for (const toolAction of ['brush','bucket','edge','eraser','area-erase','color-erase']) assert.ok(getToolTooltipText(element('',{toolAction})));
 assert.equal(getToolTooltipText(element('',{recentColor:'0',renderedColorId:'A1'},{disabled:false})), '使用颜色「A1」');
 assert.equal(getToolTooltipText(element('',{recentColor:'0'},{disabled:true})), '');
 assert.equal(getToolTooltipText(element()), '');
});
