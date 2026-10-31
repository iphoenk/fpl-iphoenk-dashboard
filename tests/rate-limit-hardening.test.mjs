import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRateLimit,clientKey,normalizeIp,rateLimitRule,createRateLimitStore,rateLimitResponse,RATE_LIMITS} from '../rate-limit.mjs';
import handler from '../api/index.js';

const req=(headers={},url='https://site.test/api/decision')=>new Request(url,{headers});

test('x-vercel-forwarded-for wins over x-real-ip and x-forwarded-for',()=>{
 assert.equal(clientKey(req({'x-vercel-forwarded-for':'9.9.9.9','x-real-ip':'8.8.8.8','x-forwarded-for':'1.1.1.1, 2.2.2.2'})),'9.9.9.9');
 assert.equal(clientKey(req({'x-real-ip':'8.8.8.8','x-forwarded-for':'1.1.1.1'})),'8.8.8.8');
 assert.equal(clientKey(req({'x-forwarded-for':'1.1.1.1, 2.2.2.2'})),'1.1.1.1');
 assert.equal(clientKey(req()),'unknown');
});

test('IPv6 collapses to /64, IPv4-mapped unwraps, junk is not treated as structured',()=>{
 const a=normalizeIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd'),b=normalizeIp('2001:0db8:0001:0002::1'),c=normalizeIp('2001:db8:1:3::1');
 assert.equal(a,b);assert.notEqual(a,c);
 assert.equal(a,'2001:db8:1:2::/64');
 assert.equal(normalizeIp('::ffff:203.0.113.5'),'203.0.113.5');
 assert.equal(normalizeIp('  203.0.113.5 '),'203.0.113.5');
 assert.equal(normalizeIp(''),'');
 assert.equal(normalizeIp('x'.repeat(80)),'');
 assert.equal(normalizeIp('2001:zz::1'),'2001:zz::1');
});

test('rotating addresses inside one IPv6 /64 shares a single budget',()=>{
 const store=createRateLimitStore();
 let limited=0;
 for(let i=0;i<30;i++)if(checkRateLimit('decision',req({'x-vercel-forwarded-for':'2001:db8:aa:bb::'+i.toString(16)}),{limit:20,store,clock:()=>0}).limited)limited++;
 assert.equal(limited,10);
});

test('store stays bounded under many distinct clients and sweeps expired buckets',()=>{
 const store=createRateLimitStore();let now=0;
 for(let i=0;i<500;i++)checkRateLimit('decision',req({'x-vercel-forwarded-for':'10.0.'+(i>>8)+'.'+(i&255)}),{limit:5,store,clock:()=>now,maxKeys:50});
 assert.ok(store.size<=50,'size '+store.size);
 now=61000;
 checkRateLimit('decision',req({'x-vercel-forwarded-for':'192.0.2.1'}),{limit:5,store,clock:()=>now,maxKeys:50});
 assert.equal(store.size,1,'expired buckets are swept on the next window');
});

test('an active abuser is still limited while the store is below the cap',()=>{
 const store=createRateLimitStore();
 const r=req({'x-vercel-forwarded-for':'198.51.100.7'});
 for(let i=0;i<5;i++)assert.equal(checkRateLimit('decision',r,{limit:5,store,clock:()=>0,maxKeys:50}).limited,false);
 assert.equal(checkRateLimit('decision',r,{limit:5,store,clock:()=>0,maxKeys:50}).limited,true);
});

test('MULTI-INSTANCE CHARACTERIZATION: each warm instance keeps its own budget, so the global ceiling is instances x limit',async()=>{
 const instances=4,limit=20,r=req({'x-vercel-forwarded-for':'203.0.113.50'});
 let allowed=0;
 for(let n=0;n<instances;n++){
  // A distinct module URL gives a distinct module instance, i.e. a separate in-memory store, like a separate serverless instance.
  const mod=await import('../rate-limit.mjs?instance='+n);
  for(let i=0;i<limit+5;i++)if(!mod.checkRateLimit('decision',r,{limit}).limited)allowed++;
 }
 assert.equal(allowed,instances*limit,'documented limitation: not a global per-IP guarantee');
});

test('rule table covers the expensive endpoints only, with slash-insensitive matching',()=>{
 for(const p of ['/api/decision','/api/decision/','/api/own-model','/api/insights/snapshot','/api/news/headlines/','/api/core/evidence'])assert.ok(rateLimitRule(p),p);
 for(const p of ['/api/bootstrap-static/','/api/entry/1/','/api/fixtures/','/api/decision/health','/','/api/model/players'])assert.equal(rateLimitRule(p),null,p);
 const names=Object.values(RATE_LIMITS).map(v=>v.name);
 assert.equal(new Set(names).size,names.length,'namespaces must not share a budget');
});

test('429 response is never cacheable and carries Retry-After',async()=>{
 const r=rateLimitResponse(12);
 assert.equal(r.status,429);
 assert.equal(r.headers.get('retry-after'),'12');
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('vercel-cdn-cache-control'),'no-store');
 assert.equal((await r.json()).status,'unavailable');
});

test('api/index.js limits HEAD as well as GET on fan-out endpoints, and leaves the Official proxy alone',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({elements:[],events:[]}));
 const headers={'x-vercel-forwarded-for':'203.0.113.99'};
 let saw429=false,firstLimitedAt=null;
 for(let i=0;i<14;i++){
  const r=await handler.fetch(new Request('https://site.test/api/core/evidence',{method:i%2?'HEAD':'GET',headers}));
  if(r.status===429){saw429=true;firstLimitedAt??=i+1;assert.equal(r.headers.get('cache-control'),'no-store');}
 }
 assert.ok(saw429,'GET+HEAD share one budget');
 assert.equal(firstLimitedAt,11,'limit is 10 per window; the 11th request is the first rejected');
 for(let i=0;i<60;i++){
  const r=await handler.fetch(new Request('https://site.test/api/bootstrap-static',{headers}));
  assert.notEqual(r.status,429,'proxy request '+i);
 }
 const other=await handler.fetch(new Request('https://site.test/api/core/evidence',{headers:{'x-vercel-forwarded-for':'198.51.100.1'}}));
 assert.notEqual(other.status,429,'a different client is unaffected');
});
