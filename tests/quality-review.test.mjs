import test from 'node:test';
import assert from 'node:assert/strict';
import { findSingletons, isSingleton, suggestRepairs, pixelSignature } from '../src/features/quality-analysis.js';
import { AppState } from '../src/state.js';
import { commitQualityRepairs } from '../src/features/quality.js';
import { undoGlobalEditorOperation, redoGlobalEditorOperation, mirrorEditorHistory, mirrorPixelRows } from '../src/editor.js';
const color = id => id === 'NONE' ? {id,r:0,g:0,b:0,a:0} : {id,r:id.charCodeAt(0),g:90,b:130,a:255};
const cells = ids => ids.map(color);
const empty = n => Array.from({length:n},()=>color('NONE'));
const target = (pixels,width,height,index) => findSingletons(pixels,width,height).filter(item=>item.index===index);

test('eight-neighbor singleton definition preserves diagonal details and skips transparent cells',()=>{
 const p=empty(9);p[0]=color('A');p[4]=color('A');p[8]=color('B');
 assert.deepEqual(findSingletons(p,3,3).map(i=>i.index),[8]);
 assert.equal(isSingleton(p,4,3,3),false);
});
test('edge neighbors never wrap across rows; one-row and invalid grids are safe',()=>{
 const p=empty(6);p[2]=color('A');p[3]=color('A');
 assert.deepEqual(findSingletons(p,3,2).map(i=>i.index),[2,3]);
 assert.equal(findSingletons(cells(['A','B','B']),3,1).length,1);
 assert.deepEqual(findSingletons(p,0,2),[]);assert.deepEqual(findSingletons(p,2,2),[]);
});
test('unique majority recommends an existing neighboring color and does not mutate snapshot',()=>{
 const p=cells(['B','B','C','B','A','C','B','B','D']), before=structuredClone(p);
 const [plan]=suggestRepairs(p,3,3,target(p,3,3,4));
 assert.equal(plan.nextColor.id,'B');assert.equal(plan.recommended,true);assert.deepEqual(p,before);
});
test('plurality without majority is opt-in and tied winners require manual handling',()=>{
 let p=cells(['B','B','C','B','A','C','B','D','C']);
 let [plan]=suggestRepairs(p,3,3,target(p,3,3,4));
 assert.equal(plan.nextColor.id,'B');assert.equal(plan.recommended,false);
 p=cells(['B','B','C','B','A','C','B','C','C']);
 [plan]=suggestRepairs(p,3,3,target(p,3,3,4));assert.equal(plan.kind,'manual');assert.equal(plan.nextColor,undefined);
});
test('transparent neighbors do not vote and erased suggestions cannot clear the entire pattern',()=>{
 const p=empty(25);p[0]=color('A');p[24]=color('B');
 const plans=suggestRepairs(p,5,5,findSingletons(p,5,5));
 assert.equal(plans.filter(i=>i.recommended).length,1);assert.equal(plans[1].blocked,true);
 assert.equal(plans[0].nextColor.id,'NONE');
 const one=empty(9);one[4]=color('A');assert.equal(suggestRepairs(one,3,3,findSingletons(one,3,3))[0].blocked,true);
});
test('ignored or changed items are excluded; transparent cells cannot become target colors',()=>{
 const p=empty(9);p[0]=color('A');p[8]=color('B');
 const items=findSingletons(p,3,3);items[1].ignored=true;
 const plans=suggestRepairs(p,3,3,items);assert.equal(plans.length,1);assert.equal(plans[0].blocked,undefined);
 p[0]=color('C');assert.equal(suggestRepairs(p,3,3,items).length,0);
});
function fixture(){
 const width=14,height=6,p=empty(width*height);
 for(let y=0;y<3;y++) for(let x=0;x<3;x++){p[y*width+x]=color('B');p[y*width+x+5]=color('E');}
 p[width+1]=color('A');p[width+6]=color('C');p[5*width+13]=color('F');
 Object.assign(AppState,{pixelData:structuredClone(p),stagedPixelData:structuredClone(p),gridWidth:width,gridHeight:height,stagedActions:[],paintStroke:null,eraserStroke:null,fillSelection:null,zoomState:{isDragging:false}});
 Object.assign(AppState.editor,{undoStack:[],redoStack:[],hasChanges:false});
 return {p,width,height,plans:suggestRepairs(p,width,height,findSingletons(p,width,height))};
}
test('mixed recolors and erase commit once, sync staged data and undo/redo every original field',()=>{
 const f=fixture();assert.equal(f.plans.length,3);
 assert.equal(commitQualityRepairs(f.plans,pixelSignature(f.p)),true);
 assert.equal(AppState.editor.undoStack.length,1);assert.equal(AppState.stagedActions.length,1);
 assert.equal(AppState.pixelData[15].id,'B');assert.equal(AppState.pixelData[20].id,'E');assert.equal(AppState.pixelData[83].id,'NONE');
 assert.deepEqual(AppState.pixelData,AppState.stagedPixelData);
 const after=structuredClone(AppState.pixelData);undoGlobalEditorOperation();assert.deepEqual(AppState.pixelData,f.p);
 redoGlobalEditorOperation();assert.deepEqual(AppState.pixelData,after);
});
test('suggestions use the same snapshot regardless of issue order',()=>{
 const f=fixture();const a=suggestRepairs(f.p,f.width,f.height,findSingletons(f.p,f.width,f.height));
 const b=suggestRepairs(f.p,f.width,f.height,findSingletons(f.p,f.width,f.height).reverse());
 assert.deepEqual(a.map(i=>[i.index,i.nextColor.id]).sort(),b.map(i=>[i.index,i.nextColor.id]).sort());
});
test('stale snapshots, empty selection, busy gestures and clearing last bead refuse without history',()=>{
 let f=fixture();AppState.stagedPixelData[0]=color('Z');assert.equal(commitQualityRepairs(f.plans,pixelSignature(f.p)),false);assert.equal(AppState.editor.undoStack.length,0);
 f=fixture();assert.equal(commitQualityRepairs([],pixelSignature(f.p)),false);AppState.paintStroke={};assert.equal(commitQualityRepairs(f.plans,pixelSignature(f.p)),false);
 fixture();AppState.pixelData=AppState.stagedPixelData=cells(['A']);AppState.gridWidth=1;AppState.gridHeight=1;
 assert.equal(commitQualityRepairs([{index:0,colorId:'A',nextColor:color('NONE')}],pixelSignature(AppState.pixelData)),false);
});
test('mixed batch undo and redo remain aligned after mirroring',()=>{
 const f=fixture();commitQualityRepairs(f.plans,pixelSignature(f.p));
 const repaired=structuredClone(AppState.pixelData);
 AppState.pixelData=mirrorPixelRows(AppState.pixelData,f.width);AppState.stagedPixelData=mirrorPixelRows(AppState.stagedPixelData,f.width);mirrorEditorHistory(f.width);
 undoGlobalEditorOperation();assert.deepEqual(AppState.pixelData,mirrorPixelRows(f.p,f.width));
 redoGlobalEditorOperation();assert.deepEqual(AppState.pixelData,mirrorPixelRows(repaired,f.width));
});

test('adjacent isolated colors use frozen suggestions without cascading or promising elimination',()=>{
 const p=cells(['A','B']);const plan=suggestRepairs(p,2,1,findSingletons(p,2,1));
 assert.deepEqual(plan.map(item=>item.nextColor.id),['B','A']);
 assert.deepEqual(p.map(item=>item.id),['A','B']);
});
