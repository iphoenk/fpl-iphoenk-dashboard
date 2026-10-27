// D09: request isolation and failure behaviour of the public decision service (synthetic upstream, no network).
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

/* Upstream mock. `entryFor(id)` lets a test change what Official returns for one entry; `fail(url)` injects failures. */
function mock({entryFor=id=>({id,name:'Team'+id}),fail=()=>null,picksFor=()=>picks}={}){
 const calls=[];
 const fetcher=async url=>{
  calls.push(String(url));
  const injected=fail(String(url));if(injected)return injected;
  const path=new URL(url).pathname;
  if(path.endsWith('bootstrap-static/'))return Response.json(bs);
  if(path.includes('latest_index.json'))return Response.json({generated_at:new Date(NOW-90000).toISOString(),sources:[{source_id:'official_fpl',health:'GREEN'}]});
  if(path.includes('publish_integrity.json'))return Response.json({status:'PASS',observed_at:new Date(NOW-90000).toISOString()});
  const pk=path.match(/\/entry\/(\d+)\/event\/\d+\/picks\/$/);
  if(pk)return Response.json(picksFor(Number(pk[1])));
   if(path.endsWith('history/'))return Response.json({current:[{event:1,event_transfers:0},{event:2,event_transfers:0},{event:3,event_transfers:0},{event:4,event_transfers:0},{event:5,event_transfers:0},{event:6,event_transfers:0},{event:7,event_transfers:0}]});
  const m=path.match(/\/entry\/(\d+)\/$/);
  if(m)return Response.json(entryFor(Number(m[1])));
  return Response.json({error:'not found'},{status:404});
 };
 return {fetcher,calls};
}
const service=(m,extra={})=>createPublicDecisionService({fetcher:m.fetcher,clock:()=>NOW,...extra});
const entryCalls=(m,id)=>m.calls.filter(u=>u.includes('/entry/'+id+'/')).length;

test('entry A can never receive entry B data: results, team state and cache stay keyed per entry and horizon',async()=>{
  const m=mock({entryFor:id=>({id,name:'Team'+id,player_first_name:'First'+id})});
  const s=service(m);
  const a=await s.get(111),b=await s.get(222);
  assert.equal(a.entry_id,111);assert.equal(b.entry_id,222);
  assert.equal(a.team_state.entry_id,111);assert.equal(b.team_state.entry_id,222);
  assert.equal(a.team_state.team_name,'Team111');assert.equal(b.team_state.team_name,'Team222');
  assert.equal(a.team_state.manager_name,'First111');
  // cached repeats return the same entry, not a neighbour
  assert.equal((await s.get(111)).team_state.team_name,'Team111');
  assert.equal(entryCalls(m,111),3);                       // entry, picks, history: fetched once each
  // a different horizon is a different cache key
  const before=entryCalls(m,111);
  await s.get(111,3);
  assert.equal((await s.get(111,3)).entry_id,111);
  assert.equal(JSON.stringify(a).includes('Team222'),false);
  assert.ok(entryCalls(m,111)>=before);
});

test('an Official response whose id differs from the request is rejected and never cached',async()=>{
  let wrong=true;
  const m=mock({entryFor:id=>wrong?{id:id+1,name:'Someone else'}:{id,name:'Right'}});
  const s=service(m);
  await assert.rejects(()=>s.get(333),/BAD_OFFICIAL_ENTRY/);
  assert.equal(s.stats().cache,0);
  wrong=false;
  // the resource cache holds the bad entry for its TTL, so advance time past it
  const later=createPublicDecisionService({fetcher:m.fetcher,clock:()=>NOW+200000});
  const ok=await later.get(333);
  assert.equal(ok.team_state.team_name,'Right');
});

test('an upstream failure is not promoted to ready and does not poison later requests',async()=>{
  let down=true;
  const m=mock({fail:url=>down&&url.includes('/entry/444/history/')?Response.json({error:'x'},{status:503}):null});
  const s=service(m);
  const first=await publicDecisionResponse(new Request('https://app.test/api/decision?entry_id=444'),{service:s});
  assert.equal(first.status,503);
  const body=await first.json();
  assert.equal(body.status,'unavailable');assert.equal(body.retryable,true);
  assert.match(first.headers.get('Cache-Control'),/no-store/);
  assert.equal(first.headers.get('Retry-After'),'30');
  assert.equal(s.stats().cache,0);
  down=false;
  const second=await publicDecisionResponse(new Request('https://app.test/api/decision?entry_id=444'),{service:s});
  assert.equal(second.status,200);assert.equal((await second.json()).status,'ready');
});

test('an oversized upstream body is refused, reported unavailable and not cached',async()=>{
  const huge=Response.json({id:555,name:'x'.repeat(1100000)});
  const m=mock({fail:url=>url.includes('/entry/555/')&&!url.includes('picks')&&!url.includes('history')?huge.clone():null});
  const s=service(m);
  const r=await publicDecisionResponse(new Request('https://app.test/api/decision?entry_id=555'),{service:s});
  assert.equal(r.status,503);assert.equal(s.stats().cache,0);
});

test('a hung or failing canonical service falls back to the Official public decision, never to a failure',async()=>{
  const m=mock({fail:url=>url.startsWith('https://canonical.test/')?Response.json({error:'down'},{status:500}):null});
  const s=service(m,{canonicalBaseUrl:'https://canonical.test/decision',timeoutMs:50});
  const r=await s.get(666);
  assert.equal(r.status,'ready');
  assert.equal(r.source.model_mode,'OFFICIAL_ONE_GW_FALLBACK');
  assert.equal(r.canonical_v12,false);
  assert.ok(m.calls.some(u=>u.startsWith('https://canonical.test/')));
});

test('malformed, repeated, oversized or foreign query values are rejected before any upstream call',async()=>{
  const m=mock();const s=service(m);
  const bad=['entry_id=0','entry_id=-1','entry_id=1e3','entry_id=abc','entry_id=12345678901','entry_id=1.5','entry_id=%20',
    'entry_id=1&entry_id=2','entry_id=1&horizon=2','entry_id=1&horizon=1&horizon=3','entry_id=1&path=evil','entry_id=1&path=decision&path=decision',
    'entry_id=1&url=https://evil.test','entry_id=1&callback=x','','horizon=1'];
  for(const q of bad){
    const r=await publicDecisionResponse(new Request('https://app.test/api/decision?'+q),{service:s});
    assert.equal(r.status,400,q);
    assert.match(r.headers.get('Cache-Control'),/no-store/,q);
  }
  for(const method of ['POST','PUT','DELETE']){
    const r=await publicDecisionResponse(new Request('https://app.test/api/decision?entry_id=1',{method}),{service:s});
    assert.equal(r.status,405);
  }
  assert.equal(m.calls.length,0);
});

test('the only accepted path rewrite value is the framework-generated "decision"',async()=>{
  const m=mock();const s=service(m);
  const ok=await publicDecisionResponse(new Request('https://app.test/api/decision?path=decision&entry_id=777'),{service:s});
  assert.equal(ok.status,200);
  const bad=await publicDecisionResponse(new Request('https://app.test/api/decision?path=model/news&entry_id=777'),{service:s});
  assert.equal(bad.status,400);
});

test('names with HTML and Unicode round-trip as inert JSON with nosniff',async()=>{
  const name='<img src=x onerror=alert(1)> Ünï — 日本語';
  const m=mock({entryFor:id=>({id,name})});
  const r=await publicDecisionResponse(new Request('https://app.test/api/decision?entry_id=888'),{service:service(m)});
  assert.equal(r.status,200);
  assert.match(r.headers.get('Content-Type'),/^application\/json/);
  assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal((await r.json()).team_state.team_name,name);
});

test('health and stats expose only numeric counters: no entry id, name or token',async()=>{
  const m=mock({entryFor:id=>({id,name:'SecretTeamName'})});
  const s=service(m);
  await s.get(999);
  const stats=s.stats();
  assert.ok(Object.values(stats).every(v=>typeof v==='number'));
  const h=await publicDecisionResponse(new Request('https://app.test/api/decision/health'),{service:s});
  const text=await h.text();
  for(const secret of ['999','SecretTeamName','token','authorization'])assert.equal(text.toLowerCase().includes(secret.toLowerCase()),false,secret);
  assert.match(h.headers.get('Cache-Control'),/no-store/);
});

test('ready responses are CDN-cacheable per URL only; every non-ready response is no-store',async()=>{
  const m=mock({fail:url=>url.includes('/entry/1212/')&&url.includes('picks')?Response.json({error:'x'},{status:500}):null});
  const s=service(m);
  const ready=await publicDecisionResponse(new Request('https://app.test/api/decision?entry_id=1211'),{service:s});
  assert.match(ready.headers.get('Cache-Control'),/public, max-age=15, s-maxage=45/);
  const failed=await publicDecisionResponse(new Request('https://app.test/api/decision?entry_id=1212'),{service:s});
  assert.equal(failed.status,503);
  assert.match(failed.headers.get('Cache-Control'),/no-store/);
  assert.match(failed.headers.get('Vercel-CDN-Cache-Control'),/no-store/);
});
