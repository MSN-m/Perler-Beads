import test from 'node:test';
import assert from 'node:assert/strict';
import { AppState } from '../src/state.js';
import { buildDraftWithVersions } from '../src/features/draft-versions.js';
import { getCurrentPatternHistory, installWorkbenchHistory, renderWorkbenchHistory } from '../src/features/history-modal.js';
const pixel = {id:'A1',r:10,g:20,b:30};
const draft = id => buildDraftWithVersions({id,name:id,gridWidth:1,gridHeight:1,brand:'mard',mardSet:221,pixelData:[pixel],updatedAt:'2026-10-08T09:30:40Z'});

test('editor history isolates current draft and its single latest automatic record',()=>{
 const a=draft('a'), b=draft('b');
 const records=[{id:'other',baseDraftId:'b',updatedAt:'2026-10-09'}, {id:'older',baseDraftId:'a',updatedAt:'2026-10-07'}, {id:'own',baseDraftId:'a',updatedAt:'2026-10-08'}];
 const before=structuredClone(records);
 const current=getCurrentPatternHistory({currentDraftId:'a',drafts:[a,b],autoSaves:records});
 assert.equal(current.draft.id,'a');assert.equal(current.versions.length,1);assert.equal(current.automatic.id,'own');assert.deepEqual(records,before);
});
test('unsaved document has no manual versions and only its own unassociated recovery record',()=>{
 const current=getCurrentPatternHistory({currentDraftId:null,colorSelectionPatternId:'new',drafts:[draft('other')],autoSaves:[{id:'associated',baseDraftId:'other',sourcePatternId:'new'}, {id:'own',baseDraftId:null,sourcePatternId:'new'}, {id:'foreign',sourcePatternId:'old'}]});
 assert.equal(current.draft,null);assert.deepEqual(current.versions,[]);assert.equal(current.automatic.id,'own');
});
test('legacy version remains available and corrupt compact version cannot be restored',()=>{
 const legacy={...draft('a'),versions:[]};assert.equal(getCurrentPatternHistory({drafts:[legacy],currentDraftId:'a'}).versions[0].versionId,null);
 const corrupt=draft('b');corrupt.versions[0].indices=[999];
 assert.equal(getCurrentPatternHistory({drafts:[corrupt],currentDraftId:'b'}).versions[0].data,null);
});

function harness({automatic=false}={}) {
 const original={document:globalThis.document,HTMLElement:globalThis.HTMLElement};
 class Element {
  hidden=true;inert=false;isConnected=true;textContent='';innerHTML='';dataset={};listeners={};
  focus(){document.activeElement=this;}
  addEventListener(type,fn){this.listeners[type]=fn;}
  querySelectorAll(){return this.controls||[];}
  removeAttribute(){}
  fire(type,event={}){return this.listeners[type]?.({target:this,preventDefault(){},stopImmediatePropagation(){},...event});}
 }
 const ids=['workbench-history-modal','history-main-dialog','history-preview-dialog','history-confirm-dialog','history-version-list','history-automatic-record','history-error','history-preview-image','history-preview-caption','history-confirm-title','history-confirm-description','history-confirm-cancel','history-confirm-restore'];
 const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const close=new Element(), back=new Element(), background=new Element();
 const firstFocus=new Element();firstFocus.hidden=false;
 const overlay=nodes['workbench-history-modal'];
 overlay.querySelectorAll=selector=>selector==='[data-history-close]'?[close]:[back,nodes['history-confirm-cancel']];
 const main=nodes['history-main-dialog'];main.controls=[close];
 nodes['history-confirm-dialog'].controls=[nodes['history-confirm-cancel'],nodes['history-confirm-restore']];
 const docListeners={};
 globalThis.HTMLElement=Element;
 globalThis.document={body:{children:[background,overlay]},activeElement:firstFocus,getElementById:id=>nodes[id],addEventListener:(type,fn)=>{docListeners[type]=fn;},createElement:()=>({getContext:()=>({fillRect(){}}),toDataURL:()=> 'data:image/png;base64,AAAA'})};
 const saved=draft('own');
 Object.assign(AppState,{currentStep:3,pixelData:[pixel],colorSelectionPatternId:'pattern',currentDraftId:'own',drafts:[saved,draft('other')],patternName:'当前图纸',autoSaveError:false,draftDrawerOpen:true,autoSaves:automatic?[{...saved,id:'auto-own',baseDraftId:'own',sourcePatternId:'pattern'}]:[]});
 const calls=[];let updated=0;
 installWorkbenchHistory({updateUI:()=>{updated++;renderWorkbenchHistory();},restore:(...args)=>{calls.push(args);return true;}});
 const button=(attribute,index='0')=>({dataset:{[attribute]:index},disabled:false,isConnected:true,focus(){document.activeElement=this;}});
 return {nodes,overlay,background,firstFocus,calls,close,back,button,docListeners,get updated(){return updated;},cleanup(){globalThis.document=original.document;globalThis.HTMLElement=original.HTMLElement;}};
}
test('opening isolates background and closing restores focus without changing editor data',()=>{
 const h=harness();const before=structuredClone(AppState.pixelData);
 try{assert.equal(h.overlay.hidden,false);assert.equal(h.background.inert,true);assert.match(h.nodes['history-version-list'].innerHTML,/最新保存/);h.close.fire('click');assert.equal(h.overlay.hidden,true);assert.equal(h.background.inert,false);assert.equal(document.activeElement,h.firstFocus);assert.deepEqual(AppState.pixelData,before);assert.equal(h.calls.length,0);}finally{h.cleanup();}
});
test('version restore waits for confirmation, cancel preserves data, confirm restores once',()=>{
 const h=harness();
 try{const button=h.button('historyRestore');h.nodes['history-version-list'].fire('click',{target:{closest:()=>button}});assert.equal(h.calls.length,0);assert.equal(h.nodes['history-confirm-dialog'].hidden,false);h.nodes['history-confirm-cancel'].fire('click');assert.equal(h.calls.length,0);assert.equal(h.nodes['history-main-dialog'].hidden,false);
 h.nodes['history-version-list'].fire('click',{target:{closest:()=>button}});h.nodes['history-confirm-restore'].fire('click');assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'own');assert.equal(h.calls[0][2],false);assert.deepEqual(h.calls[0][3],{confirmed:true});assert.equal(h.overlay.hidden,true);h.nodes['history-confirm-restore'].fire('click');assert.equal(h.calls.length,1);}finally{h.cleanup();}
});
test('automatic restore is enabled in editing but requires confirmation',()=>{
 const h=harness({automatic:true});
 try{const button=h.button('historyAutomatic');h.nodes['history-automatic-record'].fire('click',{target:{closest:()=>button}});assert.equal(h.calls.length,0);assert.match(h.nodes['history-confirm-title'].textContent,/自动保存/);h.nodes['history-confirm-restore'].fire('click');assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'auto-own');assert.equal(h.calls[0][2],true);}finally{h.cleanup();}
});
test('document change while confirmation is pending never restores the stale target',()=>{
 const h=harness({automatic:true});
 try{h.nodes['history-automatic-record'].fire('click',{target:{closest:()=>h.button('historyAutomatic')}});AppState.colorSelectionPatternId='different';h.nodes['history-confirm-restore'].fire('click');assert.equal(h.calls.length,0);assert.equal(h.overlay.hidden,true);}finally{h.cleanup();}
});
test('preview renders saved pixels and Escape returns to list before closing',()=>{
 const h=harness();
 try{h.nodes['history-version-list'].fire('click',{target:{closest:()=>h.button('historyPreview')}});assert.equal(h.nodes['history-preview-dialog'].hidden,false);assert.equal(h.calls.length,0);h.docListeners.keydown({key:'Escape',preventDefault(){},stopImmediatePropagation(){}});assert.equal(h.nodes['history-main-dialog'].hidden,false);assert.equal(h.overlay.hidden,false);h.docListeners.keydown({key:'Escape',preventDefault(){},stopImmediatePropagation(){}});assert.equal(h.overlay.hidden,true);}finally{h.cleanup();}
});
