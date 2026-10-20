import {createHash} from 'node:crypto';
export const OWN_MODEL='fpl-iphoenk-python-v1';
const keys=['long_play','short_play','goals_conceded','saves','goals_scored','assists','clean_sheets','penalties_saved','penalties_missed','yellow_cards','red_cards','own_goals','bonus','defensive_contribution'];
const components=['appearance','goals','assists','clean_sheet','conceded','saves','bonus','defcon','penalties_saved','penalties_missed','cards','own_goals'];
export function canonicalOwn(value){if(Array.isArray(value))return '['+value.map(canonicalOwn).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalOwn(value[k])).join(',')+'}';return JSON.stringify(value);}
export const ownHash=value=>createHash('sha256').update(canonicalOwn(value)).digest('hex');
export function ownRecord(snapshot){return {snapshot:structuredClone(snapshot),sha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};}
export function readOwnRecord(record){try{return record?.snapshot&&record.sha256===createHash('sha256').update(JSON.stringify(record.snapshot)).digest('hex')?record.snapshot:null;}catch{return null;}}
export function ownModelPath(bs){const next=bs.events?.find(e=>e.is_next),season=String(new Date(bs.events?.[0]?.deadline_time).getUTCFullYear());if(!next||season!=='2026')throw Error('Unsupported model season');return 'own-model/v1/'+season+'/gw'+next.id+'/0.1.1/latest.json';}
export function validateOwnModel(doc,{bootstrap:bs,fixtures,now=Date.now()}){
 const bad=reason=>({ok:false,reason,players:{}}),time=v=>typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)?Date.parse(v):NaN;
 try{
  const next=bs.events.find(e=>e.is_next),season=String(new Date(bs.events[0].deadline_time).getUTCFullYear());
  if(!next||doc?.schema_version!==1||doc.model_id!==OWN_MODEL||doc.model_version!=='0.1.1'||doc.experimental!==true||doc.validation_status!=='ready'||doc.season!==season||season!=='2026'||doc.target_gw!==next.id||time(doc.deadline_utc)!==time(next.deadline_time)||doc.scoring_version!=='official-2026-27-v1')return bad('identity-or-version');
  const asof=time(doc.inputs_as_of_utc),end=time(doc.acquisition_finished_at_utc),generated=time(doc.generated_at_utc),expires=time(doc.expires_at_utc),deadline=time(next.deadline_time);
  if(![asof,end,generated,expires,deadline].every(Number.isFinite)||!(asof<=end&&end<=generated&&generated<=now&&end-asof<=1800000&&now<expires&&expires<=asof+21600000&&expires<=deadline))return bad('expired-or-invalid-time');
  if(!Array.isArray(doc.source_manifest)||!doc.source_manifest.length||doc.source_manifest.some(s=>!(/^[a-f0-9]{64}$/.test(s.sha256))||!(asof<=time(s.fetched_at)&&time(s.fetched_at)<=end)))return bad('provenance');
  const scoring=bs.game_config?.scoring;
  if(!scoring||keys.some(k=>scoring[k]===undefined)||Object.entries(scoring).some(([k,v])=>!keys.includes(k)&&k!=='special_multiplier'&&(typeof v==='object'?Object.values(v).some(n=>n!==0):v!==0))||(scoring.special_multiplier??1)!==1||ownHash(Object.fromEntries(keys.map(k=>[k,scoring[k]])))!==doc.scoring_hash)return bad('scoring-changed');
  const target=fixtures.filter(f=>f.event===next.id),ids=new Set(target.map(f=>f.id));
  if(ids.size!==target.length||target.some(f=>f.finished||!f.kickoff_time)||ownHash(target.map(f=>Object.fromEntries(['id','event','team_h','team_a','kickoff_time'].map(k=>[k,f[k]??null]))).sort((a,b)=>a.id-b.id))!==doc.fixture_hash)return bad('fixtures-changed');
  const raw=doc.players,teams=new Map(bs.teams.map(t=>[t.id,t.short_name]));if(!raw||Object.keys(raw).length!==bs.elements.length)return bad('coverage');
  const players={};
  for(const p of bs.elements){
   const r=raw[p.id],scheduled=target.filter(f=>f.team_h===p.team||f.team_a===p.team).map(f=>f.id).sort((a,b)=>a-b);
   if(!r||r.current_element_id!==p.id||r.permanent_code!==p.code||r.name!==p.web_name||r.team_id!==p.team||r.team!==teams.get(p.team)||r.position!==p.element_type||JSON.stringify(r.fixture_ids)!==JSON.stringify(scheduled))return bad('player-identity');
   if(!['ready','unavailable'].includes(r.status)||!Number.isInteger(r.evidence_count)||r.evidence_count<0)return bad('player-schema');
   if(r.status==='ready'){
    const values=Object.values(r.components||{});
    if(scheduled.length&&(Object.keys(r.components||{}).length!==components.length||components.some(k=>!Object.hasOwn(r.components,k))))return bad('incomplete-components');
    if(typeof r.xp!=='number'||!Number.isFinite(r.xp)||Math.abs(r.xp)>200||values.some(v=>typeof v!=='number'||!Number.isFinite(v))||Math.abs(values.reduce((s,v)=>s+v,0)-r.xp)>0.0001||(!scheduled.length&&(r.reason!=='confirmed-blank'||r.xp!==0))||(scheduled.length&&!values.length))return bad('invalid-components');
   }else if(r.xp!==null)return bad('missing-not-zero');
   const changed=r.availability?.status!==p.status||(r.availability?.chance??null)!==(p.chance_of_playing_next_round??null);
   players[p.id]=changed?{...r,status:'unavailable',xp:null,components:{},reason:'availability-changed'}:r;
  }
  return {ok:true,reason:null,players};
 }catch{return bad('invalid-document');}
}
export function ownForecast(doc,bs,now){const next=bs.events.find(e=>e.is_next);if(!next||now>=Date.parse(next.deadline_time))throw Error('Deadline closed');return {schema:1,season:doc.season,gw:doc.target_gw,deadline:doc.deadline_utc,captured_at:new Date(now).toISOString(),universe:Object.keys(doc.players).length,source:OWN_MODEL,model:doc.model_version,source_published_at:doc.generated_at_utc,input_hash:doc.input_hash,players:Object.values(doc.players).filter(p=>p.status==='ready').map(p=>({id:p.current_element_id,name:p.name,team:p.team_id,position:p.position,predicted:p.xp}))};}
