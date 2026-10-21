import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicDecisionService,publicDecisionResponse} from '../multiuser-decision-server.mjs';

const NOW=Date.parse('2026-10-21T15:30:00Z');
const inputPlayers=[];
let id=1;
for(let club=1;club<=20;club++)for(const position of [1,2,3,4]){
 const n=position===1?2:position===2?5:position===3?5:3;
 for(let i=0;i<n;i++)inputPlayers.push({id:id++,web_name:'Player'+id,element_type:position,team:club,
 ep_next:String(1+(club%8)+i/4),now_cost:45+club,status:'a'});
}
const choose=(pos,count)=>Array.from({length:count},(_,i)=>inputPlayers.find(p=>p.element_type===pos&&p.team===({1:[1,2],2:[3,4,5,6,7],3:[8,9,10,11,12],4:[13,14,15]}[pos][i])));
const squad=[...choose(1,2),...choose(2,5),...choose(3,5),...choose(4,3)];
const bs={events:[{id:1,deadline_time:'2026-08-01T12:00:00Z',finished:true},{id:7,is_current:true,deadline_time:'2026-10-18T11:00:00Z'},{id:8,is_next:true,deadline_time:'2026-10-24T11:00:00Z'}],elements:inputPlayers};
const picks={picks:squad.map((p,i)=>({element:p.id,position:i+1,selling_price:p.now_cost})),entry_history:{bank:60,event:7}};
function mock(delay=2){
 const urls=new Map();let active=0,peak=0;
 const fetcher=async url=>{
  active++;peak=Math.max(peak,active);urls.set(url,(urls.get(url)||0)+1);
  try{
   if(delay)await new Promise(r=>setTimeout(r,delay));
   const path=new URL(url).pathname;
   if(path.endsWith('bootstrap-static/'))return Response.json(bs);
   if(path.includes('latest_index.json'))return Response.json({generated_at:new Date(NOW-90000).toISOString(),sources:[{source_id:'official_fpl',health:'GREEN'}]});
   if(path.includes('publish_integrity.json'))return Response.json({status:'PASS',observed_at:new Date(NOW-90000).toISOString()});
   if(path.endsWith('picks/'))return Response.json(picks);
   const m=path.match(/\/entry\/(\d+)\/$/);
   if(m)return Response.json({id:Number(m[1]),name:'Team'+m[1]});
   return Response.json({error:'not found'},{status:404});
  }finally{active--;}
 };
 return {urls,fetcher,peak:()=>peak};
}
test('20 concurrent FPL IDs, Official bootstrap and V6 evidence shared, IO capped at six',async()=>{
 const m=mock(5),service=createPublicDecisionService({fetcher:m.fetcher,clock:()=>NOW,maxActive:6,maxCompute:4});
 const jobs=Array.from({length:20},(_,i)=>service.get(1000+i));
 const results=await Promise.all(jobs);
 assert.ok(results.every((r,i)=>r.entry_id===1000+i&&r.status==='ready'));
 assert.ok(results.every(r=>r.source.v6.status==='VERIFIED'&&r.source.v6.mode==='PROVENANCE_ONLY'));
 assert.ok(results.every(r=>r.canonical_v12===false&&r.monte_carlo===false));
 assert.ok(m.peak()<=6);
 assert.ok(service.stats().upstreamPeak<=6);
 assert.ok(service.stats().peak<=4);
 assert.equal([...m.urls].find(([u])=>u.endsWith('bootstrap-static/'))[1],1);
 assert.equal([...m.urls].filter(([u])=>u.includes('latest_index.json')).length,1);
 assert.equal([...m.urls].filter(([u])=>u.includes('publish_integrity.json')).length,1);
 const before=service.stats().upstreamCalls;
 await Promise.all(Array.from({length:20},(_,i)=>service.get(1000+i)));
 assert.equal(service.stats().upstreamCalls,before);
});
test('20 requests for same account deduplicate resource and advisory compute',async()=>{
 const m=mock(5),service=createPublicDecisionService({fetcher:m.fetcher,clock:()=>NOW,maxActive:3});
 const results=await Promise.all(Array.from({length:20},()=>service.get(995)));
 assert.ok(results.every(r=>r.entry_id===995));
 assert.equal([...m.urls].find(([u])=>u.endsWith('entry/995/'))[1],1);
});
test('strict query rejects non-ID, repeated ID and unexpected params without upstream',async()=>{
 const fake={get:()=>{throw Error('should not call')},stats:()=>({})};
 for(const url of ['https://app.test/api/decision?entry_id=0','https://app.test/api/decision?entry_id=1&entry_id=2',
 'https://app.test/api/decision?entry_id=1&debug=true']){
  const r=await publicDecisionResponse(new Request(url),{service:fake});assert.equal(r.status,400);
 }
 const r=await publicDecisionResponse(new Request('https://app.test/api/decision/health'),{service:fake});
 assert.equal(r.status,200);assert.equal((await r.json()).status,'READY');
});
test('strict bounded pool queues and backpressure; 429 rather than unbounded requests',async()=>{
 const m=mock(50),service=createPublicDecisionService({fetcher:m.fetcher,clock:()=>NOW,maxActive:1,maxWaiting:0,maxCompute:1});
 const results=await Promise.all(Array.from({length:5},(_,i)=>publicDecisionResponse(new Request('https://app.test/api/decision?entry_id='+(i+1)),{service})));
 assert.ok(results.some(r=>r.status===429||r.status===503));assert.ok(m.peak()<=1);
});
test('V6 outage does not reclassify Official facts or invent model authority',async()=>{
 const m=mock();const f=async url=>String(url).includes('runtime-data-v6')?Response.json({error:'down'},{status:503}):m.fetcher(url);
 const service=createPublicDecisionService({fetcher:f,clock:()=>NOW});
 const r=await service.get(15);
 assert.equal(r.status,'ready');assert.equal(r.source.provider,'Official FPL');assert.equal(r.source.v6.status,'UNAVAILABLE');
 assert.equal(r.canonical_v12,false);assert.equal(r.search_scope,'BOUNDED_NONCANONICAL');
});
