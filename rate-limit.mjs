/* Best-effort per-client rate limiting for expensive public endpoints.

   Scope (see RATE_LIMITS): /api/decision and /api/own-model sit in front of a
   shared bounded concurrency pool; /api/insights/snapshot, /api/news/headlines
   and /api/core/evidence fan out to third-party hosts. The generic Official FPL
   proxy is deliberately NOT limited here: the UI legitimately issues many of
   those calls per page load and they are served from the CDN cache.

   Runtime: this is a Node serverless function on Vercel (not Edge). Every warm
   instance has its own memory, so this limiter is per instance and best-effort.
   With N concurrent instances one client can obtain up to N x limit requests per
   window. It raises the cost of sustained abuse from a single client, it is NOT
   a global guarantee. Global enforcement needs a shared store or a Vercel WAF
   rate-limit rule (production configuration, owner approval required).

   Memory: the store is bounded (MAX_KEYS); expired buckets are swept once per
   window and, at the cap, the oldest bucket is dropped. */
const buckets=new Map();
export const MAX_KEYS=5000;
const DEFAULT_WINDOW_MS=60000;

/* pathname -> { name: bucket namespace, limit: requests per window }.
   Budgets are per client and per namespace; namespaces never share a budget. */
export const RATE_LIMITS={
 '/api/decision':{name:'decision',limit:20},
 '/api/own-model':{name:'own-model',limit:20},
 '/api/insights/snapshot':{name:'insights-snapshot',limit:10},
 '/api/news/headlines':{name:'news-headlines',limit:10},
 '/api/core/evidence':{name:'core-evidence',limit:10}
};
export function rateLimitRule(pathname){
 return RATE_LIMITS[String(pathname||'').replace(/\/+$/,'')]||null;
}

/* IPv6 clients control their whole /64, so keying on the full address lets one
   host rotate through 2^64 addresses. Collapse IPv6 to its /64 prefix and
   unwrap IPv4-mapped addresses. Anything unparseable is used verbatim
   (lower-cased, length-bounded) rather than trusted as a structured IP. */
function ipv6Prefix64(ip){
 const halves=ip.split('::');
 if(halves.length>2)return null;
 const head=halves[0]?halves[0].split(':'):[];
 const tail=halves.length===2&&halves[1]?halves[1].split(':'):[];
 if(halves.length===1&&head.length!==8)return null;
 const fill=8-head.length-tail.length;
 if(halves.length===2&&fill<1)return null;
 const groups=[...head,...Array(Math.max(fill,0)).fill('0'),...tail];
 if(groups.length!==8||!groups.every(g=>/^[0-9a-f]{1,4}$/i.test(g)))return null;
 return groups.slice(0,4).map(g=>parseInt(g,16).toString(16)).join(':')+'::/64';
}
export function normalizeIp(raw){
 const ip=String(raw||'').trim().toLowerCase();
 if(!ip||ip.length>64)return '';
 if(!ip.includes(':'))return ip;
 const mapped=ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
 if(mapped)return mapped[1];
 return ipv6Prefix64(ip)||ip;
}

/* Vercel overwrites X-Forwarded-For with the client IP and does not forward
   external values (Vercel request-headers docs, last updated 2025-12-13).
   x-vercel-forwarded-for carries the same value but is not overwritten by a
   proxy placed in front of Vercel, so it is preferred. The first
   X-Forwarded-For hop and X-Real-IP remain as fallbacks for local/test runs. */
export function clientKey(request){
 const h=request.headers;
 const vercel=normalizeIp(h?.get?.('x-vercel-forwarded-for')?.split(',')[0]);
 if(vercel)return vercel;
 const real=normalizeIp(h?.get?.('x-real-ip'));
 if(real)return real;
 const xff=normalizeIp(h?.get?.('x-forwarded-for')?.split(',')[0]);
 return xff||'unknown';
}

const lastSweep=new WeakMap();
function sweep(store,now){
 for(const [key,entry] of store)if(now-entry.start>=entry.windowMs)store.delete(key);
 lastSweep.set(store,now);
}
function admit(store,key,now,windowMs,maxKeys){
 if(store.size>=maxKeys)sweep(store,now);
 else if(now-(lastSweep.get(store)??0)>=windowMs)sweep(store,now);
 while(store.size>=maxKeys)store.delete(store.keys().next().value);
 store.set(key,{start:now,count:1,windowMs});
}

export function checkRateLimit(name,request,{limit=20,windowMs=DEFAULT_WINDOW_MS,store=buckets,clock=Date.now,maxKeys=MAX_KEYS}={}){
 const now=clock();
 const key=name+':'+clientKey(request);
 const entry=store.get(key);
 if(!entry||now-entry.start>=entry.windowMs){
  store.delete(key);
  admit(store,key,now,windowMs,maxKeys);
  return {limited:false};
 }
 entry.count++;
 if(entry.count>limit)return {limited:true,retryAfter:Math.max(1,Math.ceil((entry.start+entry.windowMs-now)/1000))};
 return {limited:false};
}
export function rateLimitResponse(retryAfter){
 return Response.json({status:'unavailable',error:'Too many requests. Please wait before retrying.'},
  {status:429,headers:{'Retry-After':String(retryAfter),'Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export function createRateLimitStore(){return new Map();}
