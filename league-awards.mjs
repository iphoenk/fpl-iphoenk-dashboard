// Pure league Awards and ownership metrics over a full-league context (D03).
// No imports: the file is concatenated into the browser bundle with `export ` stripped.
// Rules: unknown is null (never 0); ties return every winner; an all-equal field has an explicit status,
// not a silent empty list; PARTIAL coverage never produces a "whole league" label and is never final.

function awardNumber(value){
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const number=Number(value);
 return Number.isFinite(number)?number:null;
}
const entryHistoryValue=(record,key)=>awardNumber(record?.picks?.entry_history?.[key]);
const netPoints=record=>{const points=entryHistoryValue(record,'points'),hit=entryHistoryValue(record,'event_transfers_cost');return points===null||hit===null?null:points-hit;};

// Captain contribution with the multiplier FPL published (TC=3, VC takeover already reflected). Never re-applied.
export function captainContribution(record,live){
 const picks=record?.picks?.picks||[];
 const pick=picks.find(p=>awardNumber(p.multiplier)>1)||picks.find(p=>p.is_captain);
 const points=awardNumber(live?.[pick?.element]?.stats?.total_points),multiplier=awardNumber(pick?.multiplier);
 return points===null||multiplier===null?null:points*multiplier;
}
function captainMinutes(record,live){
 const pick=(record?.picks?.picks||[]).find(p=>awardNumber(p.multiplier)>1)||(record?.picks?.picks||[]).find(p=>p.is_captain);
 return awardNumber(live?.[pick?.element]?.stats?.minutes);
}
function overallRankChange(record,gameweek){
 const weeks=record?.history?.current;if(!Array.isArray(weeks))return null;
 const prior=weeks.find(w=>Number(w.event)===gameweek-1),now=weeks.find(w=>Number(w.event)===gameweek);
 const before=awardNumber(prior?.overall_rank),after=awardNumber(now?.overall_rank);
 return before===null||after===null?null:before-after;
}
function leaguePositionChange(record){
 const last=awardNumber(record?.row?.last_rank),rank=awardNumber(record?.row?.rank);
 return last===null||last<=0||rank===null?null:last-rank;
}

// Select winners from {id,name,value}. All tied winners are returned.
export function pickWinners(entries,{direction='max',positive=false,separate=false}={}){
 const eligible=entries.filter(e=>awardNumber(e.value)!==null&&(!positive||Number(e.value)>0));
 if(!eligible.length)return {status:'NO_QUALIFIER',winners:[],eligible:0};
 if(separate){
  if(eligible.length<2)return {status:'INSUFFICIENT_FIELD',winners:[],eligible:eligible.length};
  if(new Set(eligible.map(e=>Number(e.value))).size<2)return {status:'ALL_EQUAL',winners:[],eligible:eligible.length};
 }
 const best=(direction==='min'?Math.min:Math.max)(...eligible.map(e=>Number(e.value)));
 return {status:'WINNERS',winners:eligible.filter(e=>Number(e.value)===best),eligible:eligible.length};
}

// Ownership metrics across a COMPLETE league. EO(lineup) = sum(multiplier of starters) / N. Not Top10k, not squad EO.
export function leagueOwnershipMetrics(records,total=records.length){
 const n=awardNumber(total);const out={};
 if(!n||n<=0)return out;
 for(const record of records){
  for(const pick of record.picks?.picks||[]){
   const id=pick.element,entry=out[id]||(out[id]={owned:0,starting:0,captain:0,multiplierSum:0});
   entry.owned+=1;
   const multiplier=awardNumber(pick.multiplier)??0;
   if(awardNumber(pick.position)<=11&&multiplier>0){entry.starting+=1;entry.multiplierSum+=multiplier;}
   if(pick.is_captain)entry.captain+=1;
  }
 }
 for(const entry of Object.values(out)){
  entry.ownership_pct=entry.owned/n*100;entry.starting_pct=entry.starting/n*100;
  entry.captain_pct=entry.captain/n*100;entry.eo_pct=entry.multiplierSum/n*100;
 }
 return out;
}

const CATEGORY_DEFS=[
 {id:'top_scorer',title:'Top scorer',description:'Net GW points after hits',unit:'pts',opts:{separate:true}},
 {id:'tough_week',title:'Tough week',description:'Lowest net GW points',unit:'pts',opts:{direction:'min',separate:true}},
 {id:'captain_star',title:'Captain star',description:'Captain points with the published multiplier',unit:'pts',opts:{separate:true}},
 {id:'armband_miss',title:'Armband miss',description:'Lowest captain points among captains who have played',unit:'pts',opts:{direction:'min',separate:true}},
 {id:'overall_rank_riser',title:'Overall rank riser',description:'Overall rank places gained since the previous GW (not mini-league position)',unit:'OR places',opts:{positive:true}},
 {id:'overall_rank_faller',title:'Overall rank faller',description:'Overall rank places lost since the previous GW (not mini-league position)',unit:'OR places',opts:{positive:true}},
 {id:'chip_performer',title:'Chip performer',description:'Best net points with a chip active (not the chip\'s incremental benefit)',unit:'pts',opts:{}},
 {id:'no_chip_performer',title:'No-chip performer',description:'Best net points with no chip',unit:'pts',opts:{}},
 {id:'bench_regret',title:'Bench regret',description:'20+ raw points on the bench without Bench Boost',unit:'pts',opts:{}},
 {id:'biggest_hit',title:'Biggest hit',description:'Largest transfer cost taken (a cost, not an achievement)',unit:'pts',opts:{positive:true}},
 {id:'value_leader',title:'Value leader',description:'Public team value in £0.1m as published (bank not added again; not the actual sell budget)',unit:'£0.1m',opts:{positive:true}},
 {id:'unique_haul',title:'Unique player haul',description:'Highest points from a starter owned by exactly one team in the whole league',unit:'pts',opts:{positive:true}},
 {id:'league_riser',title:'League riser',description:'Mini-league positions gained since the previous GW (membership changes can distort this)',unit:'league places',opts:{positive:true}},
 {id:'league_faller',title:'League faller',description:'Mini-league positions lost since the previous GW (membership changes can distort this)',unit:'league places',opts:{positive:true}}
];
export const AWARD_CATEGORY_IDS=CATEGORY_DEFS.map(d=>d.id);

export function computeLeagueAwards({records=[],live={},event=null,gameweek=null,coverage={complete:false,total:null,loaded:records.length,reason:null}}={}){
 const gw=awardNumber(gameweek);
 const complete=coverage?.complete===true&&awardNumber(coverage.total)!==null&&records.length===Number(coverage.total);
 const checked=event?.finished===true&&event?.data_checked===true;
 const final=complete&&checked;
 const ids=records.map(r=>String(r.row?.entry));
 const uniqueRecords=new Set(ids).size===ids.length;
 const owners=new Map();
 for(const record of records)for(const pick of record.picks?.picks||[])owners.set(pick.element,(owners.get(pick.element)||0)+1);
 const entries=fn=>records.map(r=>({id:r.row.entry,name:r.row.entry_name,value:fn(r)}));
 const value={
  top_scorer:netPoints,tough_week:netPoints,
  captain_star:r=>captainContribution(r,live),
  armband_miss:r=>{const points=captainContribution(r,live);if(points===null)return null;const minutes=captainMinutes(r,live);return checked||(minutes!==null&&minutes>0)?points:null;},
  overall_rank_riser:r=>overallRankChange(r,gw),
  overall_rank_faller:r=>{const v=overallRankChange(r,gw);return v===null?null:-v;},
  chip_performer:r=>r.picks?.active_chip?netPoints(r):null,
  no_chip_performer:r=>!r.picks?.active_chip?netPoints(r):null,
  bench_regret:r=>{const bench=entryHistoryValue(r,'points_on_bench');return r.picks?.active_chip!=='bboost'&&bench!==null&&bench>=20?bench:null;},
  biggest_hit:r=>entryHistoryValue(r,'event_transfers_cost'),
  value_leader:r=>entryHistoryValue(r,'value'),
  unique_haul:r=>{
   if(!complete)return null;
   const values=(r.picks?.picks||[]).filter(p=>awardNumber(p.multiplier)>0&&owners.get(p.element)===1).map(p=>{const points=awardNumber(live?.[p.element]?.stats?.total_points);return points===null?null:points*Number(p.multiplier);}).filter(v=>v!==null);
   return values.length?Math.max(...values):null;
  },
  league_riser:leaguePositionChange,
  league_faller:r=>{const v=leaguePositionChange(r);return v===null?null:-v;}
 };
 const categories=CATEGORY_DEFS.map(def=>{
  const data=entries(value[def.id]);
  if(def.id==='unique_haul'&&!complete)return {id:def.id,title:def.title,description:def.description,unit:def.unit,status:'UNAVAILABLE',reason:'Needs ownership across every team in the league',winners:[],eligible:0,scope:'LOADED_SAMPLE',provisional:true};
  const picked=pickWinners(data,def.opts);
  const missing=data.filter(e=>awardNumber(e.value)===null).length;
  return {id:def.id,title:def.title,description:def.description,unit:def.unit,status:picked.status,winners:picked.winners,eligible:picked.eligible,unknown_or_ineligible:missing,scope:complete?'FULL_LEAGUE':'LOADED_SAMPLE',provisional:!final};
 });
 return {
  version:'FPL_LEAGUE_AWARDS_V1',gameweek:gw,
  status:complete&&uniqueRecords?'COMPLETE':'PARTIAL',final:final&&uniqueRecords,
  coverage:{complete,total:awardNumber(coverage?.total),loaded:records.length,reason:coverage?.reason||null,duplicate_entries:!uniqueRecords},
  categories
 };
}
