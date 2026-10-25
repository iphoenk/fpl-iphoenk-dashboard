/* V12-inspired deterministic package/lineup evaluation using an independent
   public global model. This is NOT Canonical V12 and NEVER runs Monte Carlo. */
import {selectPublicXI,optimizePublicLineup,canonicalSquadCheck,CANONICAL_RULES_PROVENANCE} from './multiuser-decision.mjs';
const n=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const rnd=x=>Math.round(x*100)/100;
const liteRisk=(scenario,verified)=>{
 const explicit=Array.isArray(scenario?.starter_risk)?scenario.starter_risk:[];
 const rows=explicit.length?explicit:(scenario?.starting_xi||[]).map(id=>({id,pstart:verified?.map?.get(id)?.pstart??null}));
 const known=rows.map(row=>Number(row?.pstart)).filter(Number.isFinite);
 return {
  starter_risk:rows,
  known_player_count:known.length,
  average_p_start:known.length?rnd(known.reduce((a,b)=>a+b,0)/known.length):null,
  risk_status:known.length?'INDICATIVE':'UNAVAILABLE',
  risk_note:'Vercel V12 Lite exposes available starter evidence; it does not invent calibrated probabilities.'
 };
};
const legal=s=>canonicalSquadCheck(s)[0];
export function validateGlobalModel(snapshot,bootstrap,gw,now=Date.now()){
 const meta=snapshot?.meta,rows=snapshot?.players;
 const ts=Date.parse(meta?.built_at||'');
 if(!meta||!Array.isArray(rows)||rows.length<300||rows.length>1000||
    meta.authority!=='model'||meta.next_gw!==gw||meta.horizon<5||
    !Number.isFinite(ts)||ts>now+60000||now-ts>21600000||
    !meta.sources?.some(s=>s.source==='FPL official API'&&s.status==='ok'))return null;
 const official=new Map((bootstrap?.elements||[]).map(p=>[p.id,p])),map=new Map();
 for(const p of rows){
  const o=official.get(p.id);
  if(!o||o.team!==p.t||o.element_type!==p.p||
     !Array.isArray(p.xpm)||p.xpm.length<5||
     p.xpm.slice(0,5).some(x=>n(x)===null||Number(x)<0||Number(x)>40))continue;
  map.set(p.id,{...o,xpm:p.xpm.slice(0,5).map(Number),pstart:n(p.nx?.pstart),pplay:n(p.nx?.pplay)});
 }
 if(map.size<300)return null;
 return {map,built_at:new Date(ts).toISOString(),coverage:map.size,
   source_health:meta.sources.map(s=>({source:s.source,status:s.status})),
   challenger:meta.fplens?{model:meta.fplens.model,gw:meta.fplens.gw}:null,
   retro_backtest:Array.isArray(meta.backtest)?meta.backtest.slice(-3):[]};
}
function plan(squad,horizon,explain=false){
 if(!legal(squad))return null;
 let total=0;const weeks=[];
 for(let i=0;i<horizon;i++){
  const valued=squad.map(p=>({...p,ep_next:n(p.xpm?.[i])}));
  if(valued.some(p=>p.ep_next===null))return null;
  const xi=explain?optimizePublicLineup(valued):selectPublicXI(valued,{scoreOnly:true});
  if(!xi)return null;
  total+=xi.expected_points;
  weeks.push({offset:i,...xi});
 }
 return {expected_points:rnd(total),formation:weeks[0].formation,
  starting_xi:weeks[0].starting_xi,bench:weeks[0].bench,captain:weeks[0].captain,
  vice_captain:weeks[0].vice_captain,weeks};
}
export function multiGwDecision({entry,picks,bootstrap,planningGw,snapshot,horizon=3,now=Date.now()}){
 if(![1,3,5].includes(horizon))return null;
 const verified=validateGlobalModel(snapshot,bootstrap,planningGw,now);
 if(!verified)return null;
 const official=new Map(bootstrap.elements.map(p=>[p.id,p]));
 const owned=(picks?.picks||[]).map(p=>verified.map.get(p.element));
 if(owned.length!==15||owned.some(p=>!p)||!legal(owned))return null;
 const hold=plan(owned,horizon);
 if(!hold)return null;
 const bank=n(picks.entry_history?.bank);
 const publishedSales=new Map(picks.picks.map(p=>[p.element,n(p.selling_price)]));
 const validPublishedSale=p=>Number.isInteger(publishedSales.get(p.id))&&publishedSales.get(p.id)>0;
 const proxyCount=owned.filter(p=>!validPublishedSale(p)).length;
 // A public historical bank may be present, but account-specific current
 // selling prices usually are not. Official now_cost is a price proxy ONLY,
 // never an assertion of actual sell value or executability.
 const sales=new Map(owned.map(p=>[p.id,validPublishedSale(p)?publishedSales.get(p.id):p.now_cost]));
 const known=Number.isInteger(bank)&&bank>=0&&owned.every(p=>Number.isInteger(sales.get(p.id))&&sales.get(p.id)>0);
 const pretty=id=>official.get(id)?.web_name||'Unknown';
 const describe=(moves)=>moves.map(m=>({out:{id:m.out,web_name:pretty(m.out)},in:{id:m.in,web_name:pretty(m.in)}}));
 const scenario=(kind,value,moves=[],cash=null)=>({
  kind,transfers:moves.length,changes:describe(moves),...value,
  ...plan(owned.map(p=>{const move=moves.find(m=>m.out===p.id);return move?verified.map.get(move.in):p;}),horizon,true),
  gross_gain_vs_hold:rnd(value.expected_points-hold.expected_points),
  bank_after_indicative:cash===null?null:rnd(cash/10),
  hit_points:null,net_gain:null,executable:false,decision_status:'PUBLIC_NONCANONICAL',
  starter_risk:moves.map(m=>({id:m.in,pstart:verified.map.get(m.in)?.pstart??null}))
 });
 const res={status:known?'ready':'partial',contract:'PUBLIC_FPL_MULTIGW_ADVISORY_V2',
  model:'independent-eight-gw-challenger',authority:'OFFICIAL_FACTS_PUBLIC_PROJECTION',
  canonical_v12:false,canonical_components:CANONICAL_RULES_PROVENANCE,v12_methodology:'DETERMINISTIC_PACKAGE_SEARCH_AND_LINEUP_NONCANONICAL',
  monte_carlo:false,planning_gw:planningGw,entry_id:Number(entry.id),horizon,
  source_squad_gw:Number(picks.entry_history?.event)||null,
  economics_status:known?(proxyCount?'PUBLIC_CURRENT_PRICE_PROXY_INDICATIVE':'PUBLIC_HISTORICAL_INDICATIVE'):'UNAVAILABLE',
  economics_evidence:{bank_basis:'LAST_PUBLISHED_GW_BANK',sale_basis:proxyCount?'CURRENT_OFFICIAL_MARKET_PRICE_PROXY':'PUBLISHED_PICK_SELLING_PRICE',proxy_player_count:proxyCount,actual_affordability_verified:false},
  search_scope:'BOUNDED_MULTIGW_NONCANONICAL',
  evidence:{model_built_at:verified.built_at,verified_players:verified.coverage,
   source_health:verified.source_health,challenger:verified.challenger,retro_backtest:verified.retro_backtest,
   canonical_v12_projections_used:false},
  assumptions:['Official FPL identity, squad, prices and fixtures are authoritative',
   'Multi-GW projections come from the public independent model (not Official ep_next or Canonical V12)',
   'Published squad and historical bank are indicative; current market prices proxy missing personal selling prices',
   'Free transfers are supplied from Official FPL history when available; hit cost and net gain remain unknown',
   'No Monte Carlo; pair search bounded and not globally optimal'],
  scenarios:{A:scenario('HOLD',hold),B:null,C:null}};
 res.vercel_v12_lite={
  contract:'FPL_V12_VERCEL_DECISION_V1',
  status:'READY_LITE',
  scope:['LEGAL_FORMATIONS','STARTING_XI','BENCH','CAPTAIN_VICE_CAPTAIN','HORIZON_1_3_5','TRANSFER_A_B_C','RISK','PROVENANCE'],
  canonical_v12:false,
  implementation:'VERCEL_NATIVE_V12_LITE',
  monte_carlo:false,
  authoritative_facts:'OFFICIAL_FPL',
  methodology:'DETERMINISTIC_PUBLIC_PACKAGE_SEARCH',
  provenance:{
   model_built_at:verified.built_at,
   verified_players:verified.coverage,
   source_health:verified.source_health,
   challenger:verified.challenger,
   canonical_v12_projections_used:false
  }
 };
 res.risk=liteRisk(res.scenarios.A,verified);
 res.provenance=res.vercel_v12_lite.provenance;
 res.scenarios.A.risk=liteRisk(res.scenarios.A,verified);
 if(!known){res.reason='HISTORICAL_BANK_OR_SELLING_PRICE_MISSING';return res;}
 const ids=new Set(owned.map(p=>p.id));
 const universe=[...verified.map.values()].filter(p=>!ids.has(p.id)&&['a','d'].includes(p.status)&&Number.isInteger(p.now_cost)&&p.now_cost>0);
 const candidates=new Set();
 for(const pos of [1,2,3,4]){
  const group=universe.filter(p=>p.element_type===pos);
  const sum=p=>p.xpm.slice(0,horizon).reduce((a,b)=>a+b,0);
  [...group].sort((a,b)=>sum(b)-sum(a)||a.id-b.id).slice(0,9)
   .concat([...group].sort((a,b)=>a.now_cost-b.now_cost||a.id-b.id).slice(0,4))
   .forEach(p=>candidates.add(p.id));
 }
 const singles=[];
 for(const old of owned)for(const incoming of universe){
  if(!candidates.has(incoming.id)||incoming.element_type!==old.element_type||
     incoming.now_cost>bank+sales.get(old.id))continue;
  const roster=owned.map(p=>p.id===old.id?incoming:p);
  if(!legal(roster))continue;
  const value=plan(roster,horizon);
  if(value)singles.push({out:old.id,in:incoming.id,
    cash:bank+sales.get(old.id)-incoming.now_cost,value,
    gain:rnd(value.expected_points-hold.expected_points)});
 }
 singles.sort((a,b)=>b.gain-a.gain||a.out-b.out||a.in-b.in);
 const bestSingle=singles[0];
 if(bestSingle)res.scenarios.B=scenario('ONE_TRANSFER',bestSingle.value,[{out:bestSingle.out,in:bestSingle.in}],bestSingle.cash);
 let bestPair=null,pairCount=0;
 // Spread shortlisted singles across different outgoing players. Otherwise
 // the highest scoring one-for-one options can all sell the same player,
 // leaving no non-overlapping pair to evaluate.
 const shortlist=[];const perOutgoing=new Map();
 for(const candidate of singles){
  const count=perOutgoing.get(candidate.out)||0;
  if(count>=3)continue;
  shortlist.push(candidate);perOutgoing.set(candidate.out,count+1);
  if(shortlist.length>=45)break;
 }
 for(let i=0;i<shortlist.length;i++)for(let j=i+1;j<shortlist.length;j++){
  const a=shortlist[i],b=shortlist[j];
  if(a.out===b.out||a.in===b.in)continue;
  const inA=verified.map.get(a.in),inB=verified.map.get(b.in);
  const cash=bank+sales.get(a.out)+sales.get(b.out)-inA.now_cost-inB.now_cost;
  if(cash<0)continue;
  const roster=owned.map(p=>p.id===a.out?inA:p.id===b.out?inB:p);
  if(!legal(roster))continue;
  pairCount++;
  const value=plan(roster,horizon);
  if(!value)continue;
  const gain=rnd(value.expected_points-hold.expected_points);
  if(!bestPair||gain>bestPair.gain)bestPair={a,b,cash,value,gain};
 }
 if(bestPair)res.scenarios.C=scenario('TWO_TRANSFERS',bestPair.value,
  [{out:bestPair.a.out,in:bestPair.a.in},{out:bestPair.b.out,in:bestPair.b.in}],bestPair.cash);
 for(const key of ['A','B','C'])if(res.scenarios[key])res.scenarios[key].risk=liteRisk(res.scenarios[key],verified);
 res.search_evidence={legal_single_routes:singles.length,legal_pair_routes:pairCount,candidate_pool:candidates.size};
 return res;
}
