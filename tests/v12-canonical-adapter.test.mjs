import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalEndpointUrl,fetchCanonicalDecision,toDashboardDecision,validateCanonicalDecision} from '../v12-canonical-adapter.mjs';

const valid={contract:'FPL_V12_CANONICAL_DECISION_V1',status:'ready',entry_id:3462711,horizon:1,
 planning_gw:8,owned_15:Array.from({length:15},(_,i)=>({id:i+1})),
 provenance:{input_fingerprint:'abc',canonical_v12_revision:'rev-1'},
 decision:{starting_xi:[1],captain:1,vice_captain:2,monte_carlo:false}};

test('canonical adapter accepts only identity-bound versioned payloads',()=>{
 assert.equal(validateCanonicalDecision(valid,{entryId:3462711,horizon:1}).ok,true);
 assert.equal(validateCanonicalDecision({...valid,entry_id:999},{entryId:3462711,horizon:1}).reason,'CANONICAL_ENTRY_MISMATCH');
 assert.equal(validateCanonicalDecision({...valid,provenance:{input_fingerprint:'abc'}},{entryId:3462711,horizon:1}).reason,'CANONICAL_PROVENANCE_MISSING');
});

test('canonical endpoint binds manager and horizon',()=>{
 const url=canonicalEndpointUrl('https://v12.example.test/api/decision',3462711,3);
 assert.equal(new URL(url).searchParams.get('entry_id'),'3462711');
 assert.equal(new URL(url).searchParams.get('horizon'),'3');
});

test('invalid canonical upstream fails closed without becoming canonical',async()=>{
 const result=await fetchCanonicalDecision({
  baseUrl:'https://v12.example.test/api/decision',entryId:3462711,horizon:1,
  fetcher:async()=>Response.json({...valid,entry_id:99})
 });
 assert.equal(result.status,'INVALID');
 assert.equal(result.data,null);
});

test('valid canonical payload is mapped with explicit authority',()=>{
 const result=toDashboardDecision(valid);
 assert.equal(result.canonical_v12,true);
 assert.equal(result.source.authority,'CANONICAL_V12');
 assert.equal(result.provenance.canonical_v12_revision,'rev-1');
});
