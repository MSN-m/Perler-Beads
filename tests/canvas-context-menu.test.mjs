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
const { applyCanvasContextAction, centerCanvas, isDesktopContext } = await import('../src/features/canvas-context-menu.js');
function setup(tool='color-eraser') {
 Object.assign(AppState,{pixelData:[{...colors[0],a:255},{...colors[1],a:255},{...colors[0],a:255}],stagedPixelData:[{...colors[0],a:255},{...colors[1],a:255},{...colors[0],a:255}],gridWidth:3,gridHeight:1,renderedMinX:0,renderedMinY:0,renderedContentWidth:3,renderedContentHeight:1, zoomState:{scale:1}, colorSelectionPatternId:'palette-test',editMode:'delete',colorEraseMode:true,deleteMode:true,edgeSelectionMode:false,clearBaseMode:false,eyedropperMode:false,fillMode:false,paintColor:colors[2],fillColor:colors[2],fillColorId:colors[2].id,paintStroke:null,eraserStroke:null,eraserHoverColorId:null,eraserClickSuppressedUntil:0,paletteDismissClickUntil:0,highlightedColorId:null,paletteToolSnapshot:null,palettePanelOpen:false,allColorsPanelOpen:false,recentColors:[],stagedActions:[],lastBrushTool:'edge',lastEraserTool:'color-eraser'});
 Object.assign(AppState.editor,{activeTool:tool,undoStack:[],redoStack:[]});
 AppState.batchReplace={active:false};
}

test('context pick exits replacement and erase, remembers exact color without editing', () => {
 setup(); AppState.batchReplace={active:true,mode:'from_canvas'};
 const before=structuredClone(AppState.pixelData);
 applyCanvasContextAction('pick',1,canvas);
 assert.equal(AppState.paintColor.id,colors[1].id);
 assert.equal(AppState.editor.activeTool,'brush'); assert.equal(AppState.batchReplace.active,false);
 assert.equal(AppState.recentColors[0].id,colors[1].id);
 assert.deepEqual(AppState.pixelData,before);assert.equal(AppState.editor.undoStack.length,0);
});
test('view all switches from destructive preview to inspection, toggles and does not edit', () => {
 setup('color-eraser');const before=structuredClone(AppState.pixelData);
 applyCanvasContextAction('highlight',0,canvas);
 assert.equal(AppState.editor.activeTool,'pan');assert.equal(AppState.colorEraseMode,false);
 assert.equal(AppState.highlightedColorId,colors[0].id);
 applyCanvasContextAction('highlight',1,canvas); assert.equal(AppState.highlightedColorId,colors[1].id);
 applyCanvasContextAction('highlight',1,canvas); assert.equal(AppState.highlightedColorId,null);
 assert.deepEqual(AppState.pixelData,before);assert.equal(AppState.editor.undoStack.length,0);
});
test('context deletes only the target cell, preserves tool and one reversible history entry', () => {
 setup('bucket');const before=structuredClone(AppState.pixelData);
 assert.equal(applyCanvasContextAction('delete',0,canvas),true);
 assert.deepEqual(AppState.pixelData.map(p=>p.id),['NONE',colors[1].id,colors[0].id]);
 assert.equal(AppState.editor.activeTool,'bucket');assert.equal(AppState.editor.undoStack.length,1);
 undoGlobalEditorOperation();assert.deepEqual(AppState.pixelData,before);
 redoGlobalEditorOperation();assert.equal(AppState.pixelData[0].id,'NONE');
 assert.equal(applyCanvasContextAction('delete',0,canvas),false);
});
test('context keeps the final bead and rejects transparent or invalid targets', () => {
 setup();AppState.pixelData=[{...colors[0]}];AppState.stagedPixelData=[{...colors[0]}];
 const notice={};const original=document.getElementById;
 document.getElementById=id=>id==='eraser-status'?notice:original(id);
 assert.equal(applyCanvasContextAction('delete',0,canvas),false);
 assert.equal(notice.textContent,'图纸至少需要保留一颗豆子');
 assert.equal(AppState.editor.undoStack.length,0);assert.equal(applyCanvasContextAction('pick',-1,canvas),false);
 document.getElementById=original;
});
test('centering preserves zoom and fits center geometry; PC gate excludes touch tablet and mobile', () => {
 setup();AppState.zoomState={scale:2,x:7,y:9,fitScale:0.5};canvas.width=120;canvas.height=90;
 const original=document.getElementById;document.getElementById=id=>id==='zoom-reset-btn'?{classList:{add(){},remove(){}}}:original(id);
 centerCanvas({clientWidth:1000,clientHeight:600},canvas);
 assert.equal(AppState.zoomState.scale,2);assert.equal(AppState.zoomState.x,380);assert.equal(AppState.zoomState.y,210);
 document.getElementById=original;
 document.body.dataset.layout='workbench';window.innerWidth=1440;assert.equal(isDesktopContext(),true);
 window.innerWidth=820;assert.equal(isDesktopContext(),false);
 window.innerWidth=1180;window.matchMedia=()=>({matches:true});assert.equal(isDesktopContext(),false);
 window.innerWidth=390;assert.equal(isDesktopContext(),false);
});
