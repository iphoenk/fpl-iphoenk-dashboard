import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import * as engine from '../multiuser-decision.mjs';
const positions=[1,1,2,2,2,2,2,3,3,3,3,3,4,4,4];
const squad=positions.map((element_type,i)=>({id:i+1,team:i%5+1,element_type,ep_next:((i*13)%17)/2}));
test('canonical V12 legal XI enumeration parity on reordered public squads',()=>{
 assert.equal(typeof engine.enumeratePublicXI,'function');
 const cases=Array.from({length:15},(_,i)=>[...squad.slice(i),...squad.slice(0,i)]);
 const names={1:'GK',2:'DEF',3:'MID',4:'FWD'};
 const input=cases.map(rows=>rows.map(p=>({position:names[p.element_type]})));
 const py=spawnSync(process.env.PYTHON||'python',['tests/fixtures/v12-lineup-enumeration-reference.py'],{input:JSON.stringify(input),encoding:'utf8'});
 assert.equal(py.status,0,py.stderr);
 const expected=JSON.parse(py.stdout);
 cases.forEach((rows,i)=>assert.deepEqual(engine.enumeratePublicXI(rows),expected[i]));
 assert.equal(expected[0].length,550);
});
test('exact mean-xP optimizer publishes all eight formation winners and reconciled totals',()=>{
 assert.equal(typeof engine.optimizePublicLineup,'function');
 const report=engine.optimizePublicLineup(squad);
 assert.equal(report.formation_comparison.length,8);
 assert.equal(report.optimizer.legal_xi_count,550);
 assert.equal(report.optimizer.exact_for_objective,true);
 assert.equal(report.optimizer.monte_carlo,false);
 const byId=new Map(squad.map(p=>[p.id,p]));
 for(const row of report.formation_comparison){
  assert.equal(row.starting_xi.length,11);assert.equal(row.bench.length,4);
  assert.equal(new Set([...row.starting_xi,...row.bench]).size,15);
  const sum=row.starting_xi.reduce((n,id)=>n+byId.get(id).ep_next,0)+byId.get(row.captain).ep_next;
  assert.equal(row.expected_points,Math.round(sum*100)/100);
  assert.equal(row.delta_vs_best,Math.round((row.expected_points-report.expected_points)*100)/100);
  assert.ok(row.starting_xi.includes(row.vice_captain));assert.notEqual(row.captain,row.vice_captain);
 }
 assert.deepEqual(engine.selectPublicXI(squad),Object.fromEntries(['formation','starting_xi','bench','captain','vice_captain','expected_points'].map(k=>[k,report[k]])));
});
test('fast search winner equals exhaustive XI optimizer for changing scores and ties',()=>{
 assert.equal(typeof engine.optimizePublicLineup,'function');
 for(let seed=0;seed<40;seed++){
  const rows=squad.map((p,i)=>({...p,ep_next:seed===0?5:((i*29+seed*7)%41)/3}));
  const exact=engine.optimizePublicLineup(rows),fast=engine.selectPublicXI(rows);
  assert.equal(exact.expected_points,fast.expected_points);assert.equal(exact.formation,fast.formation);
  assert.deepEqual(exact.starting_xi,fast.starting_xi);
 }
 assert.equal(engine.optimizePublicLineup(squad.slice(0,14)),null);
 assert.equal(engine.optimizePublicLineup(squad.map((p,i)=>i? p:{...p,ep_next:null})),null);
});
