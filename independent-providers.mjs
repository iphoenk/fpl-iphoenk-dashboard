import {officialBundle} from './model-fallback.mjs';
import {createHash} from 'node:crypto';
const names='config_a|config_b|config_c|config_d|baseline|baseline_tweedie|position_specific|stacked_ensemble|twohead';
const allowed=p=>/^\/api\/model\/(bundle|manifest|players|best-squad|multi-gw|insights|accuracy|accuracy-history|news)$/.test(p)||new RegExp('^/api/model/predictions-('+names+')$').test(p)||['/api/insights/snapshot','/api/core/evidence'].includes(p);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const number=v=>v==null||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
export async function providerStore(){const sdk=await import('@vercel/blob');return {
 async read(path){const r=await sdk.get(path,{access:'private',useCache:false});return r?.statusCode===200?JSON.parse(await new Response(r.stream).text()):null;},
 async write(path,data){return sdk.put(path,JSON.stringify(data),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true});}
};}
function validBundle(bundle,bs,now){
 const next=bs.events.find(e=>e.is_next),m=bundle?.manifest,start=Date.parse(bs.events[0]?.deadline_time)-30*86400000,at=Date.parse(m?.generated_at);
 if(!next||m?.gameweek!==next.id||Date.parse(m.deadline)!==Date.parse(next.deadline_time)||!Number.isFinite(at)||at<start||at>now||at>=Date.parse(next.deadline_time))return false;
 const teams=new Map(bs.teams.map(t=>[t.id,t.short_name]));return bs.elements.some(p=>{const r=bundle.players?.[p.id];return r?.web_name===p.web_name&&r.team_name===teams.get(p.team)&&number(r.predicted_points)!==null;});
}
function validOptional(path,data,bs,now){
 const next=bs.events.find(e=>e.is_next),year=bs.events[0].deadline_time.slice(0,4);
 if(path==='/api/insights/snapshot'){const at=Date.parse(data?.generated);return data?.gw===next.id&&Array.isArray(data.players)&&data.scouts&&Number.isFinite(at)&&at>=Date.parse(bs.events[0].deadline_time)-30*86400000&&at<=now&&at<Date.parse(next.deadline_time);}
 if(path==='/api/core/evidence')return data?.gw===bs.events.find(e=>e.is_current)?.id&&data.season===year+'-'+(Number(year)+1)&&data.players;
 if(/\/model\/(predictions-|multi-gw|best-squad)/.test(path)){const at=Date.parse(data?.generated_at);return data?.gameweek===next.id&&Date.parse(data?.deadline)===Date.parse(next.deadline_time)&&Number.isFinite(at)&&at<=now&&at>=Date.parse(bs.events[0].deadline_time)-30*86400000;}
 return data&&typeof data==='object'&&!data.error;
}
export async function providerResponse(request,{upstream,store,storeFactory=providerStore,officialFetcher=fetch,now=Date.now(),timeoutMs=12000}={}){
 const path=new URL(request.url).pathname.replace(/\/$/,'');if(!allowed(path))return null;
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Metode tidak didukung'},{status:405});
 const started=Date.now(),bounded=async(fn,limit)=>{let timer;const wait=Math.max(1,Math.min(limit,22000-(Date.now()-started)));try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Provider timeout')),wait);})]);}finally{clearTimeout(timer);}};
 const respond=(data,mode,at)=>Response.json(data,{headers:{'Cache-Control':'public, max-age=60','Vercel-CDN-Cache-Control':'public, s-maxage=180','X-Content-Type-Options':'nosniff','X-Provider-Mode':mode,'X-Provider-Captured-At':at||new Date(now).toISOString()}});
 let storage=store;try{storage??=await bounded(storeFactory,1000);}catch{}
 let bs;try{bs=await bounded(async()=>{const r=await officialFetcher('https://fantasy.premierleague.com/api/bootstrap-static/',{signal:AbortSignal.timeout(7000)});if(!r.ok)throw new Error('Official unavailable');return r.json();},7000);}catch{}
 const season=bs?.events?.[0]?.deadline_time?.slice(0,4),gw=bs?.events?.find(e=>e.is_next)?.id;
 if(!season||!gw)return Response.json({error:'Official season/GW unavailable; identity cannot be validated.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const bundlePath=['/api/model/bundle','/api/model/manifest','/api/model/players'].includes(path),key='providers/v1/'+season+'/gw'+gw+'/'+(bundlePath?'model-bundle':path.slice(5).replaceAll('/','-'))+'.json';
 const select=data=>{if(!bundlePath)return data;const manifest={...data.manifest,models:(data.manifest.models||[]).filter(m=>m.id===data.manifest.default_model)};return path.endsWith('bundle')?{manifest,players:data.players}:path.endsWith('manifest')?manifest:data.players;};
 const call=req=>bounded(()=>upstream(new Request(req,{signal:AbortSignal.timeout(Math.min(timeoutMs,10000))})),Math.min(timeoutMs,10000));
 let saved;try{const r=await bounded(()=>storage?.read(key),2000);if(r?.data&&r.digest===hash(r.data)&&r.key===key&&Date.parse(r.captured_at)<=now&&(bundlePath?validBundle(r.data,bs,now):validOptional(path,r.data,bs,now)))saved=r;}catch{}
 if(saved&&now-Date.parse(saved.captured_at)<900000)return respond(select(saved.data),'mirror',saved.captured_at);
 let data;
 try{
  if(bundlePath){const [a,b]=await Promise.all(['manifest','players'].map(async name=>{const r=await call(new Request(new URL('/api/model/'+name,request.url)));if(!r.ok)throw new Error('Provider unavailable');return bounded(()=>r.json(),Math.min(timeoutMs,1000));}));data={manifest:a,players:Array.isArray(b)?Object.fromEntries(b.map(p=>[p.element,p])):b};if(!validBundle(data,bs,now))throw new Error('Bundle mismatch');}
  else{const r=await call(request);if(!r.ok)throw new Error('Provider unavailable');data=await bounded(()=>r.json(),1000);if(JSON.stringify(data).length>10000000)throw new Error('Payload too large');if(!validOptional(path,data,bs,now)){try{if(storage)await bounded(()=>storage.write('providers/archive/v1/'+season+'/'+path.slice(5).replaceAll('/','-')+'.json',{source_path:path,data,captured_at:new Date(now).toISOString(),digest:hash(data),unverified_gw:true}),2000);}catch{}throw new Error('Invalid or undated payload');}}
  const captured_at=new Date(now).toISOString();let mirrored=false;try{if(storage){await bounded(()=>storage.write(key,{key,data,captured_at,digest:hash(data)}),2000);mirrored=true;}}catch{}
  return respond(select(data),mirrored?'live-mirrored':'live-unmirrored',captured_at);
 }catch{
  if(saved)return respond(select(saved.data),'mirror-stale',saved.captured_at);
  if(bundlePath)return respond(select(officialBundle(bs,now)),'official-fallback');
  if(path==='/api/insights/snapshot'){const teams=new Map(bs.teams.map(t=>[t.id,t.short_name]));return respond({gw,generated:new Date(now).toISOString(),provider_mode:'official-fallback',projections:Object.fromEntries(bs.elements.filter(p=>number(p.ep_next)!==null).map(p=>[p.id,number(p.ep_next)])),players:bs.elements.map(p=>({id:p.id,name:p.web_name,team:teams.get(p.team),projected:number(p.ep_next),opta:{}})),scouts:{},fixtures:[]},'official-fallback');}
  if(path==='/api/model/news')return respond({articles:[]},'official-only');
  if(path==='/api/model/multi-gw')return respond([],'unavailable-optional');
  if(path==='/api/model/best-squad')return respond({squads:{}},'unavailable-optional');
  return Response.json({error:'Sumber opsional dan salinan mandiri belum tersedia. Data Official FPL tetap dapat digunakan.'},{status:503,headers:{'Cache-Control':'no-store','X-Provider-Mode':'unavailable-optional'}});
 }
}
