// Descriptive official match history; never a calibrated next-GW probability.
export function summarizeCaptainHistory(history, finalFixtures) {
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 const allowed=new Set(finalFixtures), seen=new Set(), rows=[];
 for(const row of history||[]) {
  if(!allowed.has(row.fixture)||seen.has(row.fixture)||!Number.isInteger(row.round))continue;
  seen.add(row.fixture);rows.push(row);
 }
 const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 const values=key=>rows.map(r=>finite(r[key])).filter(v=>v!==null);
 const rate=(key,fn)=>{const v=values(key);return v.length?100*v.filter(fn).length/v.length:null;};
 const groups=new Map();for(const r of rows){if(!groups.has(r.round))groups.set(r.round,[]);groups.get(r.round).push(r);}
 const weeks=[...groups].sort((a,b)=>a[0]-b[0]).map(([gw,matches])=>{
  const sum=key=>matches.every(r=>finite(r[key])!==null)?matches.reduce((n,r)=>n+Number(r[key]),0):null;
  return {gw,points:sum('total_points'),minutes:sum('minutes'),matches:matches.length};
 });
 const points=weeks.map(w=>w.points).filter(v=>v!==null), average=mean(points);
 const totals={};for(const key of ['goals_scored','assists','clean_sheets','saves','bonus','defensive_contribution','yellow_cards','red_cards','own_goals','penalties_missed','goals_conceded']){
  const v=values(key);totals[key]=rows.length&&v.length===rows.length?v.reduce((a,b)=>a+b,0):null;
 }
 return {weeks,matches:rows.length,mean:average,recent:mean(weeks.slice(-3).map(w=>w.points).filter(v=>v!==null)),
  spread:average===null?null:Math.sqrt(mean(points.map(v=>(v-average)**2))),
  returnRate:points.length?100*points.filter(v=>v>=6).length/points.length:null,
  haulRate:points.length?100*points.filter(v=>v>=10).length/points.length:null,
  startRate:rate('starts',v=>v>=1),sixtyRate:rate('minutes',v=>v>=60),meanMinutes:mean(values('minutes')),totals};
}

export function captainProjectionValue(value){return value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))?null:Number(value);}
