import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toDashboardDecision,validateCanonicalDecision} from '../v12-canonical-adapter.mjs';

// N5 release constraint pin. FPL_V12_CANONICAL_URL must stay UNSET in production until the
// frontend renders FPL_V12_CANONICAL_DECISION_V1 (see docs/N5_V12_CONTRACT_COMPATIBILITY.md).
// If a later PR adds canonical support, update these assertions deliberately in that PR.
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const payload={status:'ready',contract:'FPL_V12_CANONICAL_DECISION_V1',entry_id:3462711,horizon:1,planning_gw:9,
 decision:{scenarios:{A:{},B:{},C:{}},monte_carlo:false},owned_15:Array.from({length:15},(_,i)=>({element:i+1})),
 provenance:{input_fingerprint:'x',canonical_v12_revision:'r'}};

test('server shape for a READY canonical V12 response is canonical_v12:true with its own contract',()=>{
 assert.equal(validateCanonicalDecision(payload,{entryId:3462711,horizon:1}).ok,true);
 const out=toDashboardDecision(payload);
 assert.equal(out.canonical_v12,true);
 assert.equal(out.contract,'FPL_V12_CANONICAL_DECISION_V1');
 assert.equal(out.source.authority,'CANONICAL_V12');
});

test('every frontend consumer fails closed on that shape (allow-list keeps public contracts only)',()=>{
 const first=read('decision-first.js'),planning=read('planning-compact.js');
 for(const [name,src] of [['decision-first.js',first],['planning-compact.js',planning]]){
  assert.match(src,/PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1/,name);
  assert.match(src,/canonical_v12(===|!==)false/,name);
  assert.doesNotMatch(src,/FPL_V12_CANONICAL_DECISION_V1/,name+' must not accept the canonical contract until a reviewed PR adds support');
 }
});

test('the production decision path only emits a canonical response when FPL_V12_CANONICAL_URL is configured',()=>{
 const server=read('multiuser-decision-server.mjs');
 assert.match(server,/canonicalBaseUrl=process\.env\.FPL_V12_CANONICAL_URL\|\|null/);
 assert.match(server,/canonical\.status==='READY'/);
});
