import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildScoreContext,scoreInputDigest,describeScoreBasis} from '../score-context.mjs';

// Synthetic 15-player fixture. element ids 1..15; positions 1..15; starters are positions 1..11.
const liveFor=points=>({elements:Object.entries(points).map(([id,total_points])=>({id:Number(id),stats:{total_points}}))});
const squad=({captain=9,vice=10,mult={}}={})=>Array.from({length:15},(_,i)=>{
 const element=i+1,position=i+1;
 const base=position<=11?1:0;
 return {element,position,multiplier:mult[element]??(element===captain?2:base),is_captain:element===captain,is_vice_captain:element===vice};
});
const ZERO_POINTS=Object.fromEntries(Array.from({length:15},(_,i)=>[i+1,0]));

test('test_mixed_source_snapshot_keeps_0_20_24_distinct',()=>{
 // picks entry_history says 0 (GW not scored yet), standing row says 20/497, live data adds up to 24.
 const points={...ZERO_POINTS,9:12};          // captain 12 x2 = 24
 const ctx=buildScoreContext({
  entry:{id:7,summary_overall_points:477},
  picks:{entry_history:{event:8,points:0,total_points:477,event_transfers_cost:0},picks:squad()},
  live:liveFor(points),event:{id:8,finished:false,data_checked:false},
  standing:{event_total:20,total:497},season:'2026/27',gameweek:8
 });
 assert.equal(ctx.official_gw_points,0);
 assert.equal(ctx.official_season_total,477);
 assert.equal(ctx.standing_gw_points,20);
 assert.equal(ctx.standing_total,497);
 assert.equal(ctx.live_gross,24);
 assert.equal(ctx.live_net,24);
 assert.equal(ctx.basis,'LIVE_PUBLISHED_MULTIPLIERS');
 assert.equal(ctx.finality,'PROVISIONAL');
 assert.ok(ctx.warnings.includes('STANDING_GW_DIFFERS_FROM_PICKS'));
 assert.ok(ctx.warnings.includes('LIVE_DIFFERS_FROM_OFFICIAL'));
});

test('test_unknown_hit_yields_null_net',()=>{
 const ctx=buildScoreContext({picks:{entry_history:{event:8,points:30},picks:squad()},live:liveFor({...ZERO_POINTS,9:5}),gameweek:8});
 assert.equal(ctx.live_gross,10);
 assert.equal(ctx.hit_points,null);
 assert.equal(ctx.live_net,null);
 assert.ok(ctx.warnings.includes('HIT_UNKNOWN'));
});

test('test_hit_subtracted_exactly_once',()=>{
 const ctx=buildScoreContext({picks:{entry_history:{event:8,points:6,event_transfers_cost:4},picks:squad()},live:liveFor({...ZERO_POINTS,9:5,1:4}),gameweek:8});
 assert.equal(ctx.live_gross,14);
 assert.equal(ctx.hit_points,4);
 assert.equal(ctx.live_net,10);
});

test('test_bench_zero_preserved',()=>{
 // Bench multiplier 0 must stay 0 (the old Number(p.multiplier||1) turned it into 1).
 const points={...ZERO_POINTS,12:9,13:1};
 const ctx=buildScoreContext({picks:{entry_history:{event:8,points:0,event_transfers_cost:0},picks:squad()},live:liveFor(points),gameweek:8});
 assert.equal(ctx.live_gross,0);
 assert.equal(ctx.bench_raw_points,10);
});

test('test_tc_vc_not_double_applied',()=>{
 // Triple captain published as multiplier 3: gross uses 3 once; vice-captain takeover is already in the published multipliers.
 const tc=buildScoreContext({picks:{entry_history:{event:8,points:0,event_transfers_cost:0},active_chip:'3xc',picks:squad({mult:{9:3}})},live:liveFor({...ZERO_POINTS,9:8,10:6}),gameweek:8});
 assert.equal(tc.captain_points,24);
 assert.equal(tc.live_gross,24+6);
 // VC takeover: captain (9) did not play, FPL publishes vice (10) with multiplier 2 and captain with 1 (0 points).
 const takeover=buildScoreContext({picks:{entry_history:{event:8,points:0,event_transfers_cost:0},picks:squad({mult:{9:1,10:2}})},live:liveFor({...ZERO_POINTS,10:6}),gameweek:8});
 assert.equal(takeover.live_gross,12);
});

test('missing multiplier or live points fail closed to null, never 0',()=>{
 const missingMultiplier=squad();delete missingMultiplier[0].multiplier;
 const a=buildScoreContext({picks:{entry_history:{event:8,points:3,event_transfers_cost:0},picks:missingMultiplier},live:liveFor(ZERO_POINTS),gameweek:8});
 assert.equal(a.live_gross,null);assert.equal(a.live_net,null);assert.equal(a.official_gw_points,3);
 const partialLive={elements:ZERO_POINTS?Object.entries(ZERO_POINTS).filter(([id])=>Number(id)!==3).map(([id,v])=>({id:Number(id),stats:{total_points:v}})):[]};
 const b=buildScoreContext({picks:{entry_history:{event:8,points:3,event_transfers_cost:0},picks:squad()},live:partialLive,gameweek:8});
 assert.equal(b.live_gross,null);
 assert.ok(b.warnings.includes('LIVE_POINTS_MISSING'));
});

test('official zero is a value, absent official is null',()=>{
 assert.equal(buildScoreContext({picks:{entry_history:{event:8,points:0,event_transfers_cost:0},picks:[]},gameweek:8}).official_gw_points,0);
 const absent=buildScoreContext({picks:{entry_history:{event:8},picks:[]},gameweek:8});
 assert.equal(absent.official_gw_points,null);
 assert.equal(absent.finality,'UNAVAILABLE');
 assert.equal(describeScoreBasis(absent),'GW points unavailable');
});

test('finality follows data_checked, not availability; source_as_of is not copied from fetched_at',()=>{
 const base={picks:{entry_history:{event:8,points:40,event_transfers_cost:0},picks:[]},gameweek:8,sourceMeta:{fetched_at:'2026-10-25T07:00:00Z'}};
 assert.equal(buildScoreContext({...base,event:{finished:true,data_checked:true}}).finality,'CHECKED');
 const unchecked=buildScoreContext({...base,event:{finished:true,data_checked:false}});
 assert.equal(unchecked.finality,'PROVISIONAL');
 assert.ok(unchecked.warnings.includes('FINISHED_NOT_DATA_CHECKED'));
 assert.equal(unchecked.source_as_of,null);
 assert.equal(unchecked.fetched_at,'2026-10-25T07:00:00Z');
});

test('picks for a different GW than requested are flagged',()=>{
 const ctx=buildScoreContext({picks:{entry_history:{event:7,points:40,event_transfers_cost:0},picks:[]},gameweek:8});
 assert.ok(ctx.warnings.includes('PICKS_GW_MISMATCH'));
});

test('digest is sha256 over canonical input and independent of key order',()=>{
 const a={b:1,a:[1,2,{d:4,c:3}]},b={a:[1,2,{c:3,d:4}],b:1};
 assert.equal(scoreInputDigest(a),scoreInputDigest(b));
 assert.equal(scoreInputDigest(a),createHash('sha256').update('{"a":[1,2,{"c":3,"d":4}],"b":1}').digest('hex'));
 assert.equal(scoreInputDigest('é'),createHash('sha256').update('"é"').digest('hex'));
});

// UI loader behaviour (D02): an explicitly requested GW never switches silently; the automatic default may fall back and says so.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function loaderContext({failGw=[],finished=[7]}={}){
 const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function loadTeam('),source.indexOf('function renderLeagueOptions()'));
 const nodes=new Map(),messages=[];
 const state={bootstrap:{events:finished.map(id=>({id,finished:true}))},gw:8,teamRequest:0,entry:{id:10},homeEntryId:10};
 const c=vm.createContext({buildScoreContext,state,entryId:v=>String(v),$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},alertMessage:m=>messages.push(m),clearAlert:()=>{},
  fetchTeam:async(id,gw)=>{if(failGw.includes(Number(gw)))throw new Error('upstream '+gw);return {entry:{id:Number(id),leagues:{classic:[]}},picks:{entry_history:{event:Number(gw),points:1,event_transfers_cost:0},picks:[]}};},
  api:async()=>({elements:[]}),safeWrite:()=>{},ext:{},renderStats(){},renderPitch(){},renderInsights(){},renderPlanner(){},renderLeagueOptions(){},renderFixtures(){}});
 vm.runInContext(fn,c);
 return {c,state,messages,nodes};
}
test('test_explicit_gw_failure_does_not_switch',async()=>{
 const {c,state,messages,nodes}=loaderContext({failGw:[8]});
 state.entry={id:10};state.gw=9;
 await c.loadTeam(10,8,{visit:false,explicitGw:true});
 assert.equal(state.gw,9,'page must stay on the GW it already shows');
 assert.equal(state.entry.id,10);
 assert.match(messages.join(' '),/GW 8 could not be loaded/);
 assert.equal(nodes.get('gwSelect').value,9);
});
test('automatic default may fall back, and the notice names the actual GW',async()=>{
 const {c,state,messages}=loaderContext({failGw:[8],finished:[7]});
 await c.loadTeam(10,8,{visit:false});
 assert.equal(state.gw,7);
 assert.deepEqual({...state.gwFallback},{requested:8,actual:7});
 assert.match(messages.join(' '),/GW 8 was not available.*GW 7 is shown/);
 assert.equal(state.scoreContext.gameweek,7);
});
test('stale request A cannot overwrite request B',async()=>{
 const {c,state}=loaderContext();
 let release;const gate=new Promise(r=>{release=r;});
 const originalFetch=c.fetchTeam;
 c.fetchTeam=async(id,gw)=>{if(Number(id)===111)await gate;return originalFetch(id,gw);};
 const first=c.loadTeam(111,8,{visit:true});
 await c.loadTeam(222,8,{visit:true});
 release();await first;
 assert.equal(state.entry.id,222);
});
test('squad multiplier keeps bench 0 instead of coercing to 1',async()=>{
 const {c,state}=loaderContext();
 c.fetchTeam=async(id,gw)=>({entry:{id:Number(id),leagues:{classic:[]}},picks:{entry_history:{event:8,points:0,event_transfers_cost:0},picks:[{element:1,position:12,multiplier:0},{element:2,position:1,multiplier:2,is_captain:true},{element:3,position:2}]}});
 await c.loadTeam(10,8,{visit:false});
 assert.deepEqual(state.teamState.squad.map(p=>p.multiplier),[0,2,null]);
});

test('test_points_is_gross_hit_is_not_a_false_mismatch',()=>{
 // Fixture-backed semantics: entry_history.points is gross (27 with a 4-pt hit matches live gross 27; season total adds 23).
 const ctx=buildScoreContext({picks:{entry_history:{event:8,points:14,total_points:100,event_transfers_cost:4},picks:squad()},live:liveFor({...ZERO_POINTS,9:5,1:4}),gameweek:8,event:{id:8,finished:false,data_checked:false}});
 assert.equal(ctx.live_gross,14);
 assert.equal(ctx.official_gw_points,14);
 assert.equal(ctx.official_gw_net,10);
 assert.equal(ctx.live_net,10);
 assert.ok(!ctx.warnings.includes('LIVE_DIFFERS_FROM_OFFICIAL'),'gross equals gross: no mismatch warning');
 assert.equal(describeScoreBasis(ctx),'Official 14 (net 10 after -4 hit) · provisional');
 const noHit=buildScoreContext({picks:{entry_history:{event:8,points:30},picks:squad()},gameweek:8});
 assert.equal(noHit.official_gw_net,null,'unknown hit keeps net unknown, never gross');
});
