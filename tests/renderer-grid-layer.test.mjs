import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { renderResult } from '../src/renderer.js';

test('only the PC editor with a fixed overlay omits embedded guides; fine grid and labels remain', () => {
    let viewport = 'desktop', overlay = true;
    globalThis.document = { getElementById: id => id === 'fixed-ruler-canvas' ? (overlay ? {} : null)
        : id === 'workbench-layout' ? { dataset: { viewport } } : null };
    globalThis.requestAnimationFrame = () => {};
    Object.assign(AppState, { currentStep: 3, edgeSelectionMode: false, eraserStroke: null,
        fillMode: false, clearBaseMode: false, qualityOverlayVisible: false });
    AppState.editor.activeTool = 'pan';
    const pixels = Array.from({ length: 144 }, () => ({ id: 'A1', r: 240, g: 200, b: 160 }));
    const original = structuredClone(pixels);
    function draw(id = 'result-canvas') {
        const strokes = [], labels = [];
        const ctx = new Proxy({ stroke() { strokes.push(this.strokeStyle); }, fillText(...args) { labels.push(args); } },
            { get: (obj, key) => obj[key] ?? (() => {}) });
        renderResult({ id, getContext: () => ctx }, pixels, 12, 12);
        return { guides: strokes.filter(style => style !== 'rgba(0,0,0,0.05)').length,
            fine: strokes.filter(style => style === 'rgba(0,0,0,0.05)').length, labels: labels.length };
    }
    assert.deepEqual(draw(), { guides: 0, fine: 26, labels: 144 });
    for (viewport of ['tablet', 'mobile']) assert.equal(draw().guides, 4);
    viewport = 'desktop'; overlay = false;
    assert.equal(draw().guides, 4);
    overlay = true;
    assert.equal(draw('preview-canvas').guides, 4);
    AppState.currentStep = 4;
    assert.equal(draw().guides, 4);
    assert.deepEqual(pixels, original);
});

test('color inspection retains all occupied labels with muted contrast and restores original styles', () => {
 globalThis.document={getElementById:()=>null};
 Object.assign(AppState,{currentStep:3,edgeSelectionMode:false,eraserStroke:null,qualityOverlayVisible:false});
 AppState.editor.activeTool='pan';
 const pixels=[{id:'A1',r:240,g:200,b:160},{id:'B2',r:230,g:240,b:250},{id:'C3',r:20,g:30,b:40},{id:'NONE',r:0,g:0,b:0,a:0}];
 const original=structuredClone(pixels);
 const draw=highlight=>{
  const labels=[];
  const ctx=new Proxy({fillText(text){if(['A1','B2','C3','NONE'].includes(text)) labels.push({text,style:this.fillStyle});}},{get:(o,k)=>o[k]??(()=>{})});
  renderResult({id:'result-canvas',getContext:()=>ctx},pixels,4,1,highlight);
  return labels;
 };
 const normal=draw(null),highlighted=draw('A1');
 assert.deepEqual(highlighted.map(l=>l.text),['A1','B2','C3']);
 assert.equal(highlighted[0].style,normal[0].style);
 assert.notEqual(highlighted[1].style,normal[1].style);
 assert.notEqual(highlighted[2].style,normal[2].style);
 assert.deepEqual(draw(null),normal);assert.deepEqual(pixels,original);
});
