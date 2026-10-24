import {MC_SHADOW_PATH,validateMcShadowRecord} from './mc-shadow.mjs';
const mcOfficial='https://fantasy.premierleague.com/api/bootstrap-static/';
const mcUnavailable=(source_status='SOURCE_UNAVAILABLE')=>({status:'UNAVAILABLE',source_status,applied_to_decisions:false,canonical_v12:false});
async function mcReadJson(stream,limit,signal){
 const reader=stream.getReader(),parts=[];let size=0;
 try{while(true){if(signal?.aborted)throw Error('Aborted');const {done,value}=await reader.read();if(done)break;
  size+=value.byteLength;if(size>limit)throw Error('Too large');parts.push(value);}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
 }finally{await reader.cancel().catch(()=>{});}
}
async function mcBlobStore(){
 const sdk=await import('@vercel/blob');
 return {
  async read(path,{signal}={}){
   signal?.throwIfAborted();
   const r=await sdk.get(path,{access:'private',useCache:false,abortSignal:signal});
   if(!r||r.statusCode!==200)return null;
   if(r.blob?.size>2000000){await r.stream?.cancel();throw Error('Too large');}
   return mcReadJson(r.stream,2000000,signal);
  },
  write:(path,value)=>sdk.put(path,JSON.stringify(value),{access:'private',contentType:'application/json',
   addRandomSuffix:false,allowOverwrite:true})
 };
}
async function mcBootstrap(fetcher,signal){
 const r=await fetcher(mcOfficial,{headers:{Accept:'application/json'},signal});
 if(!r.ok)throw Error('Official unavailable');
 return mcReadJson(r.body,6500000,signal);
}
export function createMcShadowService({readRecord=async(path,options)=>(await mcBlobStore()).read(path,options),
 fetcher=fetch,clock=Date.now,timeoutMs=600,enabled=process.env.FPL_MC_SHADOW_ENABLED!=='0'}={}){
 let saved=null,pending=null;
 async function get(){
  if(!enabled)return {...mcUnavailable('DISABLED'),status:'DISABLED'};
  const now=clock();if(saved&&now>=saved.checkedAt&&now<saved.until)return saved.value;
  if(pending)return pending;
  const controller=new AbortController();let timer;
  const operation=(async()=>{
   const record=await readRecord(MC_SHADOW_PATH,{signal:controller.signal});
   if(!record)return mcUnavailable('SNAPSHOT_MISSING');
   if(controller.signal.aborted)return mcUnavailable('TIMEOUT');
   const bootstrap=await mcBootstrap(fetcher,controller.signal);
   if(controller.signal.aborted)return mcUnavailable('TIMEOUT');
   const check=validateMcShadowRecord(record,{bootstrap,now:clock()});
   return check.ok?check.metadata:{...mcUnavailable('INVALID_SNAPSHOT'),status:'INVALID'};
  })().catch(()=>mcUnavailable());
  pending=Promise.race([operation,new Promise(resolve=>{timer=setTimeout(()=>{
   controller.abort();resolve(mcUnavailable('TIMEOUT'));},timeoutMs);})]).then(value=>{
    const at=clock();saved={value,checkedAt:at,until:Math.min(at+(value.status==='SHADOW_ONLY'?30000:5000),
     value.expires_at?Date.parse(value.expires_at):Infinity)};return value;
   }).finally(()=>{clearTimeout(timer);controller.abort();pending=null;});
  return pending;
 }
 return {get};
}
const mcService=createMcShadowService();
export async function mcShadowResponse(request,{service=mcService}={}){
 const url=new URL(request.url);if(!/^\/api\/mc\/shadow\/?$/.test(url.pathname))return null;
 const headers={'Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(request.method!=='GET')return Response.json({error:'Read-only'},{status:405,headers});
 // Allow only Vercel's exact rewrite artifact; never a source URL or manager query.
 const keys=[...url.searchParams.keys()];
 if(keys.some(k=>k!=='path')||url.searchParams.getAll('path').length>1||
  (url.searchParams.has('path')&&url.searchParams.get('path')!=='mc/shadow'))
  return Response.json({error:'Invalid parameters'},{status:400,headers});
 const start=performance.now(),data=await service.get();
 return Response.json(data,{headers:{...headers,'Server-Timing':'mc-shadow;dur='+(performance.now()-start).toFixed(1)}});
}
export async function publishMcShadowRecord(record,{store,fetcher=fetch,clock=Date.now}={}){
 const bootstrap=await mcBootstrap(fetcher,AbortSignal.timeout(8000));
 let check=validateMcShadowRecord(record,{bootstrap,now:clock()});
 if(!check.ok)throw Error('Invalid MC candidate');
 store??=await mcBlobStore();
 const previous=await store.read(MC_SHADOW_PATH);
 if(previous?.sha256===record.sha256)return {status:'SHADOW_ONLY',publication:'UNCHANGED'};
 if(previous){const prior=validateMcShadowRecord(previous,{bootstrap,now:clock()});
  if(prior.ok&&Date.parse(prior.metadata.generated_at)>Date.parse(check.metadata.generated_at))throw Error('Newer candidate already stored');}
 check=validateMcShadowRecord(record,{bootstrap,now:clock()});if(!check.ok)throw Error('Expired before publication');
 await store.write(MC_SHADOW_PATH,record);
 const readback=await store.read(MC_SHADOW_PATH);
 if(readback?.sha256!==record.sha256||!validateMcShadowRecord(readback,{bootstrap,now:clock()}).ok)
  throw Error('Publication readback mismatch');
 return {status:'SHADOW_ONLY',publication:'VERIFIED_PRIVATE_READBACK',applied_to_decisions:false};
}
