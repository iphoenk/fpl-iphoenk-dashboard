import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';

test('api/index.js throttles a single IP hammering /api/decision but leaves other clients and routes untouched',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({elements:[],events:[]}));
 const ip='203.0.113.77',headers={'x-forwarded-for':ip};
 let saw429=false,saw400=false;
 for(let i=0;i<25;i++){
  const r=await handler.fetch(new Request('https://dugout.vercel.app/api/decision',{headers}));
  if(r.status===429){saw429=true;assert.ok(r.headers.get('retry-after'));assert.equal(r.headers.get('cache-control'),'no-store');}
  else{assert.equal(r.status,400);saw400=true;} // missing entry_id, rejected by publicDecisionResponse itself
 }
 assert.ok(saw400,'early requests should reach the handler and be rejected for missing entry_id, not for rate limiting');
 assert.ok(saw429,'25 requests from one IP in one window should eventually trip the limiter');
 // A different client IP is not affected by the first client's usage.
 const other=await handler.fetch(new Request('https://dugout.vercel.app/api/decision',{headers:{'x-forwarded-for':'198.51.100.9'}}));
 assert.equal(other.status,400);
 // An unrelated, unrate-limited route keeps working even after the burst above.
 const fixtures=await handler.fetch(new Request('https://dugout.vercel.app/api/fixtures'));
 assert.equal(fixtures.status,200);
});
