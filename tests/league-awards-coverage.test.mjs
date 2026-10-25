import test from 'node:test';
import assert from 'node:assert/strict';
import {computeLeagueAwards,leagueOwnershipMetrics,pickWinners,captainContribution,AWARD_CATEGORY_IDS} from '../league-awards.mjs';

// Synthetic league. Every team: 15 distinct players (ids base..base+14), published picks with entry_history.
const GW=9;
function team(rank,{points=50,hit=0,chip=null,bench=0,value=1000,captain=1,mult={},picks,last_rank=rank,history}={}){
 const list=picks||Array.from({length:15},(_,i)=>({element:rank*100+i,position:i+1,multiplier:i<11?1:0,is_captain:i===0,is_vice_captain:i===1}));
 for(const p of list)if(mult[p.element]!==undefined)p.multiplier=mult[p.element];
 return {row:{entry:rank,entry_name:'Team '+rank,rank,last_rank},
  picks:{active_chip:chip,picks:list,entry_history:{event:GW,points,event_transfers_cost:hit,points_on_bench:bench,value}},history};
}
const completeCoverage=n=>({complete:true,total:n,loaded:n,reason:null});
const checkedEvent={id:GW,finished:true,data_checked:true};
const liveEvent={id:GW,finished:false,data_checked:false};
const byId=(result,id)=>result.categories.find(c=>c.id===id);
const names=c=>c.winners.map(w=>w.name);

test('test_58_members_hit8_at_rank57_wins_on_page1',()=>{
 const records=Array.from({length:58},(_,i)=>team(i+1,{points:40+(i%7),hit:i+1===57?8:i+1===3?4:0}));
 const result=computeLeagueAwards({records,live:{},event:checkedEvent,gameweek:GW,coverage:completeCoverage(58)});
 const hit=byId(result,'biggest_hit');
 assert.deepEqual(names(hit),['Team 57']);
 assert.equal(hit.winners[0].value,8);
 assert.equal(hit.scope,'FULL_LEAGUE');
 // the first 20 teams (page 1) alone would have picked rank 3 with hit 4
 const page1=computeLeagueAwards({records:records.slice(0,20),event:checkedEvent,gameweek:GW,coverage:{complete:false,total:null,loaded:20}});
 assert.deepEqual(names(byId(page1,'biggest_hit')),['Team 3']);
 assert.equal(page1.status,'PARTIAL');
});

test('test_55_of58_partial_no_global_final',()=>{
 const records=Array.from({length:55},(_,i)=>team(i+1,{points:40+i%9}));
 const result=computeLeagueAwards({records,live:{},event:checkedEvent,gameweek:GW,coverage:{complete:false,total:58,loaded:55,reason:'3 picks missing'}});
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.final,false);
 assert.equal(result.coverage.total,58);
 assert.equal(result.coverage.loaded,55);
 assert.ok(result.categories.every(c=>c.scope==='LOADED_SAMPLE'&&c.provisional===true));
 // total says 58 but only 55 loaded must not be COMPLETE even if the flag is claimed
 const lying=computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(58)});
 assert.equal(lying.status,'PARTIAL');
});

test('final needs a complete league AND an FPL data_checked gameweek',()=>{
 const records=Array.from({length:10},(_,i)=>team(i+1,{points:30+i}));
 assert.equal(computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(10)}).final,true);
 const live=computeLeagueAwards({records,event:liveEvent,gameweek:GW,coverage:completeCoverage(10)});
 assert.equal(live.status,'COMPLETE');assert.equal(live.final,false);
 assert.ok(live.categories.every(c=>c.provisional));
 assert.equal(computeLeagueAwards({records,event:{finished:true,data_checked:false},gameweek:GW,coverage:completeCoverage(10)}).final,false);
});

test('ties: all 42 winners are returned, none truncated',()=>{
 const records=Array.from({length:58},(_,i)=>team(i+1,{points:i<42?70:40}));
 const top=byId(computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(58)}),'top_scorer');
 assert.equal(top.status,'WINNERS');
 assert.equal(top.winners.length,42);
 assert.equal(new Set(top.winners.map(w=>w.id)).size,42);
});

test('all-equal field has an explicit status, not a winner and not a silent empty list',()=>{
 const records=Array.from({length:6},(_,i)=>team(i+1,{points:44}));
 const result=computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(6)});
 assert.equal(byId(result,'top_scorer').status,'ALL_EQUAL');
 assert.equal(byId(result,'tough_week').status,'ALL_EQUAL');
 assert.deepEqual(byId(result,'top_scorer').winners,[]);
 assert.equal(pickWinners([{id:1,name:'a',value:5}],{separate:true}).status,'INSUFFICIENT_FIELD');
});

test('net = gross - hit once; gross 10/hit 4 loses to gross 8/hit 0; negative points are valid',()=>{
 const records=[team(1,{points:10,hit:4}),team(2,{points:8,hit:0}),team(3,{points:-2,hit:0})];
 const result=computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(3)});
 assert.deepEqual(names(byId(result,'top_scorer')),['Team 2']);
 assert.deepEqual(names(byId(result,'tough_week')),['Team 3']);
 assert.equal(byId(result,'tough_week').winners[0].value,-2);
});

test('unknown hit or points is excluded, never treated as 0',()=>{
 const unknown=team(1,{points:60});delete unknown.picks.entry_history.event_transfers_cost;
 const records=[unknown,team(2,{points:20}),team(3,{points:22})];
 const top=byId(computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(3)}),'top_scorer');
 assert.deepEqual(names(top),['Team 3']);
 assert.equal(top.unknown_or_ineligible,1);
});

test('captain: 8x2=16, 8x3=24, VC takeover not doubled',()=>{
 const live={10:{stats:{total_points:8,minutes:90}},11:{stats:{total_points:6,minutes:90}}};
 const mk=(captainId,vcId,m)=>({picks:{picks:[{element:captainId,position:1,multiplier:m.c,is_captain:true},{element:vcId,position:2,multiplier:m.v,is_vice_captain:true}]}});
 assert.equal(captainContribution(mk(10,11,{c:2,v:1}),live),16);
 assert.equal(captainContribution(mk(10,11,{c:3,v:1}),live),24);
 const takeover=mk(99,11,{c:1,v:2});
 assert.equal(captainContribution(takeover,{...live,99:{stats:{total_points:0,minutes:0}}}),12);
 assert.equal(captainContribution(mk(10,11,{c:2,v:1}),{}),null);
});

test('armband miss: a captain whose match has not been played is not labelled bad before the GW is checked',()=>{
 const live={1:{stats:{total_points:0,minutes:0}},2:{stats:{total_points:1,minutes:90}},3:{stats:{total_points:6,minutes:90}}};
 const t=(rank,cap)=>team(rank,{picks:[{element:cap,position:1,multiplier:2,is_captain:true},...Array.from({length:14},(_,i)=>({element:900+rank*20+i,position:i+2,multiplier:i<10?1:0}))]});
 const records=[t(1,1),t(2,2),t(3,3)];
 const duringGw=byId(computeLeagueAwards({records,live,event:liveEvent,gameweek:GW,coverage:completeCoverage(3)}),'armband_miss');
 assert.deepEqual(names(duringGw),['Team 2']);
 const afterCheck=byId(computeLeagueAwards({records,live,event:checkedEvent,gameweek:GW,coverage:completeCoverage(3)}),'armband_miss');
 assert.deepEqual(names(afterCheck),['Team 1']);
});

test('bench regret needs >=20 raw bench points and no Bench Boost',()=>{
 const records=[team(1,{bench:24}),team(2,{bench:31,chip:'bboost'}),team(3,{bench:19}),team(4,{bench:2})];
 const result=byId(computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(4)}),'bench_regret');
 assert.deepEqual(names(result),['Team 1']);
});

test('chip and no-chip cohorts are disjoint',()=>{
 const records=[team(1,{points:90,chip:'wildcard'}),team(2,{points:60}),team(3,{points:70})];
 const result=computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(3)});
 assert.deepEqual(names(byId(result,'chip_performer')),['Team 1']);
 assert.deepEqual(names(byId(result,'no_chip_performer')),['Team 3']);
});

test('value leader uses the published value in tenths and does not add the bank again',()=>{
 const records=[team(1,{value:1040}),team(2,{value:1003})];
 const winner=byId(computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(2)}),'value_leader').winners[0];
 assert.equal(winner.value,1040);
});

test('unique player haul: owned once among 20 but twice among 58 is NOT unique',()=>{
 const shared=777;
 const records=Array.from({length:58},(_,i)=>team(i+1,{points:40}));
 // team 5 and team 50 both own 777 as a starter; team 5 is on "page 1", team 50 is not
 for(const rank of [5,50])records[rank-1].picks.picks[3]={element:shared,position:4,multiplier:1};
 // team 6 owns a genuinely unique starter 888
 records[5].picks.picks[3]={element:888,position:4,multiplier:1};
 const live={777:{stats:{total_points:15}},888:{stats:{total_points:9}}};
 const full=byId(computeLeagueAwards({records,live,event:checkedEvent,gameweek:GW,coverage:completeCoverage(58)}),'unique_haul');
 assert.deepEqual(names(full),['Team 6']);
 const page1=records.slice(0,20);
 assert.equal(byId(computeLeagueAwards({records:page1,live,event:checkedEvent,gameweek:GW,coverage:{complete:false,total:null,loaded:20}}),'unique_haul').status,'UNAVAILABLE');
});

test('league position change (+6) is a separate category from overall-rank change (442871)',()=>{
 const mkHistory=(prev,now)=>({current:[{event:GW-1,overall_rank:prev},{event:GW,overall_rank:now}]});
 const records=[team(4,{last_rank:10,history:mkHistory(500000,57129)}),team(5,{last_rank:5,history:mkHistory(300000,310000)}),team(6,{last_rank:3,history:mkHistory(100000,120000)})];
 const result=computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(3)});
 const league=byId(result,'league_riser'),overall=byId(result,'overall_rank_riser');
 assert.equal(league.winners[0].value,6);
 assert.equal(league.unit,'league places');
 assert.equal(overall.winners[0].value,442871);
 assert.equal(overall.unit,'OR places');
 assert.notEqual(league.winners[0].value,overall.winners[0].value);
});

test('Haaland owned by 48/58 and captained by 42 gives EO 155.1724 (no chip)',()=>{
 const records=Array.from({length:58},(_,i)=>{
  const owns=i<48,cap=i<42;
  const picks=Array.from({length:15},(_,k)=>({element:k===0&&owns?1:1000+i*20+k,position:k+1,multiplier:k<11?(k===0&&owns&&cap?2:1):0,is_captain:k===0&&owns&&cap}));
  return team(i+1,{picks});
 });
 const m=leagueOwnershipMetrics(records,58)[1];
 assert.equal(m.owned,48);assert.equal(m.captain,42);
 assert.ok(Math.abs(m.eo_pct-155.1724)<0.0001,String(m.eo_pct));
 assert.ok(Math.abs(m.ownership_pct-82.7586)<0.0001);
});

test('duplicate entries make the context PARTIAL, not COMPLETE',()=>{
 const records=[team(1),team(2),team(2)];
 const result=computeLeagueAwards({records,event:checkedEvent,gameweek:GW,coverage:completeCoverage(3)});
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.final,false);
 assert.equal(result.coverage.duplicate_entries,true);
});

test('registry exposes the 12 legacy categories plus league position pair',()=>{
 for(const id of ['top_scorer','tough_week','captain_star','armband_miss','overall_rank_riser','overall_rank_faller','chip_performer','no_chip_performer','bench_regret','biggest_hit','value_leader','unique_haul'])assert.ok(AWARD_CATEGORY_IDS.includes(id),id);
 assert.ok(AWARD_CATEGORY_IDS.includes('league_riser')&&AWARD_CATEGORY_IDS.includes('league_faller'));
});

import {readFileSync} from 'node:fs';
test('bundled modules must not declare top-level names that shadow browser globals (history shadowed window.history once)',()=>{
 const shadowed=['history','location','name','event','status','top','parent','length','screen','document','window','self','open','close','stop','focus','blur','print'];
 for(const file of ['league-awards.mjs','score-context.mjs']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  for(const match of source.matchAll(/^(?:export\s+)?(?:async\s+)?(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm))
   assert.ok(!shadowed.includes(match[1]),file+' declares top-level '+match[1]);
 }
});
