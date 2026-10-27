import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSeasonReview} from '../season-review.mjs';

// Hand-built season: 4 gameweeks. History rows follow the official shape (value includes the bank, tenths of £m).
const hist=(rows)=>({current:rows.map(([event,points,overall_rank,value,bank,event_transfers_cost])=>({event,points,total_points:0,overall_rank,value,bank,event_transfers_cost}))});
const events=[{id:1,average_entry_score:50},{id:2,average_entry_score:60},{id:3,average_entry_score:55},{id:4,average_entry_score:40}];
const pick=(element,over={})=>({element,multiplier:1,is_captain:false,is_vice_captain:false,...over});
const squad=(cap,vice,extra=[])=>({active_chip:null,picks:[pick(cap,{multiplier:2,is_captain:true}),pick(vice,{is_vice_captain:true}),...extra.map(e=>pick(e))]});
const live=(rows)=>({elements:rows.map(([id,minutes,total_points])=>({id,stats:{minutes,total_points}}))});

const history=hist([[1,70,500000,1000,0],[2,40,300000,1004,2],[3,80,350000,1010,4],[4,30,900000,1020,14]]);
const picks={1:squad(10,11,[12]),2:squad(10,11,[12]),3:squad(10,11,[12]),4:squad(10,11,[12])};
const lives={
 1:live([[10,90,6],[11,90,3],[12,90,10]]),   // chosen 6, best 10 (player 12)
 2:live([[10,90,9],[11,90,2],[12,90,4]]),    // chosen 9 = best (optimal)
 3:live([[10,0,0],[11,90,7],[12,90,5]]),     // captain 10 did not play: vice 11 takes over (7 x2)
 4:live([[10,90,2],[11,90,2],[12,90,8]]),    // chosen 2, best 8
};
const review=buildSeasonReview({history,picksByGw:picks,liveByGw:lives,events});

test('complete data gives a complete status and no missing gameweeks',()=>{
  assert.equal(review.status,'complete');
  assert.deepEqual(review.missingGws,[]);
  assert.deepEqual(review.captain.gws,[1,2,3,4]);
});

test('captain points use the multiplier from the picks; best is hindsight over that gameweek squad',()=>{
  const g=Object.fromEntries(review.captain.perGw.map(x=>[x.gw,x]));
  assert.equal(g[1].chosen.rawPoints,6);assert.equal(g[1].chosen.points,12);
  assert.equal(g[1].best.element,12);assert.equal(g[1].best.rawPoints,10);assert.equal(g[1].best.points,20);
  assert.equal(g[1].missed,8);assert.equal(g[1].optimal,false);
  assert.equal(g[2].optimal,true);assert.equal(g[2].missed,0);
});

test('a captain with zero minutes hands the armband to the vice, and it is flagged',()=>{
  const g3=review.captain.perGw.find(x=>x.gw===3);
  assert.equal(g3.chosen.element,11);assert.equal(g3.chosen.viceTakeover,true);
  assert.equal(g3.chosen.points,14);              // 7 x 2
  assert.equal(g3.best.element,11);assert.equal(g3.optimal,true);   // 7 is the best raw score in that squad
});

test('captain totals, accuracy and hindsight optimum are consistent with the per-gameweek rows',()=>{
  const c=review.captain;
  assert.equal(c.totalPoints,12+18+14+4);        // 48
  assert.equal(c.averagePoints,12);
  assert.equal(c.optimalPoints,20+18+14+16);     // 68
  assert.equal(c.missedPoints,c.optimalPoints-c.totalPoints);
  assert.equal(c.missedPoints,20);
  assert.deepEqual([c.optimalHits,c.scoredGws],[2,4]);
  assert.equal(c.accuracyPct,50);
  assert.equal(c.hindsight,true);
});

test('triple captain multiplies by three for both the chosen and the best',()=>{
  const p={...picks,1:{active_chip:'3xc',picks:[pick(10,{multiplier:3,is_captain:true}),pick(11,{is_vice_captain:true}),pick(12)]}};
  const r=buildSeasonReview({history,picksByGw:p,liveByGw:lives,events});
  const g1=r.captain.perGw.find(x=>x.gw===1);
  assert.equal(g1.chosen.points,18);assert.equal(g1.best.points,30);assert.equal(g1.multiplier,3);
});

test('a ranking tie with the best raw score counts as optimal',()=>{
  const l={...lives,2:live([[10,90,9],[11,90,9],[12,90,4]])};
  assert.equal(buildSeasonReview({history,picksByGw:picks,liveByGw:l,events}).captain.perGw.find(x=>x.gw===2).optimal,true);
});

test('both captain and vice without minutes scores zero and is flagged, not guessed',()=>{
  const l={...lives,3:live([[10,0,0],[11,0,0],[12,90,5]])};
  const g=buildSeasonReview({history,picksByGw:picks,liveByGw:l,events}).captain.perGw.find(x=>x.gw===3);
  assert.equal(g.chosen.points,0);assert.equal(g.chosen.noArmbandPlayer,true);
});

test('the best captain is chosen only from that gameweek squad (chip change of squad)',()=>{
  const p={...picks,2:{active_chip:'wildcard',picks:[pick(20,{multiplier:2,is_captain:true}),pick(21,{is_vice_captain:true})]}};
  const l={...lives,2:live([[20,90,3],[21,90,5],[12,90,99]])};   // 12 scored 99 but is not in the GW2 squad
  const g=buildSeasonReview({history,picksByGw:p,liveByGw:l,events}).captain.perGw.find(x=>x.gw===2);
  assert.equal(g.best.element,21);assert.equal(g.best.rawPoints,5);
});

test('a missing gameweek makes the review partial and is excluded from every captain total, never counted as zero',()=>{
  const p={...picks};delete p[2];
  const r=buildSeasonReview({history,picksByGw:p,liveByGw:lives,events});
  assert.equal(r.status,'partial');assert.deepEqual(r.missingGws,[2]);
  assert.deepEqual(r.captain.gws,[1,3,4]);
  assert.equal(r.captain.totalPoints,12+14+4);
  assert.equal(r.captain.scoredGws,3);
  const l={...lives};delete l[4];
  assert.deepEqual(buildSeasonReview({history,picksByGw:picks,liveByGw:l,events}).missingGws,[4]);
});

test('an element absent from live data is unknown: that gameweek is missing, not zero',()=>{
  const l={...lives,1:live([[11,90,3],[12,90,10]])};   // chosen captain 10 has no live row
  const r=buildSeasonReview({history,picksByGw:picks,liveByGw:l,events});
  assert.ok(r.missingGws.includes(1));
  assert.equal(r.captain.perGw.find(x=>x.gw===1),undefined);
});

test('most captained lists the effective armband holders with counts and points',()=>{
  const m=Object.fromEntries(review.captain.mostCaptained.map(x=>[x.element,x]));
  assert.deepEqual([m[10].times,m[10].points],[3,12+18+4]);
  assert.deepEqual([m[11].times,m[11].points],[1,14]);
  assert.equal(review.captain.mostCaptained[0].element,10);
});

test('rank: current, peak, journey and green/red arrows',()=>{
  const r=review.rank;
  assert.equal(r.current,900000);
  assert.deepEqual(r.peak,{value:300000,gw:2});
  assert.deepEqual(r.journey.map(x=>x.rank),[500000,300000,350000,900000]);
  assert.equal(r.greenArrows,1);assert.equal(r.redArrows,2);    // GW2 up; GW3 and GW4 down
});

test('points versus the gameweek average; equal counts as neither above nor below',()=>{
  const p=review.points;
  assert.equal(p.totalGross,220);assert.equal(p.perGwAverage,55);assert.equal(p.hitsCost,null);assert.equal(p.totalNet,null);   // transfer cost not in this history: unknown, not 0
  assert.deepEqual(p.perGw.map(x=>x.delta),[20,-20,25,-10]);
  assert.deepEqual([p.above,p.below,p.equal],[2,2,0]);
  const h=hist([[1,50,1,1000,0],[2,60,1,1000,0]]);
  const eq=buildSeasonReview({history:h,picksByGw:{},liveByGw:{},events}).points;
  assert.deepEqual([eq.above,eq.below,eq.equal],[0,0,2]);
});

test('official history points are gross; the net total subtracts the transfer cost only when it is known for every gameweek',()=>{
  const h=hist([[1,70,1,1000,0,0],[2,40,1,1000,0,4],[3,80,1,1000,0,8]]);
  const p=buildSeasonReview({history:h,picksByGw:{},liveByGw:{},events}).points;
  assert.equal(p.totalGross,190);assert.equal(p.hitsCost,12);assert.equal(p.totalNet,178);
  assert.deepEqual(p.perGw.map(x=>x.points),[70,40,80]);    // per-gameweek values stay gross, as on the official site
});

test('team value: value includes the bank; squad value is value minus bank; gain is measured from the 100.0m initial budget',()=>{
  const v=review.value;
  assert.equal(v.total,102.0);assert.equal(v.bank,1.4);assert.equal(v.squad,100.6);
  assert.equal(v.peak,102.0);assert.equal(v.gained,2.0);assert.equal(v.initialBudget,100.0);
  assert.deepEqual(v.series.map(x=>x.value),[100.0,100.4,101.0,102.0]);
});

test('rank narrative is derived from numbers with explicit rules',()=>{
  const n=review.rank.note;
  assert.equal(n.kind,'dropped_since_peak');assert.equal(n.peakGw,2);
  assert.equal(n.aboveAverageSincePeak,false);   // after GW2: +25 then -10, not a majority
  const up=buildSeasonReview({history:hist([[1,10,900000,1000,0],[2,10,500000,1000,0]]),picksByGw:{},liveByGw:{},events});
  assert.equal(up.rank.note.kind,'at_peak');
});

test('unknown stays null: no history means no rank, points or value, never zero',()=>{
  const r=buildSeasonReview({history:null,picksByGw:{},liveByGw:{},events});
  assert.equal(r.status,'empty');
  assert.equal(r.rank.current,null);assert.equal(r.value.total,null);
  assert.equal(r.captain.totalPoints,null);assert.equal(r.points.totalGross,null);assert.equal(r.captain.accuracyPct,null);
});

test('a null overall rank in history is unknown: skipped in the journey and arrows, never 0',()=>{
  const h=hist([[1,10,500000,1000,0],[2,10,null,1000,0],[3,10,400000,1000,0]]);
  const r=buildSeasonReview({history:h,picksByGw:{},liveByGw:{},events}).rank;
  assert.deepEqual(r.journey.map(x=>x.rank),[500000,null,400000]);
  assert.equal(r.peak.value,400000);assert.equal(r.current,400000);
  assert.equal(r.greenArrows,1);assert.equal(r.redArrows,0);   // GW3 vs the last known rank (GW1)
});

test('gameweeks without an average are not compared',()=>{
  const r=buildSeasonReview({history:hist([[1,70,1,1000,0],[2,30,1,1000,0]]),picksByGw:{},liveByGw:{},events:[{id:1,average_entry_score:50}]}).points;
  assert.equal(r.perGw[1].delta,null);assert.deepEqual([r.above,r.below],[1,0]);
});

test('the review never mutates its inputs',()=>{
  const before=JSON.stringify({history,picks,lives,events});
  buildSeasonReview({history,picksByGw:picks,liveByGw:lives,events});
  assert.equal(JSON.stringify({history,picks,lives,events}),before);
});
