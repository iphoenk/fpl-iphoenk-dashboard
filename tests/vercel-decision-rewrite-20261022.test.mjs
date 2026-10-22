import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicDecisionResponse} from '../multiuser-decision-server.mjs';

test('Vercel path capture forwards decision without rejecting valid Official FPL ID',async()=>{
 const calls=[];
 const service={get:async(id,horizon)=>{calls.push([id,horizon]);return {status:'ready',entry_id:id,planning_gw:8,scenarios:{A:{expected_points:50}}};}};
 const query='?entry_id=3462711&horizon=3&path=decision';
 const response=await publicDecisionResponse(new Request('https://fpl-iphoenk.vercel.app/api/decision'+query),{service});
 assert.equal(response.status,200);
 assert.equal((await response.json()).entry_id,3462711);
 assert.deepEqual(calls,[[3462711,3]]);
});

test('Only the exact rewrite path is whitelisted, arbitrary parameters remain fail closed',async()=>{
 let requests=0;
 const service={get:async()=>{requests++;return {status:'ready'};}};
 for(const search of [
  '?entry_id=3462711&path=unknown',
  '?entry_id=3462711&path=decision&path=decision',
  '?entry_id=3462711&horizon=10&path=decision',
  '?entry_id=3462711&debug=1&path=decision',
  '?entry_id=0&path=decision',
  '?entry_id=3462711&entry_id=5&path=decision'
 ]){
  const result=await publicDecisionResponse(new Request('https://example.test/api/decision'+search),{service});
  assert.equal(result.status,400,search);
 }
 assert.equal(requests,0);
});

test('Direct provider path remains valid when Vercel path capture is absent',async()=>{
 const service={get:async(id,horizon)=>({status:'partial',entry_id:id,horizon})};
 const r=await publicDecisionResponse(new Request('https://example.test/api/decision?entry_id=3462711&horizon=1'),{service});
 assert.equal(r.status,200);
 assert.equal((await r.json()).horizon,1);
});
