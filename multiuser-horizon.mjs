/* V12-inspired deterministic package/lineup evaluation using an independent
   public global model. This is NOT Canonical V12 and NEVER runs Monte Carlo. */
import {selectPublicXI} from './multiuser-decision.mjs';
const n=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const rnd=x=>Math.round(x*100)/100;
const legal=s=>s.length===15&&new Set(s.map(p=>p.id)).size===15&&
 [[1,2],[2,5],[3,5],[4,3]].every(([pos,num])=>s.filter(p=>p.element_type===pos).length===num)&&
 Object.values(s.reduce((a,p)=>(a[p.team]=(a[p.team]||0)+1,a),{})).every(x=>x<=3);
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
function plan(squad,horizon){
 if(!legal(squad))return null;
 let total=0;const weeks=[];
 for(let i=0;i<horizon;i++){
  const valued=squad.map(p=>({...p,ep_next:n(p.xpm?.[i])}));
  if(valued.some(p=>p.ep_next===null))return null;
  const xi=selectPublicXI(valued);
  if(!xi)return null;
  total+=xi.expected_points;
  weeks.push({offset:i,starting_xi:xi.starting_xi,bench:xi.bench,captain:xi.captain,vice_captain:xi.vice_captain,expected_points:xi.expected_points});
  if(i===0)weeks[0].formation=xi.formation;
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
 const sales=new Map(picks.picks.map(p=>[p.element,n(p.selling_price)]));
 const known=Number.isInteger(bank)&&bank>=0&&owned.every(p=>Number.isInteger(sales.get(p.id))&&sales.get(p.id)>0);
 const pretty=id=>official.get(id)?.web_name||'Unknown';
 const describe=(moves)=>moves.map(m=>({out:{id:m.out,web_name:pretty(m.out)},in:{id:m.in,web_name:pretty(m.in)}}));
 const scenario=(kind,value,moves=[],cash=null)=>({
  kind,transfers:moves.length,changes:describe(moves),...value,
  gross_gain_vs_hold:rnd(value.expected_points-hold.expected_points),
  bank_after_indicative:cash===null?null:rnd(cash/10),
  hit_points:null,net_gain:null,executable:false,decision_status:'PUBLIC_NONCANONICAL',
  starter_risk:moves.map(m=>({id:m.in,pstart:verified.map.get(m.in)?.pstart??null}))
 });
 const res={status:known?'ready':'partial',contract:'PUBLIC_FPL_MULTIGW_ADVISORY_V2',
  model:'independent-eight-gw-challenger',authority:'OFFICIAL_FACTS_PUBLIC_PROJECTION',
  canonical_v12:false,v12_methodology:'DETERMINISTIC_PACKAGE_SEARCH_AND_LINEUP_NONCANONICAL',
  monte_carlo:false,planning_gw:planningGw,entry_id:Number(entry.id),horizon,
  source_squad_gw:Number(picks.entry_history?.event)||null,
  economics_status:known?'PUBLIC_HISTORICAL_INDICATIVE':'UNAVAILABLE',
  search_scope:'BOUNDED_MULTIGW_NONCANONICAL',
  evidence:{model_built_at:verified.built_at,verified_players:verified.coverage,
   source_health:verified.source_health,challenger:verified.challenger,retro_backtest:verified.retro_backtest,
   canonical_v12_projections_used:false},
  assumptions:['Official FPL identity, squad, prices and fixtures are authoritative',
   'Multi-GW projections come from the public independent model (not Official ep_next or Canonical V12)',
   'Published squad and historical economics are indicative, not owner-authenticated',
   'Free transfers and hits unknown; gross gain never means net gain',
   'No Monte Carlo; pair search bounded and not globally optimal'],
  scenarios:{A:scenario('HOLD',hold),B:null,C:null}};
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
 const bestSingle=singles.find(s=>s.gain>0);
 if(bestSingle)res.scenarios.B=scenario('ONE_TRANSFER',bestSingle.value,[{out:bestSingle.out,in:bestSingle.in}],bestSingle.cash);
 let bestPair=null,pairCount=0;
 const shortlist=singles.slice(0,24);
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
  if(gain>0&&(!bestPair||gain>bestPair.gain))bestPair={a,b,cash,value,gain};
 }
 if(bestPair)res.scenarios.C=scenario('TWO_TRANSFERS',bestPair.value,
  [{out:bestPair.a.out,in:bestPair.a.in},{out:bestPair.b.out,in:bestPair.b.in}],bestPair.cash);
 res.search_evidence={legal_single_routes:singles.length,legal_pair_routes:pairCount,candidate_pool:candidates.size};
 return res;
}
