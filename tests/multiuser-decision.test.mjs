import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicDecision} from '../multiuser-decision.mjs';
import {createPublicDecisionService,publicDecisionResponse} from '../multiuser-decision-server.mjs';
let id=1;const players=[];
function add(pos,team,ep,cost=45){
 const p={id:id++,web_name:'Player'+id,element_type:pos,team,ep_next:String(ep),now_cost:cost,status:'a'};players.push(p);return p;
}
for(let team=1;team<=14;team++)for(const pos of [1,2,3,4])for(let k=0;k<3;k++)add(pos,team,1+team/3+k/4,40+team);
const take=(pos,teams)=>teams.map(team=>players.find(p=>p.element_type===pos&&p.team===team));
const squad=[...take(1,[1,2]),...take(2,[3,4,5,6,7]),...take(3,[8,9,10,11,12]),
 players.find(p=>p.element_type===4&&p.team===13),players.find(p=>p.element_type===4&&p.team===14),players.find(p=>p.element_type===4&&p.team===13&&p.id!==players.find(x=>x.element_type===4&&x.team===13).id)];
const bootstrap={elements:players,events:[{id:7,is_current:true,deadline_time:'2026-10-18T11:00:00Z'},{id:8,is_next:true,deadline_time:'2026-10-25T11:00:00Z'}]};
const picks={picks:squad.map((p,i)=>({element:p.id,position:i+1,selling_price:p.now_cost})),entry_history:{bank:120,event:7}};
test('A/B/C reoptimize legal XI, four bench, captain/vice with no fake hits',()=>{
 const r=publicDecision({entry:{id:900},picks,bootstrap,planningGw:8});
 assert.equal(r.status,'ready');assert.equal(r.canonical_v12,false);assert.equal(r.monte_carlo,false);
 assert.equal(r.scenarios.A.starting_xi.length,11);assert.equal(r.scenarios.A.bench.length,4);
 for(const s of Object.values(r.scenarios).filter(Boolean)){
  assert.ok(s.starting_xi.includes(s.captain));assert.ok(s.starting_xi.includes(s.vice_captain));
  assert.notEqual(s.captain,s.vice_captain);assert.equal(s.executable,false);
  assert.equal(s.hit_points,null);assert.equal(s.net_gain,null);
  assert.equal(new Set([...s.starting_xi,...s.bench]).size,15);
 }
});
test('missing Official FPL projection and bank fail closed',()=>{
 const bad={...bootstrap,elements:players.map(p=>p.id===squad[0].id?{...p,ep_next:null}:p)};
 assert.equal(publicDecision({entry:{id:900},picks,bootstrap:bad,planningGw:8}).status,'unavailable');
 const noBank={...picks,entry_history:{event:7}};
 const p=publicDecision({entry:{id:900},picks:noBank,bootstrap,planningGw:8});
 assert.equal(p.status,'partial');assert.equal(p.scenarios.B,null);assert.equal(p.scenarios.C,null);
});
test('twenty concurrent users share bootstrap, deduplicate same ID and bound concurrency',async()=>{
 let calls=0;const per=new Map();let active=0,peak=0;
 const fetcher=async url=>{
  calls++;active++;peak=Math.max(active,peak);
  await new Promise(resolve=>setTimeout(resolve,1));
  active--;
  const path=new URL(url).pathname.slice('/api/'.length);
  if(path==='bootstrap-static/')return Response.json(bootstrap);
  const x=path.match(/^entry\/(\d+)\/(?:event\/7\/picks\/)?$/);
  if(!x)return Response.json({}, {status:404});
  const num=Number(x[1]);per.set(num,(per.get(num)||0)+1);
  return Response.json(path.includes('picks')?picks:{id:num});
 };
 const service=createPublicDecisionService({fetcher,maxActive:4});
 const results=await Promise.all(Array.from({length:20},(_,i)=>service.get(70000+i)));
 assert.ok(results.every((r,i)=>r.status==='ready'&&r.entry_id===70000+i));
 assert.equal(per.size,20);assert.equal(calls,43);assert.ok(service.stats().peak<=4);
 await Promise.all(Array.from({length:20},()=>service.get(70000)));
 assert.equal(calls,41);
 assert.ok(peak<=8); // per entry, two Official requests in parallel; shared bootstrap is separate
});
test('API rejects invalid IDs and non-GET without upstream access',async()=>{
 const service={get:async()=>{throw Error('never')}};
 assert.equal((await publicDecisionResponse(new Request('https://site.test/api/decision?entry_id=x'),{service})).status,400);
 assert.equal((await publicDecisionResponse(new Request('https://site.test/api/decision?entry_id=20',{method:'POST'}),{service})).status,405);
 assert.equal(await publicDecisionResponse(new Request('https://site.test/api/other'),{service}),null);
});
test('identical cold users coalesce, real errors are not cached',async()=>{
 let n=0;
 const fetcher=async url=>{
  n++;const p=new URL(url).pathname;
  if(p.endsWith('/bootstrap-static/'))return Response.json(bootstrap);
  if(p.endsWith('/picks/'))return Response.json(picks);
  return Response.json({id:55});
 };
 const s=createPublicDecisionService({fetcher});
 const both=await Promise.all([s.get(55),s.get(55)]);
 assert.equal(both[0].entry_id,55);assert.equal(n,5);
});
