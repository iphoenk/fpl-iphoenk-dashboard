import {test} from 'node:test';
import assert from 'node:assert/strict';
import {multiGwDecision,validateGlobalModel} from '../multiuser-horizon.mjs';
import {createPublicDecisionService} from '../multiuser-decision-server.mjs';
const NOW=Date.parse('2026-10-22T01:00:00Z'),GW=8;
let id=1;const elements=[];
for(let team=1;team<=20;team++)for(const type of [1,2,3,4])for(let k=0;k<5;k++)
 elements.push({id:id++,team,element_type:type,now_cost:40+team,status:'a',web_name:'P'+id,ep_next:'4'});
const owned=[elements.find(x=>x.team===1&&x.element_type===1),elements.find(x=>x.team===2&&x.element_type===1),
 ...[3,4,5,6,7].map(t=>elements.find(x=>x.team===t&&x.element_type===2)),
 ...[8,9,10,11,12].map(t=>elements.find(x=>x.team===t&&x.element_type===3)),
 ...[13,14,15].map(t=>elements.find(x=>x.team===t&&x.element_type===4))];
const players=elements.map(x=>({id:x.id,p:x.element_type,t:x.team,xpm:[5,5,5,5,5,5,5,5].map(v=>x.team>15?v+5:v),nx:{pstart:0.92}}));
const meta={authority:'model',next_gw:GW,horizon:8,built_at:new Date(NOW-10000).toISOString(),
 sources:[{source:'FPL official API',status:'ok'}],backtest:[{gw:7,mae:1.4}]};
const bootstrap={elements};
const picks={picks:owned.map((p,i)=>({element:p.id,position:i+1,selling_price:p.now_cost})),entry_history:{bank:200,event:7}};
const evaluate=(override={})=>multiGwDecision({entry:{id:999},picks,bootstrap,planningGw:GW,
 snapshot:{meta,players},horizon:3,now:NOW,...override});
test('verified multi-GW projection: true 3-week optimized XI, no MC and no fabricated hit',()=>{
 const r=evaluate();
 assert.equal(r.contract,'PUBLIC_FPL_MULTIGW_ADVISORY_V2');
 assert.equal(r.canonical_v12,false);assert.equal(r.monte_carlo,false);
 assert.equal(r.scenarios.A.weeks.length,3);
 assert.equal(r.scenarios.A.starting_xi.length,11);
 assert.equal(r.scenarios.A.bench.length,4);
 assert.ok(r.scenarios.B&&r.scenarios.B.gross_gain_vs_hold>0);
 for(const scenario of Object.values(r.scenarios).filter(Boolean)){
  assert.equal(scenario.hit_points,null);assert.equal(scenario.net_gain,null);
  assert.equal(scenario.executable,false);
  assert.ok(scenario.starting_xi.includes(scenario.captain));
  assert.ok(scenario.starting_xi.includes(scenario.vice_captain));
 }
 assert.ok(r.search_evidence.legal_single_routes>0);
});
test('stale, cross-GW, mismatched player identity and insufficient coverage fail closed',()=>{
 assert.equal(evaluate({now:NOW+7*3600000}),null);
 assert.equal(evaluate({planningGw:9}),null);
 const bad=players.map((p,i)=>i<200?{...p,t:999}:p);
 assert.equal(evaluate({snapshot:{meta,players:bad}}),null);
 assert.equal(validateGlobalModel({meta,players:[players[0]]},bootstrap,GW,NOW),null);
});
test('1/5 GW horizon works, missing historic prices only permits HOLD, no invented net',()=>{
 assert.equal(evaluate({horizon:1}).scenarios.A.weeks.length,1);
 assert.equal(evaluate({horizon:5}).scenarios.A.weeks.length,5);
 const noBank={...picks,entry_history:{event:7}};
 const r=evaluate({picks:noBank});
 assert.equal(r.status,'partial');assert.equal(r.scenarios.B,null);assert.equal(r.scenarios.C,null);
});

test('20 distinct IDs use one validated shared global snapshot with bounded IO/compute',async()=>{
 const events=[{id:7,is_current:true,deadline_time:'2026-10-18T11:00:00Z'},
               {id:8,is_next:true,deadline_time:'2026-10-23T17:30:00Z'}];
 const calls=new Map();let active=0,peak=0;
 const fetcher=async url=>{
  calls.set(url,(calls.get(url)||0)+1);active++;peak=Math.max(peak,active);
  try{
   await new Promise(resolve=>setTimeout(resolve,1));
   const u=new URL(url),path=u.pathname;
   if(path.endsWith('/bootstrap-static/'))return Response.json({...bootstrap,events});
   if(path.endsWith('/meta.json'))return Response.json(meta);
   if(path.endsWith('/players.json'))return Response.json(players);
   if(path.endsWith('/latest_index.json'))return Response.json({sources:[],generated_at:new Date(NOW-10000).toISOString()});
   if(path.endsWith('/publish_integrity.json'))return Response.json({status:'PASS',observed_at:new Date(NOW-10000).toISOString()});
   if(path.endsWith('/picks/'))return Response.json(picks);
   const match=path.match(/\/entry\/(\d+)\/$/);
   if(match)return Response.json({id:Number(match[1]),name:'Mock'+match[1]});
   return Response.json({error:'not found'},{status:404});
  }finally{active--;}
 };
 const service=createPublicDecisionService({fetcher,clock:()=>NOW,maxActive:6,maxCompute:4});
 const started=Date.now();
 const all=await Promise.all(Array.from({length:20},(_,i)=>service.get(70001+i,3)));
 const elapsed=Date.now()-started;
 assert.equal(all.length,20);
 assert.ok(all.every((r,i)=>r.status==='ready'&&r.entry_id===70001+i&&r.contract==='PUBLIC_FPL_MULTIGW_ADVISORY_V2'));
 assert.ok(all.every(r=>r.scenarios.A.weeks.length===3&&r.monte_carlo===false&&r.canonical_v12===false));
 assert.ok(peak<=6);assert.ok(service.stats().upstreamPeak<=6);
 assert.ok(service.stats().peak<=4);
 assert.equal([...calls].filter(([url])=>url.endsWith('/meta.json'))[0][1],1);
 assert.equal([...calls].filter(([url])=>url.endsWith('/players.json'))[0][1],1);
 assert.equal([...calls].filter(([url])=>url.endsWith('/bootstrap-static/'))[0][1],1);
 const before=service.stats().upstreamCalls;
 await Promise.all(Array.from({length:20},(_,i)=>service.get(70001+i,3)));
 assert.equal(service.stats().upstreamCalls,before);
 assert.ok(elapsed<30000,'mock 20-client benchmark exceeded 30s');
});
