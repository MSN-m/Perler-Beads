import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { getCurrentPalette, openPaletteToolSession, restorePaletteToolSession, undoGlobalEditorOperation, redoGlobalEditorOperation } from '../src/editor.js';
import { handleResultCanvasClickForAdjust, startFillSelection } from '../src/features/adjust.js';
const colors = getCurrentPalette().slice(0,3).map(({id,r,g,b})=>({id,r,g,b}));
const ctx = new Proxy({}, { get: (o,k) => o[k] ?? (() => {}) });
const canvas = { id:'result-canvas', getContext:() => ctx, getBoundingClientRect:() => ({left:0,top:0}), classList:{add(){},remove(){}}, style:{} };
const stats = Object.fromEntries(['total-beads-count','color-types-count','color-stats'].map(id=>[id,{}]));
globalThis.document = {body:{dataset:{layout:'test'}}, getElementById:id => id === 'result-canvas' ? canvas : stats[id] || null, addEventListener(){} };
globalThis.window = {innerWidth:1280,matchMedia:()=>({matches:false}),indexedDB:{open:()=>({})}};
const { handlePaletteColorSelect, handlePaletteAction, handleAllColorsSelect, closePalettePanel, closeAllColorsPanel, toggleAllColorsPanel } = await import('../src/ui.js');
function setup(tool='color-eraser') {
 Object.assign(AppState,{pixelData:[{...colors[0],a:255},{...colors[1],a:255},{...colors[0],a:255}],stagedPixelData:[{...colors[0],a:255},{...colors[1],a:255},{...colors[0],a:255}],gridWidth:3,gridHeight:1,renderedMinX:0,renderedMinY:0,renderedContentWidth:3,renderedContentHeight:1, zoomState:{scale:1}, colorSelectionPatternId:'palette-test',editMode:'delete',colorEraseMode:true,deleteMode:true,edgeSelectionMode:false,clearBaseMode:false,eyedropperMode:false,fillMode:false,paintColor:colors[2],fillColor:colors[2],fillColorId:colors[2].id,paintStroke:null,eraserStroke:null,eraserHoverColorId:null,eraserClickSuppressedUntil:0,paletteDismissClickUntil:0,highlightedColorId:null,paletteToolSnapshot:null,palettePanelOpen:false,allColorsPanelOpen:false,recentColors:[],stagedActions:[],lastBrushTool:'edge',lastEraserTool:'color-eraser'});
 Object.assign(AppState.editor,{activeTool:tool,undoStack:[],redoStack:[]});
 AppState.batchReplace={active:false};
}
for (const [name,select] of [['card',handlePaletteColorSelect],['pointer',id=>handlePaletteAction(id,'secondary')],['all-colors',handleAllColorsSelect]]) {
 test(`${name} selects color, closes palette, remembers recent and enters brush without editing`,()=>{
 setup();const before=structuredClone(AppState.pixelData);openPaletteToolSession();AppState.palettePanelOpen=true;
 select(colors[1].id);
 assert.equal(AppState.paintColor.id,colors[1].id);assert.equal(AppState.recentColors[0].id,colors[1].id);
 assert.equal(AppState.palettePanelOpen,false);assert.equal(AppState.editor.activeTool,'brush');assert.equal(AppState.fillMode,true);assert.equal(AppState.colorEraseMode,false);
 assert.deepEqual(AppState.pixelData,before);assert.equal(AppState.editor.undoStack.length,0);
 });
}
test('eye toggles, switches a single highlight and leaves palette and pixels intact',()=>{
 setup();openPaletteToolSession();AppState.palettePanelOpen=true;const before=structuredClone(AppState.pixelData);
 handlePaletteAction(colors[0].id,'highlight');assert.equal(AppState.highlightedColorId,colors[0].id);
 handlePaletteAction(colors[1].id,'highlight');assert.equal(AppState.highlightedColorId,colors[1].id);
 handlePaletteAction(colors[1].id,'highlight');assert.equal(AppState.highlightedColorId,null);
 assert.equal(AppState.palettePanelOpen,true);assert.deepEqual(AppState.pixelData,before);assert.equal(AppState.editor.undoStack.length,0);
});
for (const close of [closePalettePanel,closeAllColorsPanel]) test('closing without selecting restores exact prior eraser and current paint',()=>{
 setup();openPaletteToolSession();AppState.palettePanelOpen=close===closePalettePanel;AppState.allColorsPanelOpen=!AppState.palettePanelOpen;
 close();assert.equal(AppState.editor.activeTool,'color-eraser');assert.equal(AppState.colorEraseMode,true);assert.equal(AppState.paintColor.id,colors[2].id);assert.equal(AppState.lastBrushTool,'edge');
});
test('replacement closes and awaits click, replaces every source cell as one reversible action then restores tool',()=>{
 setup();const before=structuredClone(AppState.pixelData);openPaletteToolSession();AppState.palettePanelOpen=true;
 handlePaletteAction(colors[0].id,'pick');assert.equal(AppState.palettePanelOpen,false);assert.equal(AppState.batchReplace.active,true);assert.equal(AppState.eyedropperMode,false);
 assert.equal(startFillSelection({clientX:75,clientY:45}),false);
 handleResultCanvasClickForAdjust({clientX:75,clientY:45});
 assert.deepEqual(AppState.pixelData.map(p=>p.id),[colors[1].id,colors[1].id,colors[1].id]);
 assert.equal(AppState.editor.undoStack.length,1);assert.equal(AppState.editor.activeTool,'color-eraser');assert.equal(AppState.batchReplace.active,false);assert.equal(AppState.highlightedColorId,null);
 undoGlobalEditorOperation();assert.deepEqual(AppState.pixelData,before);redoGlobalEditorOperation();assert.equal(AppState.pixelData[2].id,colors[1].id);
});
test('same-color replacement is a no-op and restoring across patterns is rejected',()=>{
 setup();openPaletteToolSession();handlePaletteAction(colors[0].id,'pick');handleResultCanvasClickForAdjust({clientX:45,clientY:45});assert.equal(AppState.editor.undoStack.length,0);
 openPaletteToolSession();AppState.colorSelectionPatternId='another';assert.equal(restorePaletteToolSession(),false);
});
test('outside-dismiss click cannot paint or erase the canvas',()=>{
 setup();AppState.paletteDismissClickUntil=Date.now()+600;const before=structuredClone(AppState.pixelData);
 assert.equal(startFillSelection({clientX:45,clientY:45}),false);handleResultCanvasClickForAdjust({clientX:45,clientY:45});assert.deepEqual(AppState.pixelData,before);
});

for (const close of [closePalettePanel, closeAllColorsPanel]) {
 for (const restoreTool of [true, false]) test(`palette close clears eye highlight, restoreTool=${restoreTool}`, () => {
  setup();openPaletteToolSession();AppState.palettePanelOpen=close===closePalettePanel;AppState.allColorsPanelOpen=!AppState.palettePanelOpen;
  const before=structuredClone(AppState.pixelData);handlePaletteAction(colors[0].id,'highlight');close({restoreTool});
  assert.equal(AppState.highlightedColorId,null);assert.deepEqual(AppState.pixelData,before);assert.equal(AppState.editor.undoStack.length,0);
  assert.equal(AppState.editor.activeTool,restoreTool?'color-eraser':'palette');
 });
}
test('main palette toggle clears eye highlight and reopening does not restore it', () => {
 setup();openPaletteToolSession();AppState.palettePanelOpen=true;handlePaletteAction(colors[0].id,'highlight');
 toggleAllColorsPanel();assert.equal(AppState.highlightedColorId,null);assert.equal(AppState.palettePanelOpen,false);
 toggleAllColorsPanel();assert.equal(AppState.palettePanelOpen,true);assert.equal(AppState.highlightedColorId,null);
});
test('closing already-closed panels does not erase replacement source highlight', () => {
 setup();openPaletteToolSession();AppState.palettePanelOpen=true;handlePaletteAction(colors[0].id,'pick');
 closePalettePanel({restoreTool:false});closeAllColorsPanel({restoreTool:false});
 assert.equal(AppState.batchReplace.active,true);assert.equal(AppState.highlightedColorId,colors[0].id);
});
