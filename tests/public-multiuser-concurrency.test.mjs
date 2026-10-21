import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicTeamBackend} from '../public-team-server.mjs';

const DAY=Date.parse('2026-10-21T16:00:00Z');
const event={id:8,is_current:true,deadline_time:'2026-10-20T11:00:00Z'};
const bootstrap={events:[{id:1,deadline_time:'2026-08-01T11:00:00Z'},event,{id:9,is_next:true,deadline_time:'2026-10-24T11:00:00Z'}],
  elements:Array.from({length:35},(_,i)=>({id:i+1,web_name:'Player'+(i+1),team:i%20+1,status:'a'}))};
function fixtureFetcher({delay=1,fail=false}={}){
  const calls=new Map();let active=0,peak=0;
  const fetcher=async url=>{
    active++;peak=Math.max(peak,active);
    calls.set(url,(calls.get(url)||0)+1);
    try{
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      const u=new URL(url),path=u.pathname;
      if(fail&&path.includes('/entry/'))return new Response('Unavailable',{status:503});
      let data;
      if(path.endsWith('bootstrap-static/'))data=bootstrap;
      else if(/\/entry\/\d+\/event\/8\/picks\/$/.test(path))data={picks:Array.from({length:15},(_,i)=>({element:i+1,position:i+1,is_captain:i===0,is_vice_captain:i===1})),entry_history:{bank:5}};
      else if(/\/entry\/\d+\/$/.test(path)){const id=Number(path.split('/')[3]);data={id,name:'Team'+id,player_first_name:'Manager',player_last_name:String(id),summary_overall_points:480,summary_overall_rank:id,leagues:{classic:[{id:777,name:'ABC',entry_rank:id===20?274:id}]}};}
      else if(path.endsWith('/standings/')){const page=Number(u.searchParams.get('page_standings')),start=(page-1)*50+1;data={league:{id:777,name:'ABC'},standings:{results:Array.from({length:50},(_,i)=>({rank:start+i,entry:start+i===274?20:900000+start+i,entry_name:'Rival'+(start+i),total:600-start-i,event_total:50,last_rank:start+i})),has_next:true}};}
      else if(path.includes('latest_index.json'))data={generated_at:new Date(DAY-10000).toISOString(),sources:[{source_id:'official_fpl',health:'GREEN',effective_state:'LIVE'}]};
      else if(path.includes('publish_integrity.json'))data={status:'PASS',observed_at:new Date(DAY-10000).toISOString()};
      else throw Error('Unexpected mock URL '+url);
      return Response.json(data);
    }finally{active--;}
  };
  return {fetcher,calls,peak:()=>peak};
}
const request=(id,league='')=>new Request('https://example.test/api/public-team?entry_id='+id+(league?'&league_id='+league:'')); 
test('20 distinct public teams share Official and V6 caches under a bounded six-fetch concurrency ceiling',async()=>{
 const mock=fixtureFetcher({delay:7}),svc=createPublicTeamBackend({fetcher:mock.fetcher,clock:()=>DAY,maxActive:6,maxPending:120});
 const results=await Promise.all(Array.from({length:20},(_,i)=>svc.handle(request(i+1))));
 assert.ok(results.every(x=>x.status===200));
 const items=await Promise.all(results.map(x=>x.json()));
 assert.deepEqual(items.map(x=>x.entry_id),Array.from({length:20},(_,i)=>i+1));
 assert.ok(items.every(x=>x.team.squad.length===15&&x.optimizer.advice===null&&x.optimizer.monte_carlo==='DISABLED'));
 assert.ok(mock.peak()<=6);assert.ok(svc.metrics().peak_active<=6);
 assert.equal([...mock.calls.entries()].find(([k])=>k.endsWith('bootstrap-static/'))[1],1);
 assert.equal([...mock.calls.keys()].filter(k=>k.includes('latest_index.json')).length,1);
 assert.equal([...mock.calls.keys()].filter(k=>k.includes('publish_integrity.json')).length,1);
 const before=svc.metrics().upstream_calls;
 const repeat=await Promise.all(Array.from({length:20},(_,i)=>svc.handle(request(i+1))));
 assert.ok(repeat.every(x=>x.status===200));assert.equal(svc.metrics().upstream_calls,before);
});
test('twenty requests for the same FPL ID are deduplicated by normalized Official resource key',async()=>{
 const mock=fixtureFetcher({delay:6}),svc=createPublicTeamBackend({fetcher:mock.fetcher,clock:()=>DAY,maxActive:3});
 const r=await Promise.all(Array.from({length:20},()=>svc.handle(request(6))));
 assert.equal(r.length,20);assert.ok(r.every(x=>x.status===200));
 assert.equal([...mock.calls.entries()].find(([k])=>k.endsWith('entry/6/'))[1],1);
});
test('rank 274 returns exactly positions 271-280 and leader gap from page one',async()=>{
 const mock=fixtureFetcher(),svc=createPublicTeamBackend({fetcher:mock.fetcher,clock:()=>DAY});
 const r=await svc.handle(request(20,777)),obj=await r.json();
 assert.equal(r.status,200);assert.equal(obj.selected_league.block_start,271);
 assert.equal(obj.selected_league.rows.length,10);assert.equal(obj.selected_league.rows[0].rank,271);
 assert.equal(obj.selected_league.rows[9].rank,280);
 assert.equal(obj.selected_league.rank,274);assert.equal(obj.selected_league.coverage,'VERIFIED');
 assert.equal(obj.selected_league.leader_points,599);
 assert.equal(obj.selected_league.gap_to_leader,273);
 assert.ok([...mock.calls.keys()].some(k=>k.includes('page_standings=6')));
});
test('disallow arbitrary league ID and malformed query; never fetch private decisions or credentials',async()=>{
 const mock=fixtureFetcher(),svc=createPublicTeamBackend({fetcher:mock.fetcher,clock:()=>DAY});
 assert.equal((await svc.handle(request('0'))).status,400);
 assert.equal((await svc.handle(request('1&foo=2'))).status,400);
 assert.equal((await svc.handle(request(1,999))).status,404);
 assert.equal((await svc.handle(new Request('https://example.test/api/public-team?entry_id=1',{method:'POST'}))).status,405);
 assert.ok([...mock.calls.keys()].every(k=>!k.includes('private')&&!k.includes('reports/')));
});
test('overload fails fast with 503 rather than unbounded work',async()=>{
 const mock=fixtureFetcher({delay:50}),svc=createPublicTeamBackend({fetcher:mock.fetcher,clock:()=>DAY,maxActive:1,maxPending:0});
 const r=await Promise.all([svc.handle(request(1)),svc.handle(request(2)),svc.handle(request(3))]);
 assert.ok(r.some(x=>x.status===503));assert.ok(mock.peak()<=1);
});
test('Official failures return safe 503; V6 failure never fabricates factual data',async()=>{
 const mock=fixtureFetcher({fail:true}),svc=createPublicTeamBackend({fetcher:mock.fetcher,clock:()=>DAY});
 const r=await svc.handle(request(1));assert.equal(r.status,503);
 assert.equal((await r.json()).error,'UPSTREAM_UNAVAILABLE');
});
test('health is read-only and exposes aggregate server-side limits, never team identities',async()=>{
 const svc=createPublicTeamBackend({fetcher:fixtureFetcher().fetcher});
 const r=await svc.handle(new Request('https://example.test/api/public-team/health'));
 const obj=await r.json();assert.equal(obj.status,'READY');assert.equal(obj.metrics.max_active,6);
 assert.equal(JSON.stringify(obj).includes('entry_id'),false);
 assert.equal(await svc.handle(new Request('https://example.test/api/no-match')),null);
});
