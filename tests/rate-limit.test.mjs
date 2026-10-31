import {test} from 'node:test';import assert from 'node:assert/strict';
import {checkRateLimit,rateLimitResponse,clientKey,createRateLimitStore} from '../rate-limit.mjs';

test('allows requests under the limit and blocks the one that exceeds it within the window',()=>{
 const store=createRateLimitStore();let now=1000;
 const req=new Request('https://site.test/api/decision?entry_id=1',{headers:{'x-forwarded-for':'1.2.3.4'}});
 for(let i=0;i<5;i++)assert.equal(checkRateLimit('decision',req,{limit:5,store,clock:()=>now}).limited,false);
 const blocked=checkRateLimit('decision',req,{limit:5,store,clock:()=>now});
 assert.equal(blocked.limited,true);assert.ok(blocked.retryAfter>=1);
});

test('resets the window after it elapses',()=>{
 const store=createRateLimitStore();let now=0;
 const req=new Request('https://site.test/api/decision',{headers:{'x-forwarded-for':'9.9.9.9'}});
 for(let i=0;i<3;i++)checkRateLimit('decision',req,{limit:3,windowMs:60000,store,clock:()=>now});
 assert.equal(checkRateLimit('decision',req,{limit:3,windowMs:60000,store,clock:()=>now}).limited,true);
 now=61000;
 assert.equal(checkRateLimit('decision',req,{limit:3,windowMs:60000,store,clock:()=>now}).limited,false);
});

test('tracks distinct IPs and distinct endpoint names independently',()=>{
 const store=createRateLimitStore();const now=0;
 const reqA=new Request('https://site.test/api/decision',{headers:{'x-forwarded-for':'1.1.1.1'}});
 const reqB=new Request('https://site.test/api/decision',{headers:{'x-forwarded-for':'2.2.2.2'}});
 for(let i=0;i<2;i++)checkRateLimit('decision',reqA,{limit:2,store,clock:()=>now});
 assert.equal(checkRateLimit('decision',reqA,{limit:2,store,clock:()=>now}).limited,true);
 assert.equal(checkRateLimit('decision',reqB,{limit:2,store,clock:()=>now}).limited,false);
 assert.equal(checkRateLimit('own-model',reqA,{limit:2,store,clock:()=>now}).limited,false);
});

test('clientKey prefers the first x-forwarded-for hop, falls back to x-real-ip, then unknown',()=>{
 assert.equal(clientKey(new Request('https://site.test/',{headers:{'x-forwarded-for':'5.5.5.5, 6.6.6.6'}})),'5.5.5.5');
 assert.equal(clientKey(new Request('https://site.test/',{headers:{'x-real-ip':'7.7.7.7'}})),'7.7.7.7');
 assert.equal(clientKey(new Request('https://site.test/')),'unknown');
});

test('rateLimitResponse returns 429 with Retry-After and no caching', async()=>{
 const r=rateLimitResponse(7);
 assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'7');assert.equal(r.headers.get('cache-control'),'no-store');
 const body=await r.json();assert.equal(body.status,'unavailable');
});
