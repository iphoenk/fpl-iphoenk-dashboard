import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRateLimit,clientKey,createRateLimitStore,rateLimitResponse,RATE_LIMITS,MAX_KEYS} from '../rate-limit.mjs';

// Audit tests for PR #237 (head f6cd844). They quantify false positives and pin the documented limits.
const ip=(addr)=>new Request('https://site.test/api/decision',{headers:{'x-vercel-forwarded-for':addr}});
const clockAt=(t)=>({now:t.start,clock:()=>t.now});

test('SHARED IP (office/school NAT): a normal page load per user is not limited for several users',()=>{
 // Worst-case page load (UI call sites, every optional view opened): 1 decision (default horizon), 1 own-model, 1 news, 1 snapshot, 1 evidence.
 const store=createRateLimitStore(),t={now:1_000_000};const o={store,clock:()=>t.now};
 const perUser=[['decision',1],['own-model',1],['news-headlines',1],['insights-snapshot',1],['core-evidence',1]];
 let limited=0;
 for(let user=0;user<8;user++)for(const [name,n] of perUser)for(let i=0;i<n;i++)
  if(checkRateLimit(name,ip('203.0.113.7'),{...o,limit:Object.values(RATE_LIMITS).find(r=>r.name===name).limit}).limited)limited++;
 assert.equal(limited,0,'8 users behind one IP, all cache misses, in one window');
});

test('SHARED IP threshold: users who also switch to 3 GW and 5 GW use 3 decision calls each, so 7 such users exceed 20/min',()=>{
 const store=createRateLimitStore(),t={now:1_500_000};
 let first=null,n=0;
 for(let user=1;user<=8&&first===null;user++)for(let h=0;h<3;h++){n++;if(checkRateLimit('decision',ip('203.0.113.8'),{store,clock:()=>t.now,limit:20}).limited){first=user;break;}}
 assert.equal(first,7,'false positive begins with the 7th heavy user behind one IP inside one minute (cache misses only)');
});

test('SHARED IP threshold is documented: the 11th cache-missing user inside one window hits the 10/min fan-out budget',()=>{
 const store=createRateLimitStore(),t={now:2_000_000};
 const results=[];
 for(let user=1;user<=11;user++)results.push(checkRateLimit('news-headlines',ip('198.51.100.9'),{store,clock:()=>t.now,limit:10}).limited);
 assert.deepEqual(results.slice(0,10).every(x=>x===false),true);
 assert.equal(results[10],true,'false positive only when >10 uncached requests/min share one IP');
 // A different NAT is unaffected.
 assert.equal(checkRateLimit('news-headlines',ip('198.51.100.10'),{store,clock:()=>t.now,limit:10}).limited,false);
});

test('MANY entry_ids from one IP share the /api/decision budget (20/min), per-IP not per-entry',()=>{
 const store=createRateLimitStore(),t={now:3_000_000};
 const res=Array.from({length:22},()=>checkRateLimit('decision',ip('192.0.2.50'),{store,clock:()=>t.now,limit:20}));
 assert.equal(res.filter(r=>r.limited).length,2);
 assert.equal(res[19].limited,false);assert.equal(res[20].limited,true);
});

test('429 carries a positive integer Retry-After that shrinks with time and the budget resets after the window',async()=>{
 const store=createRateLimitStore(),t={now:4_000_000};const o={store,clock:()=>t.now,limit:2,windowMs:60000};
 checkRateLimit('decision',ip('192.0.2.1'),o);checkRateLimit('decision',ip('192.0.2.1'),o);
 const first=checkRateLimit('decision',ip('192.0.2.1'),o);
 assert.equal(first.limited,true);assert.equal(first.retryAfter,60);
 t.now+=45_000;
 const later=checkRateLimit('decision',ip('192.0.2.1'),o);
 assert.equal(later.retryAfter,15);
 const res=rateLimitResponse(later.retryAfter);
 assert.equal(res.status,429);assert.equal(res.headers.get('Retry-After'),'15');
 assert.equal(res.headers.get('Cache-Control'),'no-store');assert.equal(res.headers.get('Vercel-CDN-Cache-Control'),'no-store');
 assert.match(String((await res.json()).error),/Too many requests/);
 t.now+=15_000;
 assert.equal(checkRateLimit('decision',ip('192.0.2.1'),o).limited,false,'new window admits again');
});

test('IPv6: different /64 prefixes keep separate budgets, the same /64 shares one; IPv4-mapped equals its IPv4',()=>{
 const store=createRateLimitStore(),t={now:5_000_000},o={store,clock:()=>t.now,limit:1};
 assert.equal(checkRateLimit('decision',ip('2001:db8:1:1::1'),o).limited,false);
 assert.equal(checkRateLimit('decision',ip('2001:db8:1:2::1'),o).limited,false,'other /64 is a different client');
 assert.equal(checkRateLimit('decision',ip('2001:db8:1:1:ffff::9'),o).limited,true,'same /64 shares the budget');
 assert.equal(clientKey(ip('::ffff:203.0.113.5')),'203.0.113.5');
});

test('LIMITATION (characterization): flooding MAX_KEYS distinct clients evicts the oldest bucket, so an old abuser counter resets',()=>{
 const store=createRateLimitStore(),t={now:6_000_000},o={store,clock:()=>t.now,limit:2,maxKeys:50};
 for(let i=0;i<3;i++)checkRateLimit('decision',ip('192.0.2.77'),o);
 assert.equal(checkRateLimit('decision',ip('192.0.2.77'),o).limited,true);
 for(let i=0;i<60;i++){t.now+=1;checkRateLimit('decision',ip('10.0.'+Math.floor(i/200)+'.'+(i%200)),o);}
 assert.equal(checkRateLimit('decision',ip('192.0.2.77'),o).limited,false,'oldest bucket was evicted; requires many distinct source IPs');
 assert.ok(store.size<=50);
 assert.equal(MAX_KEYS,5000);
});

test('LIMITATION (characterization): without any client-IP header every client shares the single "unknown" bucket',()=>{
 const store=createRateLimitStore(),t={now:7_000_000},o={store,clock:()=>t.now,limit:3};
 const anon=()=>new Request('https://site.test/api/decision');
 const res=[1,2,3,4].map(()=>checkRateLimit('decision',anon(),o).limited);
 assert.deepEqual(res,[false,false,false,true]);
 // Vercel always supplies the header; this only matters for non-Vercel hosting or direct invocation.
});
