import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('public planner exposes the actually reused canonical rules contract',async()=>{
 const module=await import('../multiuser-decision.mjs');
 assert.equal(typeof module.canonicalSquadCheck,'function');
 assert.equal(module.CANONICAL_RULES_PROVENANCE.contract,'V12_EXACT_PACKAGE_SEARCH_V1');
});
test('normalized public squads have parity with pinned canonical Python legal_squad',async()=>{
 const {canonicalSquadCheck}=await import('../multiuser-decision.mjs');
 const types=[1,1,2,2,2,2,2,3,3,3,3,3,4,4,4];
 const base=types.map((element_type,i)=>({id:i+1,team:i%5+1,element_type}));
 const fixtures=[base,base.slice(0,14),base.map((p,i)=>i===14?base[0]:p),base.map((p,i)=>i===0?{...p,element_type:2}:p),base.map(p=>({...p,team:1}))];
 for(let i=0;i<150;i++)fixtures.push(base.map((p,j)=>({...p,team:(i+j*7)%8+1,element_type:j===i%15?(i%4)+1:p.element_type})));
 const names={1:'GK',2:'DEF',3:'MID',4:'FWD'};
 const normalized=fixtures.map(rows=>rows.map(p=>({element:p.id,team_id:p.team,position:names[p.element_type]})));
 const py=spawnSync(process.env.PYTHON||'python',['tests/fixtures/v12-legal-squad-reference.py'],{input:JSON.stringify(normalized),encoding:'utf8'});
 assert.equal(py.status,0,py.stderr);
 const expected=JSON.parse(py.stdout);
 fixtures.forEach((rows,i)=>assert.deepEqual(canonicalSquadCheck(rows),expected[i],`fixture ${i}`));
 assert.deepEqual(expected.slice(0,5),[[true,'PASS'],[false,'SQUAD_SIZE'],[false,'DUPLICATE_PLAYER'],[false,'POSITION_COMPOSITION'],[false,'MAX_THREE_PER_CLUB']]);
});
