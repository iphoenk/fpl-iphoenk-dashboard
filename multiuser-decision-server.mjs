import {publicDecision} from './multiuser-decision.mjs';
const ROOT='https://fantasy.premierleague.com/api/';
export function createPublicDecisionService({fetcher=fetch,clock=Date.now,maxActive=4,maxWaiting=40}={}){
 let shared=null,sharedPending=null,active=0,peak=0,calls=0;
 const waiting=[],cache=new Map(),pending=new Map();
 async function official(path){calls++;
  const r=await fetcher(ROOT+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error('OFFICIAL_UNAVAILABLE');
  return r.json();
 }
 async function bootstrap(){
  if(shared&&clock()-shared.time<120000)return shared.value;
  if(!sharedPending)sharedPending=official('bootstrap-static/').then(value=>{
   if(!Array.isArray(value.elements)||!Array.isArray(value.events)||value.elements.length<15)throw Error('BAD_BOOTSTRAP');
   shared={time:clock(),value};return value;
  }).finally(()=>{sharedPending=null;});
  return sharedPending;
 }
 async function bounded(task){
  if(active>=maxActive){
   if(waiting.length>=maxWaiting)throw Error('BUSY');
   await new Promise(resolve=>waiting.push(resolve));
  }else active++;
  peak=Math.max(peak,active);
  try{return await task();}
  finally{if(waiting.length)waiting.shift()();else active--;}
 }
 async function compute(id){
  const data=await bootstrap();
  const upcoming=data.events.find(x=>x.is_next)||data.events.find(x=>!x.finished);
  const pub=data.events.find(x=>x.is_current)||[...data.events].reverse().find(x=>x.finished);
  if(!upcoming?.id||!pub?.id)throw Error('GW_UNAVAILABLE');
  const [entry,picks]=await Promise.all([official('entry/'+id+'/'),official('entry/'+id+'/event/'+pub.id+'/picks/')]);
  if(Number(entry?.id)!==id||!Array.isArray(picks?.picks)||picks.picks.length!==15)throw Error('BAD_OFFICIAL_ENTRY');
  const result=publicDecision({entry,picks,bootstrap:data,planningGw:upcoming.id});
  return {...result,generated_at:new Date(clock()).toISOString(),source:{provider:'Official FPL',entry_id:id,published_gw:pub.id,planning_gw:upcoming.id}};
 }
 async function get(id){
  const saved=cache.get(id);
  if(saved&&clock()-saved.time<45000)return saved.data;
  if(pending.has(id))return pending.get(id);
  const task=bounded(()=>compute(id)).then(data=>{
   if(['ready','partial'].includes(data.status)){
    cache.delete(id);cache.set(id,{time:clock(),data});
    while(cache.size>100)cache.delete(cache.keys().next().value);
   }
   return data;
  }).finally(()=>pending.delete(id));
  pending.set(id,task);return task;
 }
 return {get,stats:()=>({active,waiting:waiting.length,peak,upstreamCalls:calls,cache:cache.size})};
}
const sharedService=createPublicDecisionService();
export async function publicDecisionResponse(request,{service=sharedService}={}){
 const url=new URL(request.url);
 if(!/^\/api\/decision\/?$/.test(url.pathname))return null;
 const noStore={'Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'};
 if(request.method!=='GET')return Response.json({status:'unavailable',error:'Read-only'},{status:405,headers:noStore});
 const id=url.searchParams.get('entry_id');
 if(!id||!/^[1-9]\d{0,9}$/.test(id))return Response.json({status:'unavailable',error:'Invalid FPL entry ID'},{status:400,headers:noStore});
 try{
  const data=await service.get(Number(id));
  const headers=['ready','partial'].includes(data.status)?{'Cache-Control':'public, max-age=15, s-maxage=45','Vercel-CDN-Cache-Control':'public, s-maxage=45'}:noStore;
  return Response.json(data,{headers:{...headers,'X-Content-Type-Options':'nosniff'}});
 }catch(error){
  const busy=error?.message==='BUSY';
  return Response.json({status:'unavailable',error:busy?'Please retry shortly':'Official FPL public data unavailable',retryable:true},
   {status:busy?429:503,headers:{...noStore,'Retry-After':busy?'10':'30'}});
 }
}
