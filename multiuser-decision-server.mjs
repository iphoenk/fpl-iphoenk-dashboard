/* Public FPL multi-user decision service. Official data is authoritative.
   V6 is read-only factual provenance; no Monte Carlo or private V12 payload. */
import {publicDecision} from './multiuser-decision.mjs';
import {multiGwDecision} from './multiuser-horizon.mjs';
const ROOT='https://fantasy.premierleague.com/api/';
const V6='https://raw.githubusercontent.com/iphoenk/FPL-iphoenk-engine/runtime-data-v6/data/v6/';
const GLOBAL='https://raw.githubusercontent.com/iphoenk/fpl-dashboard/main/public/data/';
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
function boundedPool(limit,waitingLimit){
 let active=0,peak=0;const waiting=[];
 function submit(fn){
  if(active>=limit&&waiting.length>=waitingLimit)return Promise.reject(Error('BUSY'));
  return new Promise((resolve,reject)=>{
   const go=()=>{active++;peak=Math.max(peak,active);
    Promise.resolve().then(fn).then(resolve,reject).finally(()=>{active--;if(waiting.length)waiting.shift()();});
   };
   if(active<limit)go();else waiting.push(go);
  });
 }
 return {submit,stats:()=>({active,waiting:waiting.length,peak,limit})};
}
export function createPublicDecisionService({
 fetcher=fetch,clock=Date.now,maxActive=6,maxWaiting=120,maxCompute=4,timeoutMs=9000
}={}){
 if(!Number.isInteger(maxActive)||maxActive<1||!Number.isInteger(maxWaiting)||maxWaiting<0||
    !Number.isInteger(maxCompute)||maxCompute<1)throw Error('Invalid concurrency settings');
 const io=boundedPool(maxActive,maxWaiting),cpu=boundedPool(maxCompute,maxWaiting);
 const resources=new Map(),inflight=new Map(),cache=new Map(),pending=new Map();
 let calls=0;
 async function read(key,url,ttl,byteLimit){
  const now=clock(),record=resources.get(key);
  if(record&&record.expires>now){resources.delete(key);resources.set(key,record);return record.value;}
  if(inflight.has(key))return inflight.get(key);
  const p=io.submit(async()=>{
   calls++;
   const result=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
   if(!result.ok)throw Error('UPSTREAM_'+result.status);
   if(Number(result.headers.get('content-length'))>byteLimit)throw Error('UPSTREAM_TOO_LARGE');
   const raw=await result.text();if(raw.length>byteLimit)throw Error('UPSTREAM_TOO_LARGE');
   const value=JSON.parse(raw);
   resources.delete(key);resources.set(key,{value,expires:clock()+ttl});
   while(resources.size>280)resources.delete(resources.keys().next().value);
   return value;
  });
  inflight.set(key,p);
  try{return await p;}finally{if(inflight.get(key)===p)inflight.delete(key);}
 }
 const official=(path,ttl=90000,limit=1500000)=>read('fpl:'+path,ROOT+path,ttl,limit);
 async function bootstrap(){
  const value=await official('bootstrap-static/',120000,6500000);
  if(!Array.isArray(value?.elements)||!Array.isArray(value?.events)||value.elements.length<15)
    throw Error('BAD_BOOTSTRAP');
  return value;
 }
 let v6Memo=null,v6Pending=null;
 async function provenance(){
  if(v6Memo&&clock()<v6Memo.expires)return v6Memo.value;
  if(v6Pending)return v6Pending;
  v6Pending=(async()=>{
   const [idx,integrity]=await Promise.allSettled([
    read('v6-index',V6+'evidence/latest_index.json',300000,300000),
    read('v6-integrity',V6+'health/publish_integrity.json',300000,100000)
   ]);
   const fallback={status:'UNAVAILABLE',mode:'PROVENANCE_ONLY',authority:'OFFICIAL_FPL'};
   if(idx.status!=='fulfilled'||integrity.status!=='fulfilled')return fallback;
   const source=idx.value.sources?.find(s=>s.source_id==='official_fpl');
   const ts=Date.parse(integrity.value.observed_at||idx.value.generated_at||'');
   if(integrity.value.status!=='PASS'||!Number.isFinite(ts)||ts>clock()+60000)
     return {...fallback,status:'UNVERIFIED'};
   return {status:clock()-ts>6*3600000?'STALE':'VERIFIED',
     mode:'PROVENANCE_ONLY',authority:'OFFICIAL_FPL',observed_at:new Date(ts).toISOString(),
     official_source_health:source?.health||'UNAVAILABLE'};
  })().catch(()=>({status:'UNAVAILABLE',mode:'PROVENANCE_ONLY',authority:'OFFICIAL_FPL'}))
   .then(value=>{v6Memo={value,expires:clock()+(value.status==='UNAVAILABLE'?30000:120000)};return value;})
   .finally(()=>{v6Pending=null;});
  return v6Pending;
 }

 let globalModelUnavailableUntil=0;
 async function globalModel(){
  // Short negative cache prevents every CPU-wave retrying one unavailable
  // shared source. Never substitute stale/invalid model values.
  if(clock()<globalModelUnavailableUntil)return null;
  const [m,p]=await Promise.allSettled([
   read('challenger-meta',GLOBAL+'meta.json',300000,100000),
   read('challenger-players',GLOBAL+'players.json',300000,1500000)
  ]);
  if(m.status!=='fulfilled'||p.status!=='fulfilled'){
   globalModelUnavailableUntil=clock()+30000;return null;
  }
  return {meta:m.value,players:p.value};
 }
 async function compute(id,horizon=3){
  const [data,v6]=await Promise.all([bootstrap(),provenance()]);
  const upcoming=data.events.find(x=>x.is_next)||data.events.find(x=>!x.finished);
  // Public squad is readable only after the preceding FPL deadline.
  const pub=data.events.filter(x=>Date.parse(x.deadline_time)<=clock()).sort((a,b)=>b.id-a.id)[0];
  if(!upcoming?.id||!pub?.id)throw Error('GW_UNAVAILABLE');
  const [entry,picks]=await Promise.all([
   official('entry/'+id+'/',90000,1000000),
   official('entry/'+id+'/event/'+pub.id+'/picks/',120000,1000000)
  ]);
  if(Number(entry?.id)!==id||!Array.isArray(picks?.picks)||picks.picks.length!==15)throw Error('BAD_OFFICIAL_ENTRY');
  const [snapshot]=await Promise.all([globalModel()]);
  const enhanced=multiGwDecision({entry,picks,bootstrap:data,planningGw:upcoming.id,snapshot,horizon,now:clock()});
  const decision=enhanced||publicDecision({entry,picks,bootstrap:data,planningGw:upcoming.id});
  const sourceMode=enhanced?'SHARED_MULTIGW_SNAPSHOT':'OFFICIAL_ONE_GW_FALLBACK';
  return {...decision,generated_at:new Date(clock()).toISOString(),
   source:{provider:'Official FPL',entry_id:id,published_gw:pub.id,planning_gw:upcoming.id,v6,model_mode:sourceMode},
   concurrency:{mode:'SHARED_INSTANCE_BOUNDED',monte_carlo:'DISABLED'}};
 }
 async function get(id,horizon=3){
  if(!Number.isSafeInteger(id)||id<1||id>9999999999)throw Error('BAD_ENTRY_ID');
  const key=id+':'+horizon;
  const saved=cache.get(key);
  if(saved&&clock()-saved.time<45000)return saved.data;
  if(pending.has(key))return pending.get(key);
  const task=cpu.submit(()=>compute(id,horizon)).then(data=>{
   if(['ready','partial'].includes(data.status)){
    cache.delete(key);cache.set(key,{time:clock(),data});
    while(cache.size>120)cache.delete(cache.keys().next().value);
   }
   return data;
  }).finally(()=>pending.delete(key));
  pending.set(key,task);
  return task;
 }
 function stats(){const i=io.stats(),c=cpu.stats();return {
  active:c.active,waiting:c.waiting,peak:c.peak,upstreamCalls:calls,cache:cache.size,
  upstreamActive:i.active,upstreamWaiting:i.waiting,upstreamPeak:i.peak,
  upstreamLimit:i.limit,computeLimit:c.limit
 };}
 return {get,stats};
}
const sharedService=createPublicDecisionService();
export async function publicDecisionResponse(request,{service=sharedService}={}){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
 if(path==='/api/decision/health')return request.method==='GET'?
  Response.json({status:'READY',service:'official-fpl-public-advisory',concurrency:service.stats()},
   {headers:{'Cache-Control':'no-store'}}):
  Response.json({error:'Read-only'},{status:405,headers:{'Cache-Control':'no-store'}});
 if(path!=='/api/decision')return null;
 const noStore={'Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'};
 if(request.method!=='GET')return Response.json({status:'unavailable',error:'Read-only'},{status:405,headers:noStore});
 const keys=[...url.searchParams.keys()],ids=url.searchParams.getAll('entry_id'),hs=url.searchParams.getAll('horizon');
 if(keys.some(k=>!['entry_id','horizon'].includes(k))||ids.length!==1||hs.length>1||
    (hs.length>0&&!['1','3','5'].includes(hs[0]))||!/^[1-9]\d{0,9}$/.test(ids[0]))
  return Response.json({status:'unavailable',error:'Invalid FPL entry ID'},{status:400,headers:noStore});
 try{
  const data=await service.get(Number(ids[0]),hs.length?Number(hs[0]):3);
  const headers=['ready','partial'].includes(data.status)?
   {'Cache-Control':'public, max-age=15, s-maxage=45','Vercel-CDN-Cache-Control':'public, s-maxage=45'}:noStore;
  return Response.json(data,{headers:{...headers,'X-Content-Type-Options':'nosniff'}});
 }catch(error){
  const busy=error?.message==='BUSY';
  return Response.json({status:'unavailable',error:busy?'Please retry shortly':'Official FPL public data unavailable',retryable:true},
    {status:busy?429:503,headers:{...noStore,'Retry-After':busy?'10':'30'}});
 }
}
