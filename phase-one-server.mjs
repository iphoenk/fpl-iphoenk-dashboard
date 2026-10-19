import {createHash} from 'node:crypto';
import {makeForecast,evaluateForecast} from './phase-one.mjs';
const ROOT='forecasts/v1/';
const json=async(url,fetcher=fetch)=>{const r=await fetcher(url,{signal:AbortSignal.timeout(22000)});if(!r.ok)throw new Error('Upstream unavailable');return r.json();};
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
export async function blobArchive(){
 const sdk=await import('@vercel/blob');
 return {async read(path){const r=await sdk.get(path,{access:'private',useCache:false});if(!r||r.statusCode!==200)return null;return JSON.parse(await new Response(r.stream).text());},async write(path,value){return sdk.put(path,JSON.stringify(value),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});},async list(){const r=await sdk.list({prefix:ROOT,limit:1000});return r.blobs.map(b=>({path:b.pathname,uploaded_at:b.uploadedAt}));}};
}
export async function captureForecast({store,fetcher=fetch,now=Date.now(),clock=()=>Date.now()}={}){
 const bs=await json('https://fantasy.premierleague.com/api/bootstrap-static/',fetcher);
 const optional=await Promise.allSettled(['manifest','players'].map(n=>json('https://raw.githubusercontent.com/abdelmalek-maskri/fplens/main/app/public/data/'+n+'.json',fetcher)));
 const m=optional[0].status==='fulfilled'?optional[0].value:null,raw=optional[1].status==='fulfilled'?optional[1].value:null;
 const model=Array.isArray(raw)?Object.fromEntries(raw.map(p=>[p.element,p])):raw;
 const forecasts=makeForecast(bs,m,model,clock()),saved=[];
 for(const snapshot of [forecasts.official,forecasts.model].filter(s=>s?.players.length)){
  const path=ROOT+snapshot.season+'/gw'+snapshot.gw+'/'+snapshot.source+'.json';
  const prior=await store.read(path);if(prior){saved.push({path,status:'existing',captured_at:prior.snapshot.captured_at});continue;}
  if(clock()>=Date.parse(snapshot.deadline))throw new Error('Deadline closed during acquisition');
  snapshot.captured_at=new Date(clock()).toISOString();
  const record={snapshot,sha256:digest(snapshot)};
  try{await store.write(path,record);if(clock()>=Date.parse(snapshot.deadline))throw new Error('Deadline closed during storage');saved.push({path,status:'saved',captured_at:snapshot.captured_at});}
  catch(error){if(clock()>=Date.parse(snapshot.deadline))throw error;const raced=await store.read(path);if(!raced)throw error;saved.push({path,status:'existing',captured_at:raced.snapshot.captured_at});}
 }
 return {status:'ready',saved};
}
let lastCapture=0,capturing=null;
export async function archiveResponse(request,{storeFactory=blobArchive,fetcher=fetch,now=Date.now()}={}){
 const url=new URL(request.url),headers={'Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'};
 if(!['GET','POST'].includes(request.method))return Response.json({error:'Metode tidak didukung.'},{status:405,headers});
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return Response.json({error:'Permintaan harus berasal dari dashboard.'},{status:403,headers});
 try{
  const store=await storeFactory();
  if(request.method==='POST'){
   if(now-lastCapture<300000)return Response.json({status:'cooldown'}, {headers});
   if(!capturing){capturing=captureForecast({store,fetcher,now}).finally(()=>{capturing=null;});lastCapture=now;}
   return Response.json(await capturing,{headers});
  }
  const bs=await json('https://fantasy.premierleague.com/api/bootstrap-static/',fetcher),season=String(new Date(bs.events[0].deadline_time).getUTCFullYear());
  const paths=(await store.list()).filter(p=>p.path.startsWith(ROOT+season+'/')).sort((a,b)=>b.path.localeCompare(a.path,undefined,{numeric:true})),records=[];
  for(const p of paths.slice(0,80)){const r=await store.read(p.path);if(r?.snapshot&&(!p.uploaded_at||Date.parse(p.uploaded_at)<Date.parse(r.snapshot.deadline))&&r.sha256===digest(r.snapshot)&&Date.parse(r.snapshot.captured_at)<Date.parse(r.snapshot.deadline))records.push({...r.snapshot,sha256:r.sha256});}
  const requested=url.searchParams.get('gw'),gw=requested&&/^[1-9]\d?$/.test(requested)?Number(requested):records[0]?.gw;
  const selected=records.filter(r=>r.gw===gw),event=bs.events.find(e=>e.id===gw);let results=[];
  if(selected.length){const fixtures=await json('https://fantasy.premierleague.com/api/fixtures/',fetcher),relevant=fixtures.filter(f=>f.event===gw),final=!!event?.finished&&event.data_checked===true&&relevant.length>0&&relevant.every(f=>f.finished===true);
   const live=final?await json('https://fantasy.premierleague.com/api/event/'+gw+'/live/',fetcher):null;
   results=selected.map(r=>({source:r.source,model:r.model,captured_at:r.captured_at,deadline:r.deadline,coverage:r.players.length,universe:r.universe,sha256:r.sha256,...evaluateForecast(r,live,final)}));
  }
  return Response.json({status:'ready',storage:'private',capture_mode:'on-visit',gameweek:gw||null,archives:records.map(r=>({gw:r.gw,source:r.source,captured_at:r.captured_at,deadline:r.deadline,coverage:r.players.length,universe:r.universe,sha256:r.sha256})),results},{headers});
 }catch{return Response.json({status:'unavailable',error:'Arsip belum tersedia. Data FPL dan evaluasi sumber tetap dapat digunakan.'},{status:503,headers});}
}
