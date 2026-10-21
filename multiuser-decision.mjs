/* No-login public advisory. V12-informed route structure, NOT canonical V12.
   Official FPL ep_next only; no MC, private state, inferred hits or fake 3GW. */
export const PUBLIC_DECISION_VERSION='official-deterministic-v1';
const finite=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const score=p=>{const n=finite(p?.ep_next);return n!==null&&n>=0&&n<=40?n:null};
const cost=p=>{const n=finite(p?.now_cost);return n!==null&&Number.isInteger(n)&&n>0?n:null};
const round=n=>Math.round(n*100)/100;
const better=(a,b)=>score(b)-score(a)||a.id-b.id;
const validSquad=s=>s.length===15&&new Set(s.map(p=>p.id)).size===15&&
 [[1,2],[2,5],[3,5],[4,3]].every(([pos,n])=>s.filter(p=>p.element_type===pos).length===n)&&
 Object.values(s.reduce((a,p)=>(a[p.team]=(a[p.team]||0)+1,a),{})).every(n=>n<=3);
export function selectPublicXI(squad){
 if(!validSquad(squad)||squad.some(p=>score(p)===null))return null;
 const groups=[1,2,3,4].map(pos=>squad.filter(p=>p.element_type===pos).sort(better));
 let best=null;
 for(let d=3;d<=5;d++)for(let m=2;m<=5;m++){
  const f=10-d-m;if(f<1||f>3)continue;
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
 const selling=p=>sales.get(p.id)??cost(p);
 const describe=(moves)=>moves.map(m=>({out:{id:m.out,web_name:map.get(m.out)?.web_name||'—'},in:{id:m.in,web_name:map.get(m.in)?.web_name||'—'}}));
 const scenario=(kind,xi,moves=[],cash=null)=>({kind,transfers:moves.length,changes:describe(moves),
   ...xi,gross_gain_vs_hold:round(xi.expected_points-hold.expected_points),
   bank_after_indicative:cash===null?null:round(cash/10),
   hit_points:null,net_gain:null,executable:false,decision_status:'PUBLIC_ADVISORY'});
 const base={status:'ready',contract:'PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1',model:PUBLIC_DECISION_VERSION,
  authority:'OFFICIAL_FPL_EP_NEXT',canonical_v12:false,monte_carlo:false,planning_gw:planningGw,
  entry_id:Number(entry.id),source_squad_gw:Number(picks.entry_history?.event)||null,
  economics_status:bankKnown?'PUBLIC_HISTORICAL_INDICATIVE':'UNAVAILABLE',
  assumptions:['One-GW Official ep_next, not actual points','Published squad, not pending transfers',
    'Indicative public bank/sale prices; free transfers and hits unknown','No Monte Carlo or canonical V12 execution'],
  search_scope:'BOUNDED_NONCANONICAL',scenarios:{A:scenario('HOLD',hold),B:null,C:null}};
 if(!bankKnown){base.status='partial';base.reason='Public bank unavailable; transfer economics unresolved';return base;}
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
 const one=singles.find(s=>s.gain>0);
 if(one)base.scenarios.B=scenario('ONE_TRANSFER',one.xi,[{out:one.out,in:one.in}],one.cash);
 // Bounded shortlist pairing: exact legal XI is recomputed for each shortlisted pair.
 let best=null;
 const shortlist=singles.slice(0,24);
 for(let i=0;i<shortlist.length;i++)for(let j=i+1;j<shortlist.length;j++){
  const a=shortlist[i],b=shortlist[j];if(a.out===b.out||a.in===b.in)continue;
  const outA=map.get(a.out),outB=map.get(b.out),inA=map.get(a.in),inB=map.get(b.in);
  const cash=bank+selling(outA)+selling(outB)-cost(inA)-cost(inB);
  if(!Number.isInteger(cash)||cash<0)continue;
  const squad=owned.map(p=>p.id===a.out?inA:p.id===b.out?inB:p);
  if(!validSquad(squad))continue;
  const xi=selectPublicXI(squad);if(!xi)continue;
  const gain=round(xi.expected_points-hold.expected_points);
  if(gain>0&&(!best||gain>best.gain)){best={a,b,cash,xi,gain};}
 }
 if(best)base.scenarios.C=scenario('TWO_TRANSFERS',best.xi,[{out:best.a.out,in:best.a.in},{out:best.b.out,in:best.b.in}],best.cash);
 base.candidates_considered=singles.length;
 return base;
}
