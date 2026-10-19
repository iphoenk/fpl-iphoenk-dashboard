import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCaptainHistory} from '../phase-two.mjs';
test('final fixtures only; DGW points aggregate and duplicate fixtures do not inflate history',()=>{
 const h=[{round:1,fixture:11,minutes:90,total_points:6,starts:1},{round:1,fixture:11,minutes:90,total_points:6,starts:1},{round:1,fixture:12,minutes:60,total_points:4,starts:1},{round:2,fixture:13,minutes:0,total_points:0,starts:0},{round:3,fixture:14,minutes:90,total_points:20,starts:1}];
 const s=summarizeCaptainHistory(h,[11,12,13]);assert.equal(s.weeks.length,2);assert.equal(s.mean,5);assert.equal(s.haulRate,50);assert.equal(s.sixtyRate,200/3);assert.equal(s.startRate,200/3);assert.equal(s.spread,5);
});
test('missing is unknown; zero is real; no final history has no invented rates',()=>{
 assert.equal(summarizeCaptainHistory([],[]).mean,null);
 const s=summarizeCaptainHistory([{round:1,fixture:1,minutes:null,total_points:null},{round:2,fixture:2,minutes:0,total_points:0}],[1,2]);
 assert.equal(s.mean,0);assert.equal(s.startRate,null);assert.equal(s.sixtyRate,0);assert.equal(s.weeks[0].points,null);
});
test('empty projection is unknown while numerical zero remains valid',async()=>{const {captainProjectionValue}=await import('../phase-two.mjs');for(const v of [null,undefined,'','  ','bad'])assert.equal(captainProjectionValue(v),null);assert.equal(captainProjectionValue('0'),0);});
