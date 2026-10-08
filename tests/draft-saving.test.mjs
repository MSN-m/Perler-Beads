import test from 'node:test';
import assert from 'node:assert/strict';
import {AppState} from '../src/state.js';
import {getCurrentPalette,resetPatternColorSelection} from '../src/editor.js';
const records=new Map();let fail=false;const alerts=[];
const db={close(){},transaction(){const tx={objectStore:()=>({
 getAll(){const request={};queueMicrotask(()=>{request.result=[...records.values()].map(x=>structuredClone(x));request.onsuccess();});return request;},
 delete(id){queueMicrotask(()=>{if(fail){tx.error=new Error('quota');tx.onabort();}else{records.delete(id);tx.oncomplete();}});},
 put(value){queueMicrotask(()=>{if(fail){tx.error=new Error('quota');tx.onabort();}else{records.set(value.id,structuredClone(value));tx.oncomplete();}});}
})};return tx;}};
globalThis.window={indexedDB:{open(){const request={};queueMicrotask(()=>{request.result=db;request.onsuccess();});return request;}},alert:message=>alerts.push(message),confirm:()=>true};
const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{})});
const canvas={id:'result-canvas',getContext:()=>ctx};const stats=Object.fromEntries(['total-beads-count','color-types-count','color-stats'].map(id=>[id,{}]));
globalThis.document={body:{dataset:{layout:'test'}},readyState:'loading',getElementById:id=>id==='result-canvas'?canvas:stats[id]||null,querySelectorAll:()=>[],querySelector:()=>({classList:{add(){}},querySelectorAll:()=>[]}),addEventListener(){},createElement:()=>({getContext:()=>ctx,toDataURL:()=> 'thumb'})};
globalThis.requestAnimationFrame=()=>{};
const {saveWorkbenchDraft,saveWorkbenchDraftAs,hasUnsavedWorkbenchChanges,saveWorkbenchAutomatically,installWorkbenchAutoSave,downloadAndSaveWorkbenchDraft,warnBeforeWorkbenchUnload,returnFromWorkbench,restoreWorkbenchDraft,importWorkbenchDraftFile}=await import('../src/ui.js');
const colors=getCurrentPalette().slice(0,3).map(p=>({...p,a:255}));
function setup(){Object.assign(AppState,{pixelData:[{...colors[0]},{...colors[1]}],stagedPixelData:null,stagedActions:[],gridWidth:2,gridHeight:1,currentDraftId:null,currentDraftVersionId:null,draftRestorePending:false,patternName:'测试草稿',drafts:[],autoSaves:[],autoSaveError:false,paintStroke:null,eraserStroke:null,image:null,edgeSelectionMode:false,qualityOverlayVisible:false,fillSelection:null});resetPatternColorSelection();records.clear();fail=false;alerts.length=0;}
test('save updates one identity, save-as copies, restore version retains newer data; imported history survives',async()=>{
 setup();assert.equal(await saveWorkbenchDraft(),true);const id=AppState.currentDraftId;const first=AppState.drafts[0].versions[0].id;
 assert.equal(await saveWorkbenchDraft(),true);assert.equal(records.size,1);assert.equal(AppState.drafts[0].versions.length,1);
 AppState.pixelData[0]={...colors[2]};await saveWorkbenchDraft();assert.equal(AppState.currentDraftId,id);assert.equal(records.size,1);assert.equal(AppState.drafts[0].versions.length,2);
 const latest=AppState.drafts[0].versions[0].id;restoreWorkbenchDraft(id,first);assert.equal(AppState.pixelData[0].id,colors[0].id);assert.equal(AppState.currentDraftId,id);assert.equal(AppState.drafts[0].versions[0].id,latest);
 await saveWorkbenchDraft();assert.equal(AppState.drafts[0].versions.length,3);assert.equal(AppState.drafts[0].versions[1].id,latest);
 await saveWorkbenchDraft({saveAs:true,name:'副本'});const copy=AppState.currentDraftId;assert.notEqual(copy,id);assert.equal(records.size,2);assert.equal(AppState.drafts[0].versions.length,1);
 AppState.pixelData[0]={...colors[1]};await saveWorkbenchDraft();assert.equal(records.size,2);assert.equal(AppState.currentDraftId,copy);assert.equal(records.get(id).versions.length,3);
 const payload=structuredClone(records.get(id));await importWorkbenchDraftFile({text:async()=>JSON.stringify(payload)});assert.equal(AppState.drafts[0].versions.length,3);
});
test('aborted storage transaction leaves pixels, draft list and saved identity untouched',async()=>{
 setup();fail=true;const before=structuredClone(AppState.pixelData);assert.equal(await saveWorkbenchDraft(),false);
 assert.equal(records.size,0);assert.equal(AppState.currentDraftId,null);assert.equal(AppState.drafts.length,0);assert.deepEqual(AppState.pixelData,before);assert.equal(alerts.length,1);
 fail=false;assert.equal(await saveWorkbenchDraft(),true);
});

function namingDialog() {
 const elements={};
 for(const id of ['modal','form','name','cancel','submit','error']) {
  const listeners=new Map();const classes=new Set(['hidden']);
  elements['draft-save-as-'+id]={value:'',disabled:false,textContent:'',isConnected:true,
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
   focus(){document.activeElement=this;},select(){this.selected=true;},
   addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},
   async fire(type,extra={}){const event={target:this,preventDefault(){this.prevented=true;},stopPropagation(){},...extra};await listeners.get(type)?.(event);return event;}
  };
 }
 const original=document.getElementById;
 document.getElementById=id=>elements[id]||original(id);
 return {elements,cleanup:()=>{document.getElementById=original;}};
}
test('save-as page dialog validates, submits once, creates copy, and cancels without native prompt',async()=>{
 setup();await saveWorkbenchDraft();const originalId=AppState.currentDraftId;
 const {elements,cleanup}=namingDialog();
 const modal=elements['draft-save-as-modal'],form=elements['draft-save-as-form'],input=elements['draft-save-as-name'];
 try {
  const pending=saveWorkbenchDraftAs();assert.equal(saveWorkbenchDraftAs(),pending);
  assert.equal(modal.classList.contains('hidden'),false);assert.equal(input.value,'测试草稿（副本）');assert.equal(input.selected,true);
  input.value='  ';assert.equal((await form.fire('submit')).prevented,true);assert.equal(records.size,1);assert.equal(elements['draft-save-as-error'].textContent,'请输入草稿名称');
  input.value=' 新副本 ';const submission=form.fire('submit');await form.fire('submit');await submission;
  assert.equal(await pending,true);assert.equal(records.size,2);assert.notEqual(AppState.currentDraftId,originalId);assert.equal(AppState.patternName,'新副本');assert.equal(modal.classList.contains('hidden'),true);
  const failedSave=saveWorkbenchDraftAs();fail=true;input.value='失败副本';await form.fire('submit');
  assert.equal(records.size,2);assert.equal(modal.classList.contains('hidden'),false);assert.equal(input.disabled,false);
  assert.match(elements['draft-save-as-error'].textContent,/保存失败/);assert.equal(alerts.length,0);
  await elements['draft-save-as-cancel'].fire('click');assert.equal(await failedSave,false);fail=false;
  const canceled=saveWorkbenchDraftAs();await modal.fire('keydown',{key:'Escape'});assert.equal(await canceled,false);assert.equal(records.size,2);
  const clickedCancel=saveWorkbenchDraftAs();await elements['draft-save-as-cancel'].fire('click');assert.equal(await clickedCancel,false);
  const backdropCancel=saveWorkbenchDraftAs();await modal.fire('click');assert.equal(await backdropCancel,false);
 } finally {cleanup();}
});

test('return warning compares content with saved draft, including undo and older saved versions',async()=>{
 setup();assert.equal(hasUnsavedWorkbenchChanges(),true);await saveWorkbenchDraft();assert.equal(hasUnsavedWorkbenchChanges(),false);
 AppState.zoomState.x=99;AppState.highlightedColorId=colors[0].id;assert.equal(hasUnsavedWorkbenchChanges(),false);
 const saved=structuredClone(AppState.pixelData);AppState.stagedPixelData=structuredClone(saved);AppState.stagedPixelData[0]={...colors[2]};assert.equal(hasUnsavedWorkbenchChanges(),true);
 AppState.stagedPixelData=structuredClone(saved);assert.equal(hasUnsavedWorkbenchChanges(),false);AppState.stagedPixelData=null;
 AppState.patternName='新名称';assert.equal(hasUnsavedWorkbenchChanges(),true);AppState.patternName='测试草稿';
 const first=AppState.drafts[0].versions[0].id;AppState.pixelData[0]={...colors[2]};await saveWorkbenchDraft();restoreWorkbenchDraft(AppState.currentDraftId,first);assert.equal(hasUnsavedWorkbenchChanges(),true);
});
test('return dialog cancels or stays open on storage failure, without native browser dialogs',async()=>{
 setup();const nodes={};
 for(const id of ['modal','save','discard','cancel','error']){
  const listeners=new Map();const classes=new Set(['hidden']);nodes['workbench-exit-'+id]={disabled:false,textContent:'',isConnected:true,
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},focus(){document.activeElement=this;},
   addEventListener(t,f){listeners.set(t,f);},removeEventListener(t){listeners.delete(t);},async fire(type,extra={}){await listeners.get(type)?.({target:this,preventDefault(){},stopPropagation(){},...extra});}
  };
 }
 const original=document.getElementById;document.getElementById=id=>nodes[id]||original(id);
 try{
  const pending=returnFromWorkbench();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes['workbench-exit-modal'].classList.contains('hidden'),false);
  fail=true;await nodes['workbench-exit-save'].fire('click');assert.equal(records.size,0);assert.equal(AppState.pixelData.length,2);assert.match(nodes['workbench-exit-error'].textContent,/保存失败/);assert.equal(alerts.length,0);
  await nodes['workbench-exit-modal'].fire('keydown',{key:'Escape'});assert.equal(await pending,false);assert.equal(AppState.pixelData.length,2);
  AppState.paintStroke={};assert.equal(await returnFromWorkbench(),false);AppState.paintStroke=null;
 }finally{document.getElementById=original;fail=false;}
});
test('return saves before exiting, discard preserves saved drafts, clean draft exits directly',async()=>{
 const original=document.getElementById,layout=document.body.dataset.layout,originalQuery=document.querySelector;
 let activated=null;document.querySelector=selector=>({classList:{add(){activated=selector;}},querySelectorAll:()=>[]});
 const nodes={};for(const id of ['modal','save','discard','cancel','error']){
  const listeners=new Map();nodes['workbench-exit-'+id]={classList:{add(){},remove(){}},focus(){document.activeElement=this;},
   addEventListener(t,f){listeners.set(t,f);},removeEventListener(t){listeners.delete(t);},async fire(){await listeners.get('click')?.({target:this});}};
 }
 document.getElementById=id=>nodes[id]||(id==='result-canvas'?canvas:null);
 canvas.classList={toggle(){},add(){},remove(){}};canvas.style={};
 window.innerWidth=1280;window.innerHeight=900;window.matchMedia=()=>({matches:false});
 try {
  setup();document.body.dataset.layout='workbench';
  const saved=returnFromWorkbench();await new Promise(resolve=>setImmediate(resolve));await nodes['workbench-exit-save'].fire();assert.equal(await saved,true);
  assert.equal(records.size,1);assert.equal(AppState.currentStep,1);assert.equal(activated,'#step-settings');assert.equal(AppState.pixelData.length,0);assert.equal(AppState.stagedPixelData,null);assert.equal(AppState.currentDraftId,null);
  document.body.dataset.layout='test';setup();await saveWorkbenchDraft();const savedId=AppState.currentDraftId;AppState.pixelData[0]={...colors[2]};document.body.dataset.layout='workbench';
  const discarded=returnFromWorkbench();await new Promise(resolve=>setImmediate(resolve));await nodes['workbench-exit-discard'].fire();assert.equal(await discarded,true);assert.equal(activated,'#step-settings');assert.equal(records.get(savedId).pixelData[0].id,colors[0].id);assert.equal(AppState.pixelData.length,0);
  document.body.dataset.layout='test';setup();await saveWorkbenchDraft();document.body.dataset.layout='workbench';assert.equal(await returnFromWorkbench(),true);assert.equal(AppState.currentStep,1);assert.equal(activated,'#step-settings');assert.equal(records.size,1);
 } finally {document.getElementById=original;document.body.dataset.layout=layout;document.querySelector=originalQuery;}
});

test('automatic recovery overwrites one separate record, skips unchanged, and manual save clears it without extra history',async()=>{
 setup();assert.equal(await saveWorkbenchAutomatically(),true);assert.equal(records.size,1);assert.equal(AppState.drafts.length,0);assert.equal(AppState.currentDraftId,null);
 const autoId=AppState.autoSaves[0].id,stamp=AppState.autoSaves[0].updatedAt;assert.equal(AppState.autoSaves[0].versions,undefined);
 await saveWorkbenchAutomatically();assert.equal(AppState.autoSaves[0].updatedAt,stamp);
 AppState.pixelData[0]={...colors[2]};await saveWorkbenchAutomatically();assert.equal(records.size,1);assert.equal(AppState.autoSaves[0].id,autoId);assert.equal(AppState.autoSaves[0].pixelData[0].id,colors[2].id);
 await saveWorkbenchDraft();const manualId=AppState.currentDraftId;assert.equal(records.size,1);assert.equal(AppState.autoSaves.length,0);assert.equal(AppState.drafts[0].versions.length,1);
 AppState.pixelData[0]={...colors[1]};await saveWorkbenchAutomatically();assert.equal(records.size,2);assert.equal(AppState.currentDraftId,manualId);assert.equal(AppState.drafts[0].versions.length,1);
 const recoveryId=AppState.autoSaves[0].id;AppState.pixelData=[];restoreWorkbenchDraft(recoveryId,null,true);assert.equal(AppState.pixelData[0].id,colors[1].id);assert.equal(AppState.currentDraftId,manualId);assert.equal(AppState.drafts[0].pixelData[0].id,colors[2].id);
 await saveWorkbenchDraft();assert.equal(records.size,1);assert.equal(AppState.drafts[0].versions.length,2);
});
test('automatic save skips live strokes and reports failure while keeping previous recovery data',async()=>{
 setup();AppState.paintStroke={};assert.equal(await saveWorkbenchAutomatically(),false);assert.equal(records.size,0);AppState.paintStroke=null;
 await saveWorkbenchAutomatically();const previous=structuredClone(AppState.autoSaves[0]);AppState.pixelData[0]={...colors[2]};fail=true;
 assert.equal(await saveWorkbenchAutomatically(),false);assert.equal(AppState.autoSaveError,true);assert.deepEqual(AppState.autoSaves[0],previous);assert.equal(AppState.pixelData[0].id,colors[2].id);assert.equal(alerts.length,0);fail=false;
});

test('five-minute timer installs once, defers busy gestures, and saves after the gesture ends',async()=>{
 setup();let callback,count=0,now=0;const clock=Date.now,interval=window.setInterval;
 Date.now=()=>now;window.setInterval=(fn,period)=>{callback=fn;count++;assert.equal(period,15000);return 42;};
 try{
  AppState.currentStep=3;installWorkbenchAutoSave();installWorkbenchAutoSave();assert.equal(count,1);
  now=299999;await callback();assert.equal(records.size,0);
  AppState.eraserStroke={};now=300000;await callback();assert.equal(records.size,0);
  AppState.eraserStroke=null;now=315000;await callback();assert.equal(records.size,1);assert.equal(AppState.drafts.length,0);
  AppState.pixelData[0]={...colors[2]};now=400000;await callback();assert.equal(AppState.autoSaves[0].pixelData[0].id,colors[0].id);
  now=615000;await callback();assert.equal(records.size,1);assert.equal(AppState.autoSaves[0].pixelData[0].id,colors[2].id);
 }finally{Date.now=clock;window.setInterval=interval;}
});

test('undo back to the manual save removes stale automatic recovery on the next check',async()=>{
 setup();await saveWorkbenchDraft();const baseline=structuredClone(AppState.pixelData);AppState.pixelData[0]={...colors[2]};await saveWorkbenchAutomatically();assert.equal(AppState.autoSaves.length,1);
 AppState.pixelData=baseline;await saveWorkbenchAutomatically();assert.equal(AppState.autoSaves.length,0);assert.equal(records.size,1);assert.equal(AppState.drafts[0].versions.length,1);
});

test('export saves the matching staged diagram, repeated export does not duplicate versions, later edits warn on exit',async()=>{
 setup();let downloads=0;AppState.stagedPixelData=structuredClone(AppState.pixelData);AppState.stagedPixelData[0]={...colors[2]};
 const initial=AppState.pixelData;assert.equal(await downloadAndSaveWorkbenchDraft(()=>{downloads++;assert.equal(AppState.pixelData[0].id,colors[2].id);}),true);
 assert.equal(AppState.pixelData,initial);assert.equal(records.size,1);assert.equal(AppState.drafts[0].pixelData[0].id,colors[2].id);assert.equal(hasUnsavedWorkbenchChanges(),false);
 await downloadAndSaveWorkbenchDraft(()=>downloads++);assert.equal(records.size,1);assert.equal(AppState.drafts[0].versions.length,1);assert.equal(downloads,2);
 const clean={preventDefault(){this.prevented=true;}};warnBeforeWorkbenchUnload(clean);assert.equal(clean.prevented,undefined);
 AppState.stagedPixelData[0]={...colors[1]};const dirty={preventDefault(){this.prevented=true;}};warnBeforeWorkbenchUnload(dirty);assert.equal(dirty.prevented,true);assert.equal(dirty.returnValue,'');
});
test('failed draft save still triggers download and retains exit warning; failed export does not mark saved',async()=>{
 setup();fail=true;let downloads=0;assert.equal(await downloadAndSaveWorkbenchDraft(()=>downloads++),false);assert.equal(downloads,1);assert.equal(hasUnsavedWorkbenchChanges(),true);assert.equal(alerts.length,0);fail=false;
 assert.equal(await downloadAndSaveWorkbenchDraft(()=>{throw new Error('export failed');}),false);assert.equal(records.size,0);assert.equal(hasUnsavedWorkbenchChanges(),true);
});

test('editor automatic recovery requires confirmation and rejects another document record',async()=>{
 setup();await saveWorkbenchDraft();const id=AppState.currentDraftId;
 AppState.pixelData[0]={...colors[2]};await saveWorkbenchAutomatically();
 const own=structuredClone(AppState.autoSaves[0]);
 AppState.pixelData[0]={...colors[1]};const before=structuredClone(AppState.pixelData);
 assert.equal(restoreWorkbenchDraft(own.id,null,true),false);assert.deepEqual(AppState.pixelData,before);
 AppState.autoSaves.push({...own,id:'other-auto',baseDraftId:'another-draft'});
 assert.equal(restoreWorkbenchDraft('other-auto',null,true,{confirmed:true}),false);assert.deepEqual(AppState.pixelData,before);
 assert.equal(restoreWorkbenchDraft(own.id,null,true,{confirmed:true}),true);
 assert.equal(AppState.currentDraftId,id);assert.equal(AppState.pixelData[0].id,colors[2].id);
 assert.equal(records.get(id).versions.length,1);assert.equal(AppState.autoSaves.some(record=>record.id===own.id),true);
 assert.equal(hasUnsavedWorkbenchChanges(),true);
 await saveWorkbenchDraft();assert.equal(records.get(id).versions.length,2);assert.equal(AppState.autoSaves.some(record=>record.id===own.id),false);
});
test('failed changed save does not trim an existing ten-version history',async()=>{
 setup();await saveWorkbenchDraft();const saved=AppState.drafts[0];
 saved.versions=Array.from({length:10},(_,i)=>({...structuredClone(saved.versions[0]),id:`old-${i}`}));
 records.set(saved.id,structuredClone(saved));
 const previous=structuredClone(saved);AppState.pixelData[0]={...colors[2]};fail=true;
 assert.equal(await saveWorkbenchDraft(),false);assert.deepEqual(AppState.drafts[0],previous);assert.deepEqual(records.get(saved.id),previous);
 fail=false;assert.equal(await saveWorkbenchDraft(),true);assert.equal(AppState.drafts[0].versions.length,5);assert.equal(records.get(saved.id).versions.length,5);
});
