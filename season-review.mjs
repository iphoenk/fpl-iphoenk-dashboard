/* Season review: rank, points, team value and captain analysis from the official per-gameweek data.
   Pure and deterministic. Unknown stays null (never 0). The captain "optimal" is a HINDSIGHT figure and is never a forecast.
   Internals are prefixed sr or SR_ because the build concatenates all domain modules into one scope. */
const SR_INITIAL_BUDGET=1000; // tenths of GBP m: the fixed starting budget of 100.0
const srNum=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const srRound=(v,d=1)=>v===null?null:Math.round(v*10**d)/10**d;
const srOf=map=>gw=>map&&map[gw]!==undefined&&map[gw]!==null?map[gw]:null;

function srLiveRow(live,element){
 const row=(live?.elements||[]).find(e=>Number(e?.id)===Number(element));
 const minutes=srNum(row?.stats?.minutes),points=srNum(row?.stats?.total_points);
 return minutes===null||points===null?null:{minutes,points};
}

/* One gameweek of captaincy. Returns null when the data needed is not all known. */
function srCaptainGw(gw,picks,live){
 const list=picks?.picks||[];
 const cap=list.find(p=>p.is_captain),vice=list.find(p=>p.is_vice_captain);
 if(!cap||!live)return null;
 const rows=new Map();
 for(const p of list){const r=srLiveRow(live,p.element);if(r===null)return null;rows.set(p.element,r);}
 const multiplier=picks.active_chip==='3xc'?3:2;
 let holder=cap,viceTakeover=false,noArmbandPlayer=false;
 if(rows.get(cap.element).minutes===0){
  if(vice&&rows.get(vice.element).minutes>0){holder=vice;viceTakeover=true;}
  else noArmbandPlayer=true;
 }
 const chosenRaw=noArmbandPlayer?0:rows.get(holder.element).points;
 let best=list[0];
 for(const p of list)if(rows.get(p.element).points>rows.get(best.element).points)best=p;
 const bestRaw=rows.get(best.element).points;
 const chosenPoints=chosenRaw*multiplier,bestPoints=bestRaw*multiplier;
 return {
  gw,multiplier,
  chosen:{element:holder.element,rawPoints:chosenRaw,points:chosenPoints,viceTakeover,noArmbandPlayer},
  best:{element:best.element,rawPoints:bestRaw,points:bestPoints},
  missed:Math.max(0,bestPoints-chosenPoints),
  optimal:chosenRaw>=bestRaw
 };
}

function srRank(rows,perGw){
 const journey=rows.map(r=>({gw:r.event,rank:srNum(r.overall_rank)&&r.overall_rank>0?r.overall_rank:null}));
 const known=journey.filter(x=>x.rank!==null);
 let peak=null;
 for(const x of known)if(peak===null||x.rank<peak.value)peak={value:x.rank,gw:x.gw};
 let green=0,red=0,last=null;
 for(const x of known){if(last!==null){if(x.rank<last)green++;else if(x.rank>last)red++;}last=x.rank;}
 const current=known.length?known[known.length-1].rank:null;
 let note={kind:'unknown'};
 if(peak){
  const after=perGw.filter(g=>g.gw>peak.gw&&g.delta!==null);
  const aboveAverageSincePeak=after.length?after.filter(g=>g.delta>0).length>after.length/2:null;
  const kind=current===peak.value?'at_peak':current>peak.value*1.10?'dropped_since_peak':'near_peak';
  note={kind,peakGw:peak.gw,aboveAverageSincePeak};
 }
 return {current,peak,journey,greenArrows:known.length?green:null,redArrows:known.length?red:null,note};
}

function srPoints(rows,events){
 const avg=srOf(Object.fromEntries((events||[]).map(e=>[e.id,srNum(e.average_entry_score)])));
 const perGw=rows.map(r=>{const points=srNum(r.points),average=avg(r.event),delta=points!==null&&average!==null?points-average:null;return {gw:r.event,points,average,delta};});
 const known=perGw.filter(g=>g.points!==null);
 const gross=known.length===rows.length&&rows.length?known.reduce((a,g)=>a+g.points,0):null;
 const costs=rows.map(r=>srNum(r.event_transfers_cost));
 const hits=costs.length&&costs.every(c=>c!==null)?costs.reduce((a,c)=>a+c,0):null;
 return {
  totalGross:gross,hitsCost:hits,totalNet:gross!==null&&hits!==null?gross-hits:null,
  perGwAverage:gross!==null?srRound(gross/rows.length,1):null,
  perGw,
  above:perGw.filter(g=>g.delta!==null&&g.delta>0).length,
  below:perGw.filter(g=>g.delta!==null&&g.delta<0).length,
  equal:perGw.filter(g=>g.delta!==null&&g.delta===0).length
 };
}

/* The official `value` already includes the bank (tenths of GBP m). */
function srValue(rows){
 const series=rows.filter(r=>srNum(r.value)!==null).map(r=>({gw:r.event,value:r.value/10}));
 if(!series.length)return {total:null,bank:null,squad:null,peak:null,gained:null,initialBudget:SR_INITIAL_BUDGET/10,series:[]};
 const lastRow=[...rows].reverse().find(r=>srNum(r.value)!==null);
 const bank=srNum(lastRow.bank);
 return {
  total:lastRow.value/10,bank:bank===null?null:bank/10,squad:bank===null?null:srRound((lastRow.value-bank)/10,1),
  peak:Math.max(...series.map(x=>x.value)),
  gained:srRound((lastRow.value-SR_INITIAL_BUDGET)/10,1),initialBudget:SR_INITIAL_BUDGET/10,series
 };
}

export function buildSeasonReview({history,picksByGw,liveByGw,events}={}){
 const rows=(history?.current||[]).filter(r=>Number.isInteger(r?.event)).sort((a,b)=>a.event-b.event);
 const points=srPoints(rows,events);
 const rank=srRank(rows,points.perGw);
 const value=srValue(rows);
 const gwList=rows.map(r=>r.event);
 const perGw=[],missingGws=[];
 for(const gw of gwList){
  const g=srCaptainGw(gw,picksByGw?.[gw],liveByGw?.[gw]);
  if(g)perGw.push(g);else missingGws.push(gw);
 }
 const scored=perGw.length;
 const total=perGw.reduce((a,g)=>a+g.chosen.points,0),optimal=perGw.reduce((a,g)=>a+g.best.points,0),hits=perGw.filter(g=>g.optimal).length;
 const byHolder=new Map();
 for(const g of perGw){const m=byHolder.get(g.chosen.element)||{element:g.chosen.element,times:0,points:0};m.times++;m.points+=g.chosen.points;byHolder.set(g.chosen.element,m);}
 const captain={
  gws:perGw.map(g=>g.gw),perGw,scoredGws:scored,
  totalPoints:scored?total:null,averagePoints:scored?srRound(total/scored,1):null,
  optimalPoints:scored?optimal:null,missedPoints:scored?optimal-total:null,
  optimalHits:scored?hits:null,accuracyPct:scored?Math.round(hits/scored*100):null,
  mostCaptained:[...byHolder.values()].sort((a,b)=>b.times-a.times||b.points-a.points||a.element-b.element),
  hindsight:true
 };
 const status=!rows.length?'empty':missingGws.length?'partial':'complete';
 return {status,missingGws,gwsInHistory:gwList,rank,points,value,captain};
}
