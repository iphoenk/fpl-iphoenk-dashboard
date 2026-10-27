/* Season review (My Team): rank, points, team value and captaincy for FINISHED gameweeks.
   Loaded on demand (about 2 requests per finished gameweek); formulas live in season-review.mjs. Names are prefixed srui. */
const sruiCompact=n=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
const sruiNum=(n,d=0)=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('en',{minimumFractionDigits:d,maximumFractionDigits:d});
const sruiMoney=v=>v===null||v===undefined?'—':'£'+Number(v).toFixed(1)+'m';
const sruiName=id=>esc(state.players[id]?.web_name||'Player '+id);
const sruiState={entry:null,status:'idle',review:null,excluded:[],progress:''};

function sruiLine(points,{label,invert=false,format=sruiCompact,markGw=null}){
 const known=points.filter(p=>p.y!==null);
 if(known.length<2)return '<p class="muted">Not enough finished gameweeks for a chart yet.</p>';
 const W=640,H=190,L=46,R=14,T=14,B=26,xs=points.map(p=>p.x),x0=Math.min(...xs),x1=Math.max(...xs);
 const lo=Math.min(...known.map(p=>p.y)),hi=Math.max(...known.map(p=>p.y)),span=hi-lo||1;
 const X=x=>L+(x1===x0?0:(x-x0)/(x1-x0)*(W-L-R)),Y=y=>{const t=(y-lo)/span;return T+(invert?t:1-t)*(H-T-B);};
 const path=known.map((p,i)=>(i?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.y).toFixed(1)).join(' ');
 const step=points.length>14?Math.ceil(points.length/10):1;
 const ticks=points.filter((p,i)=>i%step===0||i===points.length-1).map(p=>'<text x="'+X(p.x).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+p.x+'</text>').join('');
 const dots=known.map(p=>'<circle cx="'+X(p.x).toFixed(1)+'" cy="'+Y(p.y).toFixed(1)+'" r="'+(p.x===markGw?5:3)+'" class="'+(p.x===markGw?'srui-mark':'')+'"><title>GW '+p.x+': '+esc(format(p.y))+'</title></circle>').join('');
 return '<svg class="srui-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'" focusable="false"><line x1="'+L+'" y1="'+T+'" x2="'+L+'" y2="'+(H-B)+'" class="srui-axis"/><line x1="'+L+'" y1="'+(H-B)+'" x2="'+(W-R)+'" y2="'+(H-B)+'" class="srui-axis"/><text x="'+(L-6)+'" y="'+(T+4)+'" text-anchor="end">'+esc(format(invert?lo:hi))+'</text><text x="'+(L-6)+'" y="'+(H-B)+'" text-anchor="end">'+esc(format(invert?hi:lo))+'</text><path d="'+path+'" class="srui-line"/>'+dots+ticks+'</svg>';
}

function sruiBars(perGw){
 const rows=perGw.filter(g=>g.points!==null);
 if(!rows.length)return '<p class="muted">No finished gameweeks yet.</p>';
 const max=Math.max(...rows.map(g=>Math.max(g.points,g.average??0)),1)*1.12,W=Math.max(320,rows.length*34),H=170,T=16,B=26,bw=Math.min(22,(W/rows.length)*.62);
 const bars=rows.map((g,i)=>{const cx=(i+.5)*(W/rows.length),h=g.points/max*(H-T-B),y=H-B-h,cls=g.delta===null?'srui-neutral':g.delta>0?'srui-above':g.delta<0?'srui-below':'srui-neutral';
  const avg=g.average===null?'':'<line x1="'+(cx-bw/2-3).toFixed(1)+'" x2="'+(cx+bw/2+3).toFixed(1)+'" y1="'+(H-B-g.average/max*(H-T-B)).toFixed(1)+'" y2="'+(H-B-g.average/max*(H-T-B)).toFixed(1)+'" class="srui-avg"/>';
  return '<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(h,1).toFixed(1)+'" class="'+cls+'"><title>GW '+g.gw+': '+g.points+' points'+(g.average===null?'':' (average '+g.average+')')+'</title></rect>'+avg+'<text x="'+cx.toFixed(1)+'" y="'+Math.max(y-4,10).toFixed(1)+'" text-anchor="middle">'+g.points+'</text><text x="'+cx.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+g.gw+'</text>';}).join('');
 return '<div class="srui-scroll" tabindex="0" role="region" aria-label="Points by gameweek, scrollable"><svg class="srui-svg srui-bars" style="min-width:'+W+'px" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Points per gameweek compared with the gameweek average" focusable="false">'+bars+'</svg></div><p class="srui-legend"><span><i class="srui-above"></i>Above average</span><span><i class="srui-below"></i>Below average</span><span><i class="srui-avgkey"></i>Gameweek average</span><span class="muted">Values are gross, before transfer cost.</span></p>';
}

function sruiNote(rank){
 const n=rank.note;
 if(!n||n.kind==='unknown')return '';
 if(n.kind==='at_peak')return 'Your current rank is your best of the season so far.';
 if(n.kind==='near_peak')return 'Your rank is within 10% of your GW'+n.peakGw+' peak.';
 return 'Since peaking in GW'+n.peakGw+', your rank has dropped'+(n.aboveAverageSincePeak===true?' despite mostly above-average scoring.':n.aboveAverageSincePeak===false?', with scoring at or below average in most gameweeks since.':'.');
}
const sruiCard=(label,value,sub='',cls='')=>'<div class="srui-card '+cls+'"><span class="srui-label">'+label+'</span><strong>'+value+'</strong>'+(sub?'<small>'+sub+'</small>':'')+'</div>';

function sruiRender(){
 const root=document.getElementById('seasonReview');if(!root)return;
 const s=sruiState;
 const intro='Rank, points, team value and captaincy from finished gameweeks only. Provisional gameweeks are never counted.';
 if(!state.entry){root.innerHTML=panel('Season review',emptyState('Connect your Entry ID to see your season review.'));return;}
 if(s.status==='idle'){root.innerHTML=panel('Season review','<p class="muted">'+esc(intro)+'</p><button type="button" class="btn primary srui-load" id="seasonReviewLoad">Load season review</button>','Loads on demand','seasonReviewPanel');return;}
 if(s.status==='loading'){root.innerHTML=panel('Season review','<p role="status" aria-live="polite"><span class="loader"></span> '+esc(s.progress||'Loading…')+'</p>','', 'seasonReviewPanel');return;}
 if(s.status==='error'){root.innerHTML=panel('Season review','<div class="notice" role="alert">'+esc(s.error)+'</div><button type="button" class="btn srui-load" id="seasonReviewLoad">Try again</button>','', 'seasonReviewPanel');return;}
 const r=s.review;
 const through=r.gwsInHistory.length?'GW'+r.gwsInHistory[0]+'–GW'+r.gwsInHistory[r.gwsInHistory.length-1]:'no finished gameweek';
 const excluded=s.excluded.length?' GW'+s.excluded.join(', GW')+' in progress: not counted.':'';
 const missing=r.missingGws.length?'<div class="notice" role="status">Partial: captain data is missing for GW'+r.missingGws.join(', GW')+'. Those gameweeks are left out of the captain figures, not counted as zero.</div>':'';
 const p=r.points,k=r.captain,v=r.value,rk=r.rank;
 const overview='<div class="srui-grid">'+
  sruiCard('Current rank','<span title="'+esc(rk.current===null?'':Number(rk.current).toLocaleString('en'))+'">'+sruiCompact(rk.current)+'</span>',rk.peak?'Peak rank: '+sruiCompact(rk.peak.value)+' (GW'+rk.peak.gw+')':'')+
  sruiCard('Total points',p.totalNet===null?sruiNum(p.totalGross):sruiNum(p.totalNet),(p.totalNet===null?'Gross, transfer cost unknown':'Net of '+sruiNum(p.hitsCost)+' transfer cost')+(p.perGwAverage===null?'':' · '+sruiNum(p.perGwAverage,1)+' per GW gross'))+
  sruiCard('Rank changes','<span class="srui-up">'+(rk.greenArrows??'—')+' up</span> · <span class="srui-down">'+(rk.redArrows??'—')+' down</span>','Gameweek-to-gameweek, finished gameweeks')+
  sruiCard('Versus gameweek average','<span class="srui-up">'+p.above+' above</span> · <span class="srui-down">'+p.below+' below</span>',p.equal?p.equal+' equal':'Official average score per gameweek')+'</div>'+(sruiNote(rk)?'<p class="srui-note">'+esc(sruiNote(rk))+'</p>':'');
 const rankChart=sruiLine(rk.journey.map(j=>({x:j.gw,y:j.rank})),{label:'Overall rank by gameweek, lower is better',invert:true,markGw:rk.peak?.gw??null});
 const captainCards=k.scoredGws?'<div class="srui-grid">'+
  sruiCard('Captain points',sruiNum(k.totalPoints),sruiNum(k.averagePoints,1)+' per gameweek, multiplier included')+
  sruiCard('Captain accuracy',sruiNum(k.accuracyPct)+'%',k.optimalHits+' / '+k.scoredGws+' gameweeks the best option')+
  sruiCard('Missed points · hindsight','<span class="srui-down">'+sruiNum(k.missedPoints)+'</span>','Versus the best captain in your squad')+
  sruiCard('Best-case captain points · hindsight','<span class="srui-up">'+sruiNum(k.optimalPoints)+'</span>','Known only after the gameweek')+'</div>':'<p class="muted">No captain data yet.</p>';
 const most=k.mostCaptained.length?'<h3 class="srui-h3">Most captained</h3><ul class="srui-list">'+k.mostCaptained.slice(0,5).map(m=>'<li><span>'+sruiName(m.element)+' <small>'+m.times+'x captained</small></span><strong>'+sruiNum(m.points)+' pts</strong></li>').join('')+'</ul>':'';
 const history=k.perGw.length?'<h3 class="srui-h3">Captain history</h3><div class="srui-history">'+[...k.perGw].reverse().map(g=>{
  const flags=[g.multiplier===3?'Triple Captain':'',g.chosen.viceTakeover?'Vice took over':'',g.chosen.noArmbandPlayer?'Captain and vice did not play':'',g.optimal?'Best option':''].filter(Boolean);
  return '<article class="srui-gw '+(g.optimal?'srui-hit':'srui-miss')+'"><h4>GW '+g.gw+'</h4><p>'+sruiName(g.chosen.element)+': '+g.chosen.rawPoints+' × '+g.multiplier+' = <strong>'+g.chosen.points+'</strong></p>'+(g.optimal?'':'<p class="muted">Best: '+sruiName(g.best.element)+' ('+g.best.rawPoints+' × '+g.multiplier+' = '+g.best.points+')</p>')+(flags.length?'<p class="srui-flags">'+flags.map(f=>'<span class="badge">'+esc(f)+'</span>').join(' ')+'</p>':'')+'</article>';}).join('')+'</div>':'';
 const valueBlock='<div class="srui-grid">'+sruiCard('Team value',sruiMoney(v.total),v.squad===null?'':'Squad '+sruiMoney(v.squad))+sruiCard('Value gained',(v.gained!==null&&v.gained>0?'+':'')+sruiMoney(v.gained),'From the '+sruiMoney(v.initialBudget)+' initial budget')+sruiCard('Peak value',sruiMoney(v.peak),'Highest so far')+sruiCard('In the bank',sruiMoney(v.bank),'Available to spend')+'</div>'+sruiLine(v.series.map(x=>({x:x.gw,y:x.value})),{label:'Team value by gameweek in pounds million',format:x=>'£'+Number(x).toFixed(1)+'m'});
 const table='<details class="srui-details"><summary>Data table</summary><div class="table-wrap"><table><thead><tr><th>GW</th><th>Overall rank</th><th>Points (gross)</th><th>Average</th><th>Value</th></tr></thead><tbody>'+rk.journey.map((j,i)=>'<tr><td>'+j.gw+'</td><td class="numeric">'+(j.rank===null?'—':Number(j.rank).toLocaleString('en'))+'</td><td class="numeric">'+(p.perGw[i].points===null?'—':p.perGw[i].points)+'</td><td class="numeric">'+(p.perGw[i].average===null?'—':p.perGw[i].average)+'</td><td class="numeric">'+(v.series.find(x=>x.gw===j.gw)?sruiMoney(v.series.find(x=>x.gw===j.gw).value):'—')+'</td></tr>').join('')+'</tbody></table></div></details>';
 root.innerHTML=panel('Season review','<p class="muted">Through '+esc(through)+'.'+esc(excluded)+' Official FPL data.</p>'+missing+
  '<h3 class="srui-h3">Season overview</h3>'+overview+'<h3 class="srui-h3">Rank journey</h3>'+rankChart+'<h3 class="srui-h3">Points by gameweek</h3>'+sruiBars(p.perGw)+
  '<h3 class="srui-h3">Captain analysis</h3><p class="srui-note">Hindsight review: the best captain is known only after the gameweek and is not a recommendation. Captain points include the ×2 multiplier, or ×3 with Triple Captain.</p>'+captainCards+most+history+
  '<h3 class="srui-h3">Team value</h3>'+valueBlock+table,'Finished gameweeks','seasonReviewPanel');
}

async function sruiLoad(){
 const entry=state.entry;if(!entry)return;
 const id=entry.id;sruiState.entry=id;sruiState.status='loading';sruiState.progress='Loading season history…';sruiRender();
 try{
  const history=await api('entry/'+id+'/history/');
  if(state.entry?.id!==id)return;
  const events=state.bootstrap?.events||[];
  const finished=new Set(events.filter(e=>e.finished).map(e=>e.id));
  const rows=(history.current||[]).filter(r=>finished.has(r.event));
  const excluded=(history.current||[]).filter(r=>!finished.has(r.event)).map(r=>r.event);
  const gws=rows.map(r=>r.event);
  const picksByGw={},liveByGw={};let done=0;
  await mapLimited(gws,3,async gw=>{
   const [picks,live]=await Promise.all([api('entry/'+id+'/event/'+gw+'/picks/').catch(()=>null),api('event/'+gw+'/live/').catch(()=>null)]);
   if(picks)picksByGw[gw]=picks;
   if(live)liveByGw[gw]={elements:(live.elements||[]).map(e=>({id:e.id,stats:{minutes:e.stats?.minutes,total_points:e.stats?.total_points}}))}; // keep only what the review needs
   done++;sruiState.progress='Loaded '+done+' of '+gws.length+' gameweeks…';if(state.entry?.id===id&&sruiState.status==='loading')sruiRender();
  });
  if(state.entry?.id!==id)return;
  sruiState.review=buildSeasonReview({history:{current:rows},picksByGw,liveByGw,events});
  sruiState.excluded=excluded;sruiState.status=sruiState.review.status==='empty'?'error':'ready';
  if(sruiState.status==='error')sruiState.error='No finished gameweek is available for this team yet.';
 }catch(error){if(state.entry?.id!==id)return;sruiState.status='error';sruiState.error='Season review could not be loaded: '+(error&&error.message||'unknown error');}
 sruiRender();
}

function sruiEnsure(){
 const tim=document.getElementById('view-tim');if(!tim)return;
 if(!document.getElementById('seasonReview')){const el=document.createElement('div');el.id='seasonReview';el.className='srui';tim.appendChild(el);}
 if(sruiState.entry!==(state.entry?.id??null)){sruiState.entry=state.entry?.id??null;sruiState.status='idle';sruiState.review=null;sruiState.excluded=[];}
 sruiRender();
}
document.addEventListener('click',event=>{if(event.target.closest?.('#seasonReviewLoad'))sruiLoad();});
(()=>{const original=renderStats;renderStats=function(){const result=original.apply(this,arguments);try{sruiEnsure();}catch{}return result;};})();
