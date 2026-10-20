import {test} from 'node:test';import assert from 'node:assert/strict';
import {ownFixture} from './own-model-fixture.mjs';import {ownRecord} from '../own-model.mjs';
import {ownModelResponse,publishOwnModel} from '../own-model-server.mjs';
test('GET-only own model route serves verified private data and never runs Python',async()=>{
 const {doc,bs,fixtures,now}=ownFixture(),fetcher=async url=>Response.json(String(url).includes('bootstrap')?bs:fixtures),store={read:async()=>ownRecord(doc)};
 const r=await ownModelResponse(new Request('https://site.test/api/own-model'),{storeFactory:async()=>store,fetcher,clock:()=>now});assert.equal(r.status,200);assert.equal((await r.json()).players['1'].xp,5);
 const rejected=await ownModelResponse(new Request('https://site.test/api/own-model',{method:'POST'}),{clock:()=>now});assert.equal(rejected.status,405);
 assert.equal(await ownModelResponse(new Request('https://site.test/api/entry/1')) ,null);
 const unavailable=await ownModelResponse(new Request('https://site.test/api/own-model'),{storeFactory:async()=>({read:async()=>{throw Error();}}),fetcher,clock:()=>now});assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('cache-control'),'no-store');
});
test('publisher preserves first forecast and detects deadline races',async()=>{
 const {doc,bs,fixtures,now}=ownFixture(),records=new Map(),store={read:async k=>records.get(k),write:async(k,v)=>records.set(k,v)},archive={...store,write:async(k,v)=>{if(records.has(k))throw Error('exists');records.set(k,v);}},fetcher=async url=>Response.json(String(url).includes('bootstrap')?bs:fixtures);
 await publishOwnModel({doc,store,archive,fetcher,clock:()=>now});const first=Array.from(records.keys()).find(k=>k.startsWith('forecasts/'));const saved=JSON.stringify(records.get(first));
 doc.players['1'].xp=6;doc.players['1'].components.goals=4;await publishOwnModel({doc,store,archive,fetcher,clock:()=>now+1000});assert.equal(JSON.stringify(records.get(first)),saved);
 let calls=0;await assert.rejects(()=>publishOwnModel({doc,store,archive,fetcher,clock:()=>calls++<1?now:Date.parse(doc.deadline_utc)}));
});
