const CANONICAL_CONTRACT='FPL_V12_CANONICAL_DECISION_V1';
const CANONICAL_ENGINE='canonical-v12';
const allowedHorizons=new Set([1,3,5]);

function text(v){return typeof v==='string'&&v.trim()?v.trim():null;}
function canonicalInteger(v){return Number.isSafeInteger(v)?v:null;}

export function validateCanonicalDecision(payload,{entryId,horizon}={}){
  if(!payload||typeof payload!=='object')return {ok:false,reason:'EMPTY_CANONICAL_PAYLOAD'};
  if(payload.contract!==CANONICAL_CONTRACT)return {ok:false,reason:'CANONICAL_CONTRACT_MISMATCH'};
  const payloadEntry=canonicalInteger(Number(payload.entry_id));
  const payloadHorizon=canonicalInteger(Number(payload.horizon));
  if(payloadEntry===null||payloadEntry!==Number(entryId))return {ok:false,reason:'CANONICAL_ENTRY_MISMATCH'};
  if(!allowedHorizons.has(payloadHorizon)||payloadHorizon!==Number(horizon))return {ok:false,reason:'CANONICAL_HORIZON_MISMATCH'};
  if(!['ready','partial','degraded'].includes(String(payload.status)))return {ok:false,reason:'CANONICAL_STATUS_INVALID'};
  if(!payload.decision||typeof payload.decision!=='object')return {ok:false,reason:'CANONICAL_DECISION_MISSING'};
  if(!Array.isArray(payload.owned_15)||payload.owned_15.length!==15)return {ok:false,reason:'CANONICAL_OWNED15_INVALID'};
  const provenance=payload.provenance;
  if(!provenance||typeof provenance!=='object'||!text(provenance.input_fingerprint)||!text(provenance.canonical_v12_revision))
    return {ok:false,reason:'CANONICAL_PROVENANCE_MISSING'};
  return {ok:true};
}

export function canonicalEndpointUrl(baseUrl,entryId,horizon){
  if(!text(baseUrl))return null;
  const url=new URL(baseUrl);
  url.searchParams.set('entry_id',String(entryId));
  url.searchParams.set('horizon',String(horizon));
  return url.toString();
}

export async function fetchCanonicalDecision({fetcher=fetch,baseUrl,entryId,horizon,timeoutMs=9000}={}){
  const url=canonicalEndpointUrl(baseUrl,entryId,horizon);
  if(!url)return {status:'NOT_CONFIGURED',data:null};
  try{
    const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
    if(response.status===404||response.status===501)return {status:'UNAVAILABLE',data:null};
    if(!response.ok)return {status:'ERROR',data:null,reason:'CANONICAL_UPSTREAM_'+response.status};
    const payload=await response.json();
    const checked=validateCanonicalDecision(payload,{entryId,horizon});
    return checked.ok?{status:'READY',data:payload}:{status:'INVALID',data:null,reason:checked.reason};
  }catch(error){
    return {status:'ERROR',data:null,reason:error?.message||'CANONICAL_FETCH_FAILED'};
  }
}

export function toDashboardDecision(payload){
  const p=payload;
  return {
    ...p.decision,
    status:p.status,
    contract:CANONICAL_CONTRACT,
    model:CANONICAL_ENGINE,
    canonical_v12:true,
    monte_carlo:Boolean(p.decision.monte_carlo),
    entry_id:Number(p.entry_id),
    planning_gw:Number(p.planning_gw||p.horizon_context?.planning_gw),
    horizon:Number(p.horizon),
    provenance:p.provenance,
    source:{...(p.source||{}),provider:'Canonical V12 Decision Service',authority:'CANONICAL_V12'},
    warnings:Array.isArray(p.warnings)?p.warnings:[],
  };
}
