import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftWithVersions, unpackDraftVersion } from '../src/features/draft-versions.js';
const pixel = (id='A') => ({id,r:20,g:30,b:40,a:255});
const draft = (id='A', image='image-a') => ({id:'draft-1',name:'草稿1',patternName:'草稿1',gridWidth:2,gridHeight:1,brand:'mard',mardSet:221,pixelData:[pixel(id),pixel('NONE')],updatedAt:new Date().toISOString(),sourceImageDataUrl:image,colorSelection:{patternId:'x',currentColorId:id,updatedAt:1},generationSettings:{'max-colors-slider':'20'}});
test('saved versions round trip pixels, alpha, dimensions, image and settings',()=>{
 const current=buildDraftWithVersions(draft());const restored=unpackDraftVersion(current,current.versions[0]);
 assert.deepEqual(restored.pixelData,current.pixelData);assert.equal(restored.sourceImageDataUrl,'image-a');assert.deepEqual(restored.generationSettings,current.generationSettings);
});
test('unchanged saves do not create versions, including selection timestamps',()=>{
 const first=buildDraftWithVersions(draft());const next={...draft(),colorSelection:{...first.colorSelection,updatedAt:42}};
 assert.equal(buildDraftWithVersions(next,first).versions.length,1);
});
test('legacy draft is retained as first historical version',()=>{
 const saved=buildDraftWithVersions(draft('B'),draft('A'));assert.equal(saved.versions.length,2);
 assert.equal(unpackDraftVersion(saved,saved.versions[1]).pixelData[0].id,'A');
});
test('ten-version cap and restoring old state preserves newer versions',()=>{
 let saved=null;for(let i=0;i<15;i++) saved=buildDraftWithVersions(draft(String(i)),saved);
 assert.equal(saved.versions.length,10);const newest=saved.versions[0].id;
 const historical=unpackDraftVersion(saved,saved.versions[3]);saved=buildDraftWithVersions({...historical,updatedAt:new Date().toISOString()},saved);
 assert.equal(saved.versions.length,10);assert.equal(saved.versions[1].id,newest);assert.equal(unpackDraftVersion(saved,saved.versions[0]).pixelData[0].id,'11');
});
test('shared current image occurs once; changed source images remain recoverable',()=>{
 let saved=buildDraftWithVersions(draft('A'));saved=buildDraftWithVersions(draft('B'),saved);assert.deepEqual(saved.versionSources,{});
 assert.equal(JSON.stringify(saved).split('image-a').length-1,1);
 saved=buildDraftWithVersions(draft('C','image-b'),saved);assert.equal(Object.keys(saved.versionSources).length,1);
 assert.equal(unpackDraftVersion(saved,saved.versions[2]).sourceImageDataUrl,'image-a');
 saved=buildDraftWithVersions(draft('D','image-a'),saved);assert.equal(Object.keys(saved.versionSources).length,1);
 assert.equal(unpackDraftVersion(saved,saved.versions[1]).sourceImageDataUrl,'image-b');
});
test('corrupt compact data is rejected',()=>{
 const saved=buildDraftWithVersions(draft());assert.throws(()=>unpackDraftVersion(saved,{...saved.versions[0],indices:[999,0]}));
});
