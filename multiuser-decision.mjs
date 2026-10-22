import canonicalRules from './vendor/v12/fpl_2026_27.json' with {type:'json'};
import canonicalProvenance from './vendor/v12/provenance.json' with {type:'json'};
/* No-login public advisory. V12-informed route structure, NOT canonical V12.
   Official FPL ep_next only; no MC, private state, inferred hits or fake 3GW. */
export const PUBLIC_DECISION_VERSION='official-deterministic-v1';
const finite=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const score=p=>{const n=finite(p?.ep_next);return n!==null&&n>=0&&n<=40?n:null};
const cost=p=>{const n=finite(p?.now_cost);return n!==null&&Number.isInteger(n)&&n>0?n:null};
const round=n=>Math.round(n*100)/100;
const better=(a,b)=>score(b)-score(a)||a.id-b.id;
export const CANONICAL_RULES_PROVENANCE={...canonicalProvenance,scope:'SQUAD_LEGALITY_AND_LEGAL_XI_ENUMERATION',canonical_optimizer:false};
// Adapter of pinned V12 legal_squad. Inputs are public Official player rows.
export function canonicalSquadCheck(rows){
 const rules=canonicalRules.squad;
 if(!Array.isArray(rows)||rows.length!==rules.squad_size)return [false,'SQUAD_SIZE'];
 if(rows.some(p=>!Number.isSafeInteger(p?.id)||p.id<1||!Number.isSafeInteger(p?.team)||p.team<1||![1,2,3,4].includes(p?.element_type)))return [false,'INVALID_PUBLIC_PLAYER'];
 if(new Set(rows.map(p=>p.id)).size!==rows.length)return [false,'DUPLICATE_PLAYER'];
 const positions={GK:1,DEF:2,MID:3,FWD:4};
 if(!Object.entries(rules.position_counts).every(([pos,count])=>rows.filter(p=>p.element_type===positions[pos]).length===count))return [false,'POSITION_COMPOSITION'];
 const clubs=rows.reduce((a,p)=>(a[p.team]=(a[p.team]||0)+1,a),{});
 if(Object.values(clubs).some(count=>count>rules.max_players_per_club))return [false,'MAX_THREE_PER_CLUB'];
 return [true,'PASS'];
}
const validSquad=s=>canonicalSquadCheck(s)[0];
const templateCache=new Map();
// Adapter of pinned V12 _legal_xi_templates/enumerate_legal_xi. Cache only
// position masks, never account state or projections. Same index order as V12.
export function enumeratePublicXI(squad){
 if(!validSquad(squad))return [];
 const signature=squad.map(p=>p.element_type).join('');
 let masks=templateCache.get(signature);
 if(!masks){
  masks=[];
  const choose=(start,selected)=>{
   if(selected.length===canonicalRules.lineup.starting_xi_size){
    const counts=[0,0,0,0,0];for(const i of selected)counts[squad[i].element_type]++;
    if(counts[1]===canonicalRules.lineup.starting_goalkeepers&&canonicalRules.lineup.legal_formations.includes(counts.slice(2).join('-')))masks.push([...selected]);
    return;
   }
   for(let i=start;i<=squad.length-(11-selected.length);i++){selected.push(i);choose(i+1,selected);selected.pop();}
  };
  choose(0,[]);templateCache.set(signature,masks);
  if(templateCache.size>64)templateCache.delete(templateCache.keys().next().value);
 }
 return masks.map(mask=>[...mask]);
}
const compareIds=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]-b[i];}return 0;};
export function optimizePublicLineup(squad){
 if(!validSquad(squad)||squad.some(p=>score(p)===null))return null;
 const masks=enumeratePublicXI(squad),byFormation=new Map();
 for(const mask of masks){
  const rows=mask.map(i=>squad[i]).sort((a,b)=>a.element_type-b.element_type||better(a,b));
  const ranked=[...rows].sort(better),ids=rows.map(p=>p.id),chosen=new Set(ids);
  const formation=[2,3,4].map(pos=>rows.filter(p=>p.element_type===pos).length).join('-');
  const sum=rows.reduce((a,p)=>a+score(p),0)+score(ranked[0]);
  const previous=byFormation.get(formation);
  if(previous&&(sum<previous.sum-1e-8||(Math.abs(sum-previous.sum)<1e-8&&compareIds(ids,previous.starting_xi)>=0)))continue;
  const reserves=squad.filter(p=>!chosen.has(p.id));
  const bench=[...reserves.filter(p=>p.element_type===1).sort(better),...reserves.filter(p=>p.element_type!==1).sort(better)];
  byFormation.set(formation,{formation,starting_xi:ids,bench:bench.map(p=>p.id),captain:ranked[0].id,vice_captain:ranked[1].id,expected_points:round(sum),sum});
 }
 const ordered=[...byFormation.values()].sort((a,b)=>Math.abs(b.sum-a.sum)>1e-8?b.sum-a.sum:a.formation.localeCompare(b.formation));
 if(!ordered.length)return null;
 const {sum,...winner}=ordered[0];
 return {...winner,optimizer:{method:'EXACT_PUBLIC_MEAN_XP',exact_for_objective:true,legal_xi_count:masks.length,formations_evaluated:ordered.length,
  captain_multiplier:2,bench_objective:'GK_THEN_DESCENDING_MEAN_XP',autosub_modelled:false,vice_takeover_modelled:false,canonical_distributional_utility:false,monte_carlo:false},
  formation_comparison:ordered.map(({sum:raw,...row})=>({...row,delta_vs_best:round(raw-sum),selected:row.formation===winner.formation}))};
}
export function selectPublicXI(squad){
 if(!validSquad(squad)||squad.some(p=>score(p)===null))return null;
 const groups=[1,2,3,4].map(pos=>squad.filter(p=>p.element_type===pos).sort(better));
 let best=null;
 for(const legalFormation of canonicalRules.lineup.legal_formations){
  const [d,m,f]=legalFormation.split('-').map(Number);
  const xi=[groups[0][0],...groups[1].slice(0,d),...groups[2].slice(0,m),...groups[3].slice(0,f)];
  if(xi.length!==11)continue;
  const ordered=[...xi].sort(better),captain=ordered[0],vice=ordered[1],sum=xi.reduce((a,p)=>a+score(p),0)+score(captain);
  const formation=d+'-'+m+'-'+f;
  if(!best||sum>best.sum+1e-8||(Math.abs(sum-best.sum)<1e-8&&formation<best.formation)){
   const ids=new Set(xi.map(p=>p.id));
   const bench=[...groups[0].slice(1),...squad.filter(p=>!ids.has(p.id)&&p.element_type!==1).sort(better)];
   best={formation,starting_xi:xi.map(p=>p.id),bench:bench.map(p=>p.id),captain:captain.id,vice_captain:vice.id,expected_points:round(sum),sum};
  }
 }
 if(!best)return null;
 const {sum,...out}=best;return out;
}
export function publicDecision({entry,picks,bootstrap,planningGw}){
 const map=new Map((bootstrap?.elements||[]).map(p=>[Number(p.id),p]));
 const owned=(picks?.picks||[]).map(p=>map.get(Number(p.element)));
 if(!Array.isArray(picks?.picks)||owned.length!==15||owned.some(p=>!p)||!validSquad(owned)||
   !Number.isInteger(planningGw)||planningGw<1||planningGw>38)return {status:'unavailable',reason:'Official FPL squad or GW missing'};
 const hold=selectPublicXI(owned);
 if(!hold)return {status:'unavailable',reason:'All 15 owned players require valid Official FPL ep_next'};
 const bank=finite(picks.entry_history?.bank),bankKnown=bank!==null&&Number.isInteger(bank)&&bank>=0;
 const sales=new Map(picks.picks.map(p=>[Number(p.element),finite(p.selling_price)]));
 const validSale=p=>Number.isInteger(sales.get(p.id))&&sales.get(p.id)>0;
 const proxyCount=owned.filter(p=>!validSale(p)).length;
 const selling=p=>validSale(p)?sales.get(p.id):cost(p);
 const describe=(moves)=>moves.map(m=>({out:{id:m.out,web_name:map.get(m.out)?.web_name||'—'},in:{id:m.in,web_name:map.get(m.in)?.web_name||'—'}}));
 const scenario=(kind,xi,moves=[],cash=null)=>({kind,transfers:moves.length,changes:describe(moves),
   ...optimizePublicLineup(owned.map(p=>{const move=moves.find(m=>m.out===p.id);return move?map.get(move.in):p;})),gross_gain_vs_hold:round(xi.expected_points-hold.expected_points),
   bank_after_indicative:cash===null?null:round(cash/10),
   hit_points:null,net_gain:null,executable:false,decision_status:'PUBLIC_ADVISORY'});
 const base={status:'ready',contract:'PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1',model:PUBLIC_DECISION_VERSION,
  authority:'OFFICIAL_FPL_EP_NEXT',canonical_v12:false,canonical_components:CANONICAL_RULES_PROVENANCE,monte_carlo:false,planning_gw:planningGw,
  entry_id:Number(entry.id),source_squad_gw:Number(picks.entry_history?.event)||null,
  economics_status:bankKnown?(proxyCount?'PUBLIC_CURRENT_PRICE_PROXY_INDICATIVE':'PUBLIC_HISTORICAL_INDICATIVE'):'UNAVAILABLE',
  economics_evidence:{bank_basis:'LAST_PUBLISHED_GW_BANK',sale_basis:proxyCount?'CURRENT_OFFICIAL_MARKET_PRICE_PROXY':'PUBLISHED_PICK_SELLING_PRICE',proxy_player_count:proxyCount,actual_affordability_verified:false},
  assumptions:['One-GW Official ep_next, not actual points','Published squad, not pending transfers',
    'Indicative last-published bank and public price proxies are not actual sell prices; FT/hits unknown','No Monte Carlo or canonical V12 execution'],
  search_scope:'BOUNDED_NONCANONICAL',scenarios:{A:scenario('HOLD',hold),B:null,C:null}};
 if(!bankKnown||owned.some(p=>selling(p)===null)){
  base.status='partial';base.economics_status='UNAVAILABLE';
  base.reason='Public historical bank or usable player price unavailable; transfer economics unresolved';return base;
 }
 const currentIds=new Set(owned.map(p=>p.id));
 const universe=(bootstrap.elements||[]).filter(p=>!currentIds.has(p.id)&&[1,2,3,4].includes(p.element_type)&&
   ['a','d'].includes(p.status)&&score(p)!==null&&cost(p)!==null);
 const candidateIds=new Set();
 for(const pos of [1,2,3,4]){
  const rows=universe.filter(p=>p.element_type===pos);
  [...rows].sort(better).slice(0,12).concat([...rows].sort((a,b)=>cost(a)-cost(b)||a.id-b.id).slice(0,8))
  .forEach(p=>candidateIds.add(p.id));
 }
 const singles=[];
 for(const out of owned){
  const sale=selling(out);if(sale===null)continue;
  for(const incoming of universe){
   if(!candidateIds.has(incoming.id)||incoming.element_type!==out.element_type||cost(incoming)>bank+sale)continue;
   const squad=owned.map(p=>p.id===out.id?incoming:p);
   if(!validSquad(squad))continue;
   const xi=selectPublicXI(squad);if(!xi)continue;
   singles.push({out:out.id,in:incoming.id,cash:bank+sale-cost(incoming),xi,gain:round(xi.expected_points-hold.expected_points)});
  }
 }
 singles.sort((a,b)=>b.gain-a.gain||a.out-b.out||a.in-b.in);
 const one=singles[0];
 if(one)base.scenarios.B=scenario('ONE_TRANSFER',one.xi,[{out:one.out,in:one.in}],one.cash);
 // Bounded shortlist pairing: exact legal XI is recomputed for each shortlisted pair.
 let best=null;
 const shortlist=[];const perOutgoing=new Map();
 for(const candidate of singles){
  const count=perOutgoing.get(candidate.out)||0;
  if(count>=3)continue;
  shortlist.push(candidate);perOutgoing.set(candidate.out,count+1);
  if(shortlist.length>=45)break;
 }
 for(let i=0;i<shortlist.length;i++)for(let j=i+1;j<shortlist.length;j++){
  const a=shortlist[i],b=shortlist[j];if(a.out===b.out||a.in===b.in)continue;
  const outA=map.get(a.out),outB=map.get(b.out),inA=map.get(a.in),inB=map.get(b.in);
  const cash=bank+selling(outA)+selling(outB)-cost(inA)-cost(inB);
  if(!Number.isInteger(cash)||cash<0)continue;
  const squad=owned.map(p=>p.id===a.out?inA:p.id===b.out?inB:p);
  if(!validSquad(squad))continue;
  const xi=selectPublicXI(squad);if(!xi)continue;
  const gain=round(xi.expected_points-hold.expected_points);
  if(!best||gain>best.gain){best={a,b,cash,xi,gain};}
 }
 if(best)base.scenarios.C=scenario('TWO_TRANSFERS',best.xi,[{out:best.a.out,in:best.a.in},{out:best.b.out,in:best.b.in}],best.cash);
 base.candidates_considered=singles.length;
 return base;
}
