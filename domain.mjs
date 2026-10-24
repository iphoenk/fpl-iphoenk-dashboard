export function entryId(value){const s=String(value).trim();const m=s.match(/\/entry\/(\d+)(?:\/|$)/);const id=m?m[1]:s;return /^[1-9]\d{0,9}$/.test(id)?id:null;}
// Published manager picks are available for the latest finished GW, not
// necessarily for the FPL event currently marked is_current.  During the
// pre-deadline window, using is_current makes /entry/:id/event/:gw/picks fail
// and can surface a misleading identity-mismatch error in the connection UI.
export function defaultGameweek(events){
 const finished=[...events].reverse().find(e=>e.finished);
 return finished?.id||events.find(e=>e.is_current)?.id||null;
}
export function snapshotIsCurrent(snapshot,events,next){
 if(!snapshot||!next||snapshot.gw!==next.id||!events?.length)return false;
 const generated=Date.parse(snapshot.generated),start=Date.parse(events[0].deadline_time),deadline=Date.parse(next.deadline_time);
 return Number.isFinite(generated)&&Number.isFinite(start)&&Number.isFinite(deadline)&&generated>=start-30*86400000&&generated<=deadline;
}
export function projection(player,model,manifest,nextEvent,team){
 if(!model||!manifest||!nextEvent)return null;
 const p=model[player.id];const deadline=new Date(manifest.deadline).getTime();
 if(!p||manifest.gameweek!==nextEvent.id||deadline!==new Date(nextEvent.deadline_time).getTime()||p.web_name!==player.web_name||p.team_name!==team?.short_name)return null;
 const v=Number(p.predicted_points);return Number.isFinite(v)?v:null;
}
export function comparePicks(a,b){const sa=new Set(a.map(p=>p.element)),sb=new Set(b.map(p=>p.element));return {shared:[...sa].filter(id=>sb.has(id)),onlyA:[...sa].filter(id=>!sb.has(id)),onlyB:[...sb].filter(id=>!sa.has(id))};}
export function bestXI(players,metric){
 const usable=players.filter(p=>Number.isFinite(metric(p)));
 const groups=Object.fromEntries([1,2,3,4].map(type=>[type,usable.filter(p=>p.element_type===type).sort((a,b)=>metric(b)-metric(a))]));
 let best=null;
 for(let d=3;d<=5;d++)for(let m=2;m<=5;m++){
  const f=10-d-m;if(f<1||f>3)continue;
  let xi=[[1,1],[2,d],[3,m],[4,f]].flatMap(([type,n])=>groups[type].slice(0,n));if(xi.length!==11)continue;
  for(let round=0;round<11;round++){
   const counts=xi.reduce((acc,p)=>(acc[p.team]=(acc[p.team]||0)+1,acc),{}),over=new Set(Object.keys(counts).filter(k=>counts[k]>3).map(Number));
   if(!over.size)break;
   const ids=new Set(xi.map(p=>p.id));let swap=null;
   for(const out of xi.filter(p=>over.has(p.team))){const incoming=groups[out.element_type].find(p=>!ids.has(p.id)&&p.team!==out.team&&(counts[p.team]||0)<3);if(!incoming)continue;const loss=metric(out)-metric(incoming);if(!swap||loss<swap.loss)swap={out,incoming,loss};}
   if(!swap){xi=[];break;}xi=xi.map(p=>p===swap.out?swap.incoming:p);
  }
  if(xi.length!==11||Object.values(xi.reduce((acc,p)=>(acc[p.team]=(acc[p.team]||0)+1,acc),{})).some(n=>n>3))continue;
  const total=xi.reduce((sum,p)=>sum+metric(p),0);if(!best||total>best.total)best={players:xi,total,formation:d+'-'+m+'-'+f};
 }
 return best;
}
