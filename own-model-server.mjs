import {providerStore} from './independent-providers.mjs';
import {blobArchive} from './phase-one-server.mjs';
import {OWN_MODEL,validateOwnModel,ownModelPath,ownRecord,readOwnRecord,ownForecast} from './own-model.mjs';
const official='https://fantasy.premierleague.com/api/';
let recentValidated=null;
async function bounded(fn,ms){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Own model operation timeout')),ms);})]);}finally{clearTimeout(timer);}}
async function json(fetcher,path){const r=await bounded(()=>fetcher(official+path,{signal:AbortSignal.timeout(7000)}),7000);if(!r.ok)throw Error('Official context unavailable');return bounded(()=>r.json(),1000);}
async function context(fetcher){const [bootstrap,fixtures]=await Promise.all([json(fetcher,'bootstrap-static/'),json(fetcher,'fixtures/')]);return {bootstrap,fixtures};}
export async function ownModelResponse(request,{storeFactory=providerStore,fetcher=fetch,clock=Date.now}={}){
 const url=new URL(request.url);if(!/^\/api\/own-model\/?$/.test(url.pathname))return null;
 const headers={'Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'};
 if(request.method!=='GET')return Response.json({status:'unavailable',error:'Read-only endpoint'},{status:405,headers});
 const requested=url.searchParams.get('ids');if([...url.searchParams.keys()].some(k=>k!=='ids')||requested!==null&&(!/^[1-9]\d{0,5}(,[1-9]\d{0,5}){0,19}$/.test(requested)||new Set(requested.split(',')).size!==requested.split(',').length))return Response.json({status:'unavailable',error:'Invalid player selection'},{status:400,headers});
 try{return await bounded(async()=>{
  const start=performance.now();let cached=recentValidated,now=clock();
  if(!cached||cached.fetcher!==fetcher||cached.storeFactory!==storeFactory||now<cached.checkedAt||now-cached.checkedAt>=30000||now>=Date.parse(cached.doc.expires_at_utc)){
   const [store,c]=await Promise.all([bounded(storeFactory,1500),context(fetcher)]),record=await bounded(()=>store.read(ownModelPath(c.bootstrap)),2500),doc=readOwnRecord(record),result=validateOwnModel(doc,{...c,now:clock()});if(!result.ok)throw Error('Own model unavailable');
   cached={doc,result,c,checkedAt:clock(),fetcher,storeFactory};recentValidated=cached;
  }
  const {doc,result,c,checkedAt}=cached;
  // Provenance remains private; browser receives only the prediction snapshot it needs.
  const {source_manifest,input_hash,...publicDoc}=doc;
  const ids=requested?requested.split(','):Object.values(result.players).filter(p=>p.status==='ready').sort((a,b)=>b.xp-a.xp).slice(0,10).map(p=>String(p.current_element_id)),players=Object.fromEntries(ids.filter(id=>result.players[id]).map(id=>[id,result.players[id]])),ttl=Math.max(0,Math.min(Math.floor((checkedAt+30000-clock())/1000),Math.floor((Date.parse(doc.expires_at_utc)-clock())/1000)));
  return Response.json({...publicDoc,players,coverage:{ready:Object.values(result.players).filter(p=>p.status==='ready').length,universe:c.bootstrap.elements.length},checked_at:new Date(checkedAt).toISOString()},{headers:{...headers,'Vercel-CDN-Cache-Control':ttl?'public, s-maxage='+ttl:'no-store','Server-Timing':'own-model;dur='+(performance.now()-start).toFixed(1)}});
 },22000);}catch{return Response.json({status:'unavailable',error:'Model eksperimen belum tersedia atau perlu diperbarui. Prediksi resmi tetap tersedia.'},{status:503,headers});}
}
export async function publishOwnModel({doc,store,archive,fetcher=fetch,clock=Date.now}){
 const c=await context(fetcher),check=validateOwnModel(doc,{...c,now:clock()});if(!check.ok||Object.values(check.players).some((r,i)=>r.status!==Object.values(doc.players)[i].status))throw Error('Invalid current model: '+check.reason);
 const deadline=Date.parse(doc.deadline_utc);if(clock()>=deadline)throw Error('Deadline closed');
 await store.write(ownModelPath(c.bootstrap),ownRecord(doc));if(clock()>=deadline)throw Error('Deadline closed during publication');
 const path='forecasts/v1/'+doc.season+'/gw'+doc.target_gw+'/'+OWN_MODEL+'.json';let status='existing';
 if(!await archive.read(path)){
  const snapshot=ownForecast(doc,c.bootstrap,clock()),record=ownRecord(snapshot);
  try{await archive.write(path,record);status='saved';}catch(error){if(!await archive.read(path))throw error;}
 }
 if(clock()>=deadline)throw Error('Deadline closed during capture');
 const readback=readOwnRecord(await store.read(ownModelPath(c.bootstrap)));if(!readback||readback.generated_at_utc!==doc.generated_at_utc)throw Error('Private read-back mismatch');
 return {status:'ready',model:OWN_MODEL,version:doc.model_version,coverage:doc.coverage,path:ownModelPath(c.bootstrap),archive:status};
}
export async function defaultPublisher(doc){return publishOwnModel({doc,store:await providerStore(),archive:await blobArchive()});}
