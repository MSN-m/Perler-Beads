import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
globalThis.window = { innerWidth: 1440, innerHeight: 900, matchMedia:()=>({matches:false}), indexedDB:{open:()=>({})} };
globalThis.document = {body:{dataset:{layout:'test'}},addEventListener(){},getElementById:()=>null};
const { startPalettePanelDrag, movePalettePanelDrag, endPalettePanelDrag } = await import('../src/ui.js');
function fixture(all=false) {
 const panel={style:{},getBoundingClientRect:()=>({left:500,top:300,width:403,height:324})};
 const stage={getBoundingClientRect:()=>({left:40,top:80,width:800,height:700})};
 document.getElementById=id=>['palette-panel','all-colors-panel'].includes(id)?panel:id==='workbench-stage'?stage:id==='workbench-figma-main-toolbar'?{getBoundingClientRect:()=>({left:300,top:800,width:690})}:null;
 Object.assign(AppState,{palettePanelOpen:!all,allColorsPanelOpen:all,palettePanelPosition:null,palettePanelDrag:null});
 window.innerWidth=1440;
 const event=(clientX,clientY,extra={})=>({clientX,clientY,button:0,pointerId:1,target:{closest:()=>null},...extra});
 return {panel,event};
}
for (const all of [false,true]) test(`desktop ${all?'all':'used'} palette drag clamps to viewport without changing pixels or history`,()=>{
 const f=fixture(all);const pixels=structuredClone(AppState.pixelData),history=AppState.editor.undoStack.length;
 assert.equal(startPalettePanelDrag(f.event(510,310)),true);
 assert.equal(movePalettePanelDrag(f.event(900,500,{pointerId:2})),false);
 movePalettePanelDrag(f.event(900,500));assert.deepEqual(AppState.palettePanelPosition,{x:890,y:490});
 assert.equal(f.panel.style.transform,'none');
 movePalettePanelDrag(f.event(9999,9999));assert.deepEqual(AppState.palettePanelPosition,{x:1025,y:564});
 movePalettePanelDrag(f.event(-999,-999));assert.deepEqual(AppState.palettePanelPosition,{x:12,y:12});
 assert.equal(endPalettePanelDrag(),true);assert.equal(movePalettePanelDrag(f.event(800,500)),false);
 assert.deepEqual(AppState.pixelData,pixels);assert.equal(AppState.editor.undoStack.length,history);
});
test('controls, grid scroll area and secondary mouse button do not start panel drag',()=>{
 const f=fixture();assert.equal(startPalettePanelDrag(f.event(510,310,{button:2})),false);
 assert.equal(startPalettePanelDrag(f.event(510,310,{target:{closest:()=>({})}})),false);
 assert.equal(AppState.palettePanelDrag,null);
});
test('existing mobile palette uses stage-relative position and bounds',()=>{
 const f=fixture();window.innerWidth=700;
 startPalettePanelDrag(f.event(510,310));movePalettePanelDrag(f.event(600,400));
 assert.deepEqual(AppState.palettePanelPosition,{x:385,y:310});endPalettePanelDrag();
});
