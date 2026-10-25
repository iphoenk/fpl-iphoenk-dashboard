import {createHash} from 'node:crypto';
export const MC_SHADOW_PATH='mc-shadow/v1/latest.json';
export const MC_ENGINE_REVISION='da9633b31ce3304890aeacc179d401c15946c6b0';
const mcExact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join(' ')==keys.split(' ').sort().join(' ');
const mcInt=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const mcNumber=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const mcTimestamp=v=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(v))return NaN;
 const time=Date.parse(v);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,19)===v.slice(0,19)?time:NaN;
};
const mcHash=v=>createHash('sha256').update(v,'utf8').digest('hex');
const mcSeed=v=>mcInt(v,0,Number.MAX_SAFE_INTEGER)||(typeof v==='string'&&/^(0|[1-9]\d{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n);
export function validateMcShadowRecord(record,{bootstrap,now=Date.now()}={}){
 const invalid={ok:false,reason:'INVALID_MC_SNAPSHOT'};
 try{
  if(!mcExact(record,'contract payload_json sha256')||record.contract!=='FPL_MC_BLOB_RECORD_V1'||
   typeof record.payload_json!=='string'||Buffer.byteLength(record.payload_json)>1000000||
   record.sha256!==mcHash(record.payload_json))return invalid;
  const s=JSON.parse(record.payload_json);
  if(!mcExact(s,'contract status canonical_v12 semantics engine_revision input_sha256 export_sha256 sha256 season start_gw horizon acquired_at generated_at expires_at next_deadline actual_samples seed rng quantile_method model_owner minutes_owner players')||
   s.contract!=='FPL_MC_PLAYER_SNAPSHOT_V1'||s.status!=='SHADOW_ONLY'||s.canonical_v12!==false||
   s.semantics!=='PLAYER_MARGINAL_SUMMARIES_ONLY'||s.model_owner!=='V12_MONTE_CARLO'||
   s.minutes_owner!=='V12_PLAYER_MINUTES'||s.engine_revision!==MC_ENGINE_REVISION||s.rng!=='PCG64'||
   s.quantile_method!=='EMPIRICAL_NEAREST_RANK'||!mcInt(s.actual_samples,500000,5000000)||
   !mcSeed(s.seed)||
   !['input_sha256','export_sha256','sha256'].every(k=>typeof s[k]==='string'&&/^[a-f0-9]{64}$/.test(s[k])))return invalid;
  const next=bootstrap?.events?.find(e=>e.is_next)||bootstrap?.events?.find(e=>!e.finished);
  const year=new Date(bootstrap?.events?.[0]?.deadline_time).getUTCFullYear();
  const deadline=Date.parse(next?.deadline_time),acquired=mcTimestamp(s.acquired_at),generated=mcTimestamp(s.generated_at),expiry=mcTimestamp(s.expires_at);
  if(!Number.isFinite(year)||s.season!==year+'-'+String(year+1).slice(-2)||s.start_gw!==next?.id||
   ![1,3,5].includes(s.horizon)||s.start_gw+s.horizon-1>38||
   mcTimestamp(s.next_deadline)!==deadline||![acquired,generated,expiry,deadline,now].every(Number.isFinite)||
   !(acquired<=generated&&generated<=now&&now<expiry&&expiry<=Math.min(acquired+21600000,generated+21600000,deadline)))return invalid;
  const all=bootstrap?.elements;
  if(!Array.isArray(all))return invalid;
  // Owner decision 2026-10-25: status u (no longer in the Premier League) is outside the MC universe.
  const players=all.filter(p=>p?.status!=='u'),excluded=all.length-players.length;
  if(players.length===0)return invalid;
  const official=new Map(players.map(p=>[p.id,p]));
  if(official.size!==players.length||!Array.isArray(s.players)||s.players.length!==official.size*s.horizon)return invalid;
  const seen=new Set();
  for(const row of s.players){
   if(!mcExact(row,'id team position gw mean variance p10 p50 p90'))return invalid;
   const p=official.get(row.id),key=row.id+':'+row.gw;
   if(!p||row.team!==p.team||row.position!==p.element_type||seen.has(key)||
    !mcInt(row.gw,s.start_gw,s.start_gw+s.horizon-1)||!mcNumber(row.mean,-20,100)||
    !mcNumber(row.variance,0,3600)||!['p10','p50','p90'].every(k=>mcInt(row[k],-20,100))||
    row.p10>row.p50||row.p50>row.p90)return invalid;
   seen.add(key);
  }
  return {ok:true,metadata:{status:'SHADOW_ONLY',validation_status:'PASS',applied_to_decisions:false,
   canonical_v12:false,scope:'PLAYER_MARGINAL_SUMMARIES_ONLY',planning_gw:s.start_gw,horizon:s.horizon,
   generated_at:new Date(generated).toISOString(),expires_at:new Date(expiry).toISOString(),coverage:official.size,excluded_inactive:excluded,actual_samples:s.actual_samples}};
 }catch{return invalid;}
}
