export function entryId(value){const s=String(value).trim();const m=s.match(/\/entry\/(\d+)(?:\/|$)/);const id=m?m[1]:s;return /^[1-9]\d{0,9}$/.test(id)?id:null;}
// Published manager picks are available for the latest finished GW, not necessarily for the FPL event currently marked is_current.
export function defaultGameweek(events){const finished=[...events].reverse().find(e=>e.finished);return finished?.id||events.find(e=>e.is_current)?.id||null;}
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
export function validateTransfer(picks,outId,inId,players,bank){
 const ids=picks.map(p=>p.element);const out=players[outId],incoming=players[inId];
 if(!out||!incoming)return 'Pilih pemain keluar dan masuk.';
 if(ids.includes(Number(inId)))return 'Pemain ini sudah ada di skuad.';
 if(out.element_type!==incoming.element_type)return 'Posisi pemain harus sama.';
 const next=ids.filter(id=>id!==Number(outId)).concat(Number(inId));
 if(next.filter(id=>players[id].team===incoming.team).length>3)return 'Maksimal 3 pemain dari satu klub.';
 if(!Number.isFinite(bank))return 'Isi nilai bank dan harga jual aktual untuk mengecek anggaran.';
 return null;
}
export function displayPickPoints(points,pick){
 if(points==null||!Number.isFinite(Number(points)))return null;
 const multiplier=Number(pick?.multiplier);
 return Number(points)*(multiplier===2||multiplier===3?multiplier:1);
}
export function officialPhotoSources(player){
 const current='https://resources.premierleague.com/premierleague25/photos/players/110x140/';
 const placeholder=current+'placeholder.png';
 if(player?.has_temporary_code)return [placeholder];
 const code=String(player?.code||player?.photo||'').replace(/\.[^.]+$/,'');
 if(!/^\d+$/.test(code))return [placeholder];
 return [current+code+'.png','https://resources.premierleague.com/premierleague/photos/players/110x140/p'+code+'.png',placeholder];
}
export function keeperScoutRows(players,fixtures,teams){
 return players.filter(p=>p.element_type===1).map(p=>{
  const games=fixtures.filter(f=>f.started&&f.event&&(f.team_h===p.team||f.team_a===p.team)).length;
  const starts=Number(p.starts)||0,minutes=Number(p.minutes)||0;
  return {id:p.id,webName:p.web_name,teamId:p.team,teamShort:teams[p.team]?.short_name||'',price:p.now_cost/10,minutes,startRate:games?Math.min(1,starts/games):null,minutesPerStart:starts?minutes/starts:null,saves90:Number(p.saves_per_90)||0,cleanSheets:Number(p.clean_sheets)||0,pointsPerGame:Number(p.points_per_game)||0,totalPoints:Number(p.total_points)||0,xgc90:Number(p.expected_goals_conceded_per_90)||0,bps90:minutes?Number(p.bps||0)/minutes*90:null};
 });
}
export function valueMetricOptions(position){
 const metrics={
  saves90:{key:'saves90',label:'Saves per 90',field:'saves_per_90',note:'Volume penyelamatan kiper per 90 menit.'},
  cs90:{key:'cs90',label:'Clean sheets per 90',field:'clean_sheets_per_90',note:'Frekuensi clean sheet per 90 menit.'},
  xgc90:{key:'xgc90',label:'Expected goals conceded per 90',field:'expected_goals_conceded_per_90',lower:true,note:'Kualitas peluang yang dihadapi pertahanan per 90 menit; ini juga dipengaruhi tim.'},
  gc90:{key:'gc90',label:'Goals conceded per 90',field:'goals_conceded_per_90',lower:true,note:'Gol yang kebobolan per 90 menit; ini juga dipengaruhi tim.'},
  defcon90:{key:'defcon90',label:'Defensive contributions per 90',field:'defensive_contribution_per_90',note:'Kontribusi bertahan resmi FPL per 90 menit, bukan probabilitas bonus DefCon.'},
  xgi90:{key:'xgi90',label:'xGI per 90',field:'expected_goal_involvements_per_90',note:'Expected goals + expected assists per 90 menit.'},
  xg90:{key:'xg90',label:'Expected goals per 90',field:'expected_goals_per_90',note:'Kualitas peluang gol yang didapat pemain per 90 menit.'},
  xa90:{key:'xa90',label:'Expected assists per 90',field:'expected_assists_per_90',note:'Kreativitas: kualitas peluang gol yang diciptakan per 90 menit.'},
  assists90:{key:'assists90',label:'Assists per 90',total:'assists',note:'Assist aktual dibagi menit bermain × 90.'},
  goals90:{key:'goals90',label:'Goals per 90',total:'goals_scored',note:'Gol aktual dibagi menit bermain × 90.'},
  ppg:{key:'ppg',label:'Points per game',field:'points_per_game',note:'Poin rata-rata per penampilan; pilih posisi untuk metrik yang sesuai peran.'},
  points:{key:'points',label:'Total points',field:'total_points',note:'Poin musim berjalan; total dipengaruhi jumlah pertandingan dan menit bermain.'},
  xp:{key:'xp',label:'Projected points',note:'Estimasi poin untuk gameweek berikutnya, bukan jaminan hasil.'},
  form:{key:'form',label:'Form',field:'form',note:'Form resmi FPL.'},
  bps90:{key:'bps90',label:'BPS per 90',total:'bps',note:'Bonus Points System per 90 menit, bukan bonus points yang sudah diberikan.'}
 };
 const keys={1:['saves90','cs90','xgc90','gc90'],2:['cs90','xgc90','defcon90','xgi90','xg90','xa90'],3:['xa90','xgi90','xg90','assists90','defcon90'],4:['xg90','xgi90','goals90','xa90']}[Number(position)]||[];
 return [...keys,'ppg','points','xp','form','bps90'].map(key=>metrics[key]);
}
export function valueMetricNumber(player,metric,projected=null){
 if(metric.key==='xp')return projected!=null&&Number.isFinite(Number(projected))?Number(projected):null;
 if(metric.total){const minutes=Number(player.minutes),total=player[metric.total];return minutes>0&&total!=null&&Number.isFinite(Number(total))?Number(total)/minutes*90:null;}
 const value=player[metric.field];return value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
}
