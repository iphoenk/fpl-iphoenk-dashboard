// Network acceptance for one pinned Vercel preview deployment.
// GET-only. Never log private credentials or use authenticated FPL endpoints.
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';

const root=process.env.FPL_PREVIEW_URL?.replace(/\/+$/,'');
const leagueId=Number(process.env.FPL_ACCEPTANCE_LEAGUE||9477);
const ownerId=Number(process.env.FPL_ACCEPTANCE_ENTRY||3462711);
const timeout=Number(process.env.FPL_ACCEPTANCE_TIMEOUT_MS||20000);
const sla=Number(process.env.FPL_ACCEPTANCE_P95_MS||1000);
const report={created_at:new Date().toISOString(),preview_url:root,league_id:leagueId,
  owner_entry_id:ownerId,protocol:'HTTP_GET_PUBLIC_ONLY',sla_p95_ms:sla,
  phases:[],horizons:[],errors:[],status:'INCOMPLETE'};
if(!root||!/^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(root)){
 console.error('FPL_PREVIEW_URL must be the exact HTTPS Vercel preview hostname');
 process.exit(2);
}
const http=async url=>{
 const start=performance.now();
 try{
  const response=await fetch(url,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(timeout)});
  const elapsed_ms=Math.round((performance.now()-start)*10)/10;
  const raw=await response.text();
  let data=null;try{data=JSON.parse(raw);}catch{}
  return {ok:response.ok,http:response.status,elapsed_ms,data,bytes:raw.length,
   edge_cache:response.headers.get('x-vercel-cache')||'NOT_REPORTED',
   server_timing:response.headers.get('server-timing')||null,
   content_type:response.headers.get('content-type')||null};
 }catch(error){return {ok:false,http:0,elapsed_ms:Math.round((performance.now()-start)*10)/10,
  error:String(error?.message||error)};}
};
const quantile=(values,q)=>{
 const v=[...values].sort((a,b)=>a-b);return v.length?v[Math.max(0,Math.ceil(q*v.length)-1)]:null;
};
const legal=new Set(['3-4-3','3-5-2','4-3-3','4-4-2','4-5-1','5-2-3','5-3-2','5-4-1']);
function validate(data,id,horizon){
 const errors=[];
 if(!data||typeof data!=='object')return ['Not valid JSON object'];
 if(data.entry_id!==id)errors.push('entry_id mismatch');
 if(!['ready','partial'].includes(data.status))errors.push('advisory status '+data.status);
 if(data.canonical_v12!==false||data.monte_carlo!==false)errors.push('mislabelled model');
 if(data.requested_horizon!==horizon)errors.push('requested horizon mismatch');
 if(![1,3,5].includes(data.effective_horizon))errors.push('effective horizon invalid');
 if(data.effective_horizon>horizon)errors.push('effective horizon overstates request');
 if(horizon>1&&data.effective_horizon===1&&data.source?.model_mode!=='OFFICIAL_ONE_GW_FALLBACK')errors.push('fallback not disclosed');
 const scenarios=data.scenarios||{};
 if(!scenarios.A)errors.push('missing HOLD');
 for(const [key,s] of Object.entries(scenarios)){
  if(!s)continue;
  if(s.executable!==false||s.net_gain!==null||s.hit_points!==null)errors.push(key+' unknown costs misrepresented');
  const weeks=s.weeks?.length?s.weeks:[{...s,offset:0}];
  if(weeks.length!==data.effective_horizon)errors.push(key+' weeks length');
  for(const week of weeks){
   const cmp=week.formation_comparison;
   if(!Array.isArray(cmp)||cmp.length!==8){errors.push(key+' 8-formation evidence missing');continue;}
   if(new Set(cmp.map(x=>x.formation)).size!==8||cmp.some(x=>!legal.has(x.formation)))errors.push(key+' invalid formation set');
   if(week.optimizer?.legal_xi_count!==550||week.optimizer?.method!=='EXACT_PUBLIC_MEAN_XP')errors.push(key+' legality/method evidence');
   const max=Math.max(...cmp.map(x=>x.expected_points));
   if(!Number.isFinite(max)||Math.abs(max-week.expected_points)>0.011)errors.push(key+' winning total');
   const selected=cmp.filter(x=>x.selected);
   if(selected.length!==1||selected[0].formation!==week.formation)errors.push(key+' winner flag');
   for(const x of cmp){
    if(!Array.isArray(x.starting_xi)||x.starting_xi.length!==11||
       !Array.isArray(x.bench)||x.bench.length!==4||
       new Set([...x.starting_xi,...x.bench]).size!==15)errors.push(key+' incomplete XI/bench');
    if(!x.starting_xi?.includes(x.captain)||!x.starting_xi?.includes(x.vice_captain)||x.captain===x.vice_captain)errors.push(key+' C/VC');
    if(!Number.isFinite(x.expected_points)||Math.abs((x.expected_points-max)-x.delta_vs_best)>0.011)errors.push(key+' xP delta');
   }
  }
 }
 return [...new Set(errors)];
}
async function leagueMembers(){
 const ids=new Set();
 for(let page=1;page<=4&&ids.size<36;page++){
  const url='https://fantasy.premierleague.com/api/leagues-classic/'+leagueId+'/standings/?page_standings='+page;
  const r=await http(url);
  if(!r.ok||!Array.isArray(r.data?.standings?.results))throw Error('Official league fetch failed page '+page+': HTTP '+r.http+' '+(r.error||''));
  for(const row of r.data.standings.results){
   if(Number.isSafeInteger(row.entry)&&row.entry>0)ids.add(row.entry);
  }
  if(r.data.standings.has_next===false)break;
 }
 if(ids.size<36)throw Error('Official league returned only '+ids.size+' unique public IDs; need 36');
 return [...ids].slice(0,36);
}
async function phase(kind,count,ids,horizon=1){
 const seen=performance.now();
 const results=await Promise.all(ids.map(async id=>{
  const r=await http(root+'/api/decision?entry_id='+id+'&horizon='+horizon);
  const violations=r.ok?validate(r.data,id,horizon):[r.error||'HTTP '+r.http];
  return {entry_id:id,http:r.http,elapsed_ms:r.elapsed_ms,edge_cache:r.edge_cache,
   server_timing:r.server_timing,bytes:r.bytes||0,violations};
 }));
 const durations=results.map(x=>x.elapsed_ms);
 const errors=results.flatMap(x=>x.violations.map(v=>({entry_id:x.entry_id,error:v})));
 const entry={kind,concurrent_users:count,requested_horizon:horizon,request_count:results.length,
   wall_ms:Math.round(performance.now()-seen),p50_ms:quantile(durations,.50),
   p95_ms:quantile(durations,.95),max_ms:Math.max(...durations),
   errors:errors.length,edge_cache:results.reduce((m,r)=>(m[r.edge_cache]=(m[r.edge_cache]||0)+1,m),{}),
   results};
 if(errors.length)report.errors.push(...errors.map(e=>({...e,kind})));
 report.phases.push(entry);
 console.log(kind.padEnd(6),String(count).padStart(2),'users:',results.length-errors.length,'/',results.length,
   'valid, p50',entry.p50_ms,'ms, p95',entry.p95_ms,'ms, edge',JSON.stringify(entry.edge_cache));
 return entry;
}
try{
 const health=await http(root+'/api/decision/health');
 report.health={http:health.http,elapsed_ms:health.elapsed_ms,
   available:health.data?.status==='READY',scope:health.data?.concurrency?.scope||null};
 if(!report.health.available)throw Error('Preview health is not READY: HTTP '+health.http+' '+(health.error||''));
 const ids=await leagueMembers();
 report.entry_ids=ids;
 let cursor=0;
 for(const count of [1,5,10,20]){
  const slice=ids.slice(cursor,cursor+count);cursor+=count;
  await phase('cold',count,slice);
  await phase('warm',count,slice);
 }
 for(const horizon of [1,3,5]){
  const r=await http(root+'/api/decision?entry_id='+ownerId+'&horizon='+horizon);
  const problems=r.ok?validate(r.data,ownerId,horizon):[r.error||'HTTP '+r.http];
  const x={horizon,http:r.http,elapsed_ms:r.elapsed_ms,effective_horizon:r.data?.effective_horizon??null,
   contract:r.data?.contract||null,source_mode:r.data?.source?.model_mode||null,errors:problems};
  report.horizons.push(x);
  if(problems.length)report.errors.push(...problems.map(error=>({kind:'horizon',horizon,error})));
 }
 const p95cold=Math.max(...report.phases.filter(p=>p.kind==='cold').map(p=>p.p95_ms));
 const p95warm=Math.max(...report.phases.filter(p=>p.kind==='warm').map(p=>p.p95_ms));
 report.latency={max_phase_cold_p95_ms:p95cold,max_phase_warm_p95_ms:p95warm,
  cold_sla_met:p95cold<=sla,warm_sla_met:p95warm<=sla};
 report.status=report.errors.length?'FAIL_CONTRACT':p95cold>sla||p95warm>sla?'FAIL_LATENCY_SLA':'PASS';
}catch(error){report.errors.push({kind:'harness',error:String(error?.message||error)});report.status='INCOMPLETE';}
finally{
 mkdirSync('artifacts',{recursive:true});
 writeFileSync('artifacts/live-preview-acceptance.json',JSON.stringify(report,null,2)+'\n');
 console.log('ACCEPTANCE_RESULT',JSON.stringify({status:report.status,phase_count:report.phases.length,
  errors:report.errors.slice(0,5),latency:report.latency||null}));
 if(report.status!=='PASS')process.exitCode=1;
}
