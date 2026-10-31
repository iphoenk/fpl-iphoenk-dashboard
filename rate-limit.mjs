/* Best-effort per-IP rate limiting for expensive public endpoints
   (/api/decision, /api/own-model). Both sit in front of a shared bounded
   concurrency pool (see multiuser-decision-server.mjs / own-model-server.mjs);
   this stops one noisy client from exhausting that pool for everyone else.

   Vercel Edge Functions are stateless across cold starts and may run as
   multiple concurrent isolates, so this is a single-isolate, best-effort
   limiter, not a durable or distributed one. It still meaningfully raises
   the cost of sustained abuse within a warm isolate, which is the gap this
   closes (see audit roadmap item #3). */
const buckets=new Map();
export function clientKey(request){
 const xff=request.headers?.get?.('x-forwarded-for');
 if(xff){const first=xff.split(',')[0].trim();if(first)return first;}
 const real=request.headers?.get?.('x-real-ip');
 return real||'unknown';
}
export function checkRateLimit(name,request,{limit=20,windowMs=60000,store=buckets,clock=Date.now}={}){
 const now=clock();
 const key=name+':'+clientKey(request);
 const entry=store.get(key);
 if(!entry||now-entry.start>=windowMs){
  store.set(key,{start:now,count:1});
  return {limited:false};
 }
 entry.count++;
 if(entry.count>limit)return {limited:true,retryAfter:Math.max(1,Math.ceil((entry.start+windowMs-now)/1000))};
 return {limited:false};
}
export function rateLimitResponse(retryAfter){
 return Response.json({status:'unavailable',error:'Too many requests. Please wait before retrying.'},
  {status:429,headers:{'Retry-After':String(retryAfter),'Cache-Control':'no-store'}});
}
export function createRateLimitStore(){return new Map();}
