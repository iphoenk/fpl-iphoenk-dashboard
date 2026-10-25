import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateMcShadowRecord,MC_SHADOW_PATH} from '../mc-shadow.mjs';
import {createMcShadowService,mcShadowResponse,publishMcShadowRecord} from '../mc-shadow-server.mjs';
import apiHandler from '../api/index.js';

const now=Date.parse('2026-10-24T02:00:00Z');
function fixture(count=300,horizon=1){
 const elements=Array.from({length:count},(_,i)=>({id:i+1,team:i%20+1,element_type:i%4+1}));
 const bootstrap={elements,events:[{id:1,deadline_time:'2026-08-14T18:00:00Z'},
  {id:9,is_next:true,deadline_time:'2026-10-30T18:00:00Z'}]};
 const snapshot={contract:'FPL_MC_PLAYER_SNAPSHOT_V1',status:'SHADOW_ONLY',canonical_v12:false,
  semantics:'PLAYER_MARGINAL_SUMMARIES_ONLY',engine_revision:'da9633b31ce3304890aeacc179d401c15946c6b0',
  input_sha256:'a'.repeat(64),export_sha256:'b'.repeat(64),sha256:'c'.repeat(64),season:'2026-27',start_gw:9,
  horizon,acquired_at:'2026-10-24T00:00:00Z',generated_at:'2026-10-24T01:00:00Z',
  expires_at:'2026-10-24T06:00:00Z',next_deadline:'2026-10-30T18:00:00Z',actual_samples:500000,
  seed:17,rng:'PCG64',quantile_method:'EMPIRICAL_NEAREST_RANK',model_owner:'V12_MONTE_CARLO',
  minutes_owner:'V12_PLAYER_MINUTES',players:elements.flatMap(p=>Array.from({length:horizon},(_,offset)=>({id:p.id,team:p.team,position:p.element_type,
   gw:9+offset,mean:2,variance:4,p10:0,p50:0,p90:4})))};
 return {bootstrap,snapshot};
}
function record(snapshot){
 const payload_json=JSON.stringify(snapshot).replace('"mean":2,','"mean":2.0,');
 return {contract:'FPL_MC_BLOB_RECORD_V1',payload_json,sha256:createHash('sha256').update(payload_json).digest('hex')};
}
test('raw Python-style float bytes validate without JavaScript reserialization',()=>{
 const {snapshot,bootstrap}=fixture(),r=record(snapshot);
 const out=validateMcShadowRecord(r,{bootstrap,now});assert.equal(out.ok,true);
 assert.equal(out.metadata.status,'SHADOW_ONLY');assert.equal(out.metadata.applied_to_decisions,false);
 assert.equal(out.metadata.coverage,300);assert.equal(out.metadata.canonical_v12,false);
 assert.doesNotMatch(JSON.stringify(out.metadata),/players|input_sha256|seed|captain|bank/);
 assert.equal(validateMcShadowRecord({...r,payload_json:r.payload_json+' '},{bootstrap,now}).ok,false);
});
test('reject private fields, missing/nonfinite numeric evidence, false model ownership and mismatched identity',()=>{
 for(const mutate of [s=>s.bank=10,s=>s.players[0].token='private',s=>s.players[0].mean=null,
  s=>s.players[0].variance=Infinity,s=>s.players[0].p50=9,s=>s.players[0].id=9999,
  s=>s.players[0].team=99,s=>s.model_owner='NEW_MC',s=>s.minutes_owner='NEW_MINUTES',
  s=>s.engine_revision='0'.repeat(40),s=>s.actual_samples=0,s=>s.canonical_v12=true,
  s=>s.players.push(s.players[0]),s=>s.players.pop(),s=>s.horizon=3,s=>s.start_gw=8]){
  const {snapshot,bootstrap}=fixture();mutate(snapshot);
  assert.equal(validateMcShadowRecord(record(snapshot),{bootstrap,now}).ok,false);
 }
});
test('strict freshness and next deadline binding rejects expired or cross-season outputs',()=>{
 for(const mutate of [s=>s.expires_at=new Date(now).toISOString(),s=>s.generated_at='2026-10-24T03:00:00Z',
  s=>s.expires_at='2026-10-24T07:00:00Z',s=>s.acquired_at='2026-10-23T12:00:00Z',
  s=>s.next_deadline='2026-10-31T18:00:00Z',s=>s.season='2025-26']){
  const {snapshot,bootstrap}=fixture();mutate(snapshot);
  assert.equal(validateMcShadowRecord(record(snapshot),{bootstrap,now}).ok,false);
 }
});
test('read-only endpoint rejects URL/ID parameters and non-GET before source operations',async()=>{
 let calls=0;const service={get:async()=>{calls++;throw Error('should not read');}};
 for(const url of ['https://site.test/api/mc/shadow?url=https://evil.test','https://site.test/api/mc/shadow?entry_id=1']){
  assert.equal((await mcShadowResponse(new Request(url),{service})).status,400);
 }
 assert.equal((await mcShadowResponse(new Request('https://site.test/api/mc/shadow',{method:'POST'}),{service})).status,405);
 assert.equal(await mcShadowResponse(new Request('https://site.test/api/decision'),{service}),null);
 assert.equal(calls,0);
});
test('missing Blob performs no Official request and never exposes raw errors',async()=>{
 let officialCalls=0;const service=createMcShadowService({readRecord:async()=>null,
  fetcher:async()=>{officialCalls++;throw Error('secret');},clock:()=>now});
 const r=await mcShadowResponse(new Request('https://site.test/api/mc/shadow'),{service});
 assert.equal(r.status,200);assert.equal((await r.json()).status,'UNAVAILABLE');
 assert.equal(officialCalls,0);assert.equal(r.headers.get('cache-control'),'no-store');
 const bad=createMcShadowService({readRecord:async()=>{throw Error('token=private');}});
 assert.doesNotMatch(JSON.stringify(await bad.get()),/token=private/);
});
test('singleflight cached global status serves 20 readers and expires without stale reuse',async()=>{
 const {snapshot,bootstrap}=fixture();let reads=0,officialCalls=0,time=now;
 const service=createMcShadowService({clock:()=>time,readRecord:async path=>{
  assert.equal(path,MC_SHADOW_PATH);reads++;return record(snapshot);},fetcher:async()=>{officialCalls++;return Response.json(bootstrap);}});
 const values=await Promise.all(Array.from({length:20},()=>service.get()));
 assert.ok(values.every(x=>x.status==='SHADOW_ONLY'));assert.equal(reads,1);assert.equal(officialCalls,1);
 time+=31000;await service.get();assert.equal(reads,2);
 time=Date.parse(snapshot.expires_at);assert.notEqual((await service.get()).status,'SHADOW_ONLY');
});
test('bounded slow optional storage aborts without affecting a main-decision handler',async()=>{
 let signal;const service=createMcShadowService({timeoutMs:25,readRecord:async(path,options)=>{
  signal=options.signal;return new Promise(()=>{});}});
 const start=performance.now(),result=await service.get();
 assert.equal(result.status,'UNAVAILABLE');assert.ok(performance.now()-start<250);
 assert.equal(signal.aborted,true);
});
test('offline publisher validates, uses only dedicated path and checks readback',async()=>{
 const {snapshot,bootstrap}=fixture();let saved,writePath;
 const store={read:async()=>saved,write:async(path,value)=>{writePath=path;saved=value;}};
 const r=await publishMcShadowRecord(record(snapshot),{store,fetcher:async()=>Response.json(bootstrap),clock:()=>now});
 assert.equal(writePath,MC_SHADOW_PATH);assert.equal(r.status,'SHADOW_ONLY');
 const bad=record({...snapshot,bank:20});await assert.rejects(()=>publishMcShadowRecord(bad,{store,fetcher:async()=>Response.json(bootstrap),clock:()=>now}));
});
test('Vercel dispatcher handles the shadow route and decision rejection without MC IO',async()=>{
 const rejected=await apiHandler.fetch(new Request('https://site.test/api/mc/shadow?path=mc/shadow&url=https://bad.test'));
 assert.equal(rejected.status,400);assert.equal(rejected.headers.get('cache-control'),'no-store');
 const start=performance.now();
 const decision=await apiHandler.fetch(new Request('https://site.test/api/decision?entry_id=invalid'));
 assert.equal(decision.status,400);assert.ok(performance.now()-start<100);
});
test('transport accepts lossless uint64 strings and rejects rounded unsafe numeric seeds',()=>{
 const {snapshot,bootstrap}=fixture();snapshot.seed='18446744073709551615';
 assert.equal(validateMcShadowRecord(record(snapshot),{bootstrap,now}).ok,true);
 snapshot.seed=Number(snapshot.seed);assert.equal(validateMcShadowRecord(record(snapshot),{bootstrap,now}).ok,false);
});
test('only strict UTC timestamps enter public metadata, never permissive date-parser comments',()=>{
 const {snapshot,bootstrap}=fixture();snapshot.generated_at='Sat, 24 Oct 2026 01:00:00 GMT (private-plan) Z';
 assert.equal(validateMcShadowRecord(record(snapshot),{bootstrap,now}).ok,false);
});
test('universe is every Official player for every GW, including more than 1000 players',()=>{
 const {snapshot,bootstrap}=fixture(1501,5);
 const result=validateMcShadowRecord(record(snapshot),{bootstrap,now});
 assert.equal(result.ok,true);assert.equal(result.metadata.coverage,1501);
 snapshot.players.pop();assert.equal(validateMcShadowRecord(record(snapshot),{bootstrap,now}).ok,false);
});
test('status u players are outside the MC universe: snapshot without them passes, snapshot with them is rejected',()=>{
 const {snapshot,bootstrap}=fixture(20);
 const marked={...bootstrap,elements:bootstrap.elements.map((p,i)=>i<3?{...p,status:'u'}:{...p,status:'a'})};
 const without={...snapshot,players:snapshot.players.filter(p=>p.id>3)};
 const ok=validateMcShadowRecord(record(without),{bootstrap:marked,now});
 assert.equal(ok.ok,true);assert.equal(ok.metadata.coverage,17);assert.equal(ok.metadata.excluded_inactive,3);
 assert.equal(validateMcShadowRecord(record(snapshot),{bootstrap:marked,now}).ok,false);
 assert.equal(validateMcShadowRecord(record(without),{bootstrap,now}).ok,false);
});
