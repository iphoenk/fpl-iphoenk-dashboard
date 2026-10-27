/* Shared ResearchContext (Scout, Market). Query string carries it; hash keeps the view. */
ext.research=parseResearchContext(location.search);
const RESEARCH_POS_KEY=[null,'GK','DEF','MID','FWD'];
if(ext.research.position){ext.labPos=RESEARCH_POS_KEY[ext.research.position];ext.valuePos=ext.research.position;}
ext.marketTab=['prices','transfers','value'].includes(new URLSearchParams(location.search).get('market'))?new URLSearchParams(location.search).get('market'):'prices';
function syncResearchUrl(){
 try{const q=serializeResearchContext(ext.research);if(ext.marketTab!=='prices')q.set('market',ext.marketTab);const text=q.toString();history.replaceState(null,'',location.pathname+(text?'?'+text:'')+location.hash);}catch{}
}
function researchSet(patch){
 ext.research=normalizeResearchContext({...ext.research,...patch});
 if('position' in patch){ext.valuePos=ext.research.position||'';if(ext.research.position)ext.labPos=RESEARCH_POS_KEY[ext.research.position];}
 syncResearchUrl();
}
function marketSetTab(name,focus=false){
 if(!['prices','transfers','value'].includes(name))return;
 ext.marketTab=name;syncResearchUrl();renderMarket();
 if(focus)document.getElementById('marketTab-'+name)?.focus();
}
document.addEventListener('click',e=>{const t=e.target.closest('[data-market-tab]');if(t)marketSetTab(t.dataset.marketTab);});
document.addEventListener('keydown',e=>{
 const t=e.target.closest?.('[data-market-tab]');if(!t)return;
 const order=['prices','transfers','value'],i=order.indexOf(t.dataset.marketTab);
 const next=e.key==='ArrowRight'?order[(i+1)%3]:e.key==='ArrowLeft'?order[(i+2)%3]:e.key==='Home'?order[0]:e.key==='End'?order[2]:null;
 if(next){e.preventDefault();marketSetTab(next,true);}
});
const researchMine=()=>({owned:ownIds(),watch:ext.watch});
const researchPasses=(minutes,id)=>Number(minutes)>=Math.max(60,ext.research.minMinutes)&&matchesMine(ext.research,id,researchMine());
const researchClubPasses=teamId=>{const r=ext.research;if(!r.ownedOnly&&!r.watchlistOnly)return true;return (r.ownedOnly&&currentSquad().some(p=>p.team===teamId))||(r.watchlistOnly&&ext.watch.some(id=>state.players[id]?.team===teamId));};
const researchFlags=prefix=>'<label class="inline-check"><input id="'+prefix+'Owned" type="checkbox"'+(ext.research.ownedOnly?' checked':'')+'> Owned only</label><label class="inline-check"><input id="'+prefix+'Watch" type="checkbox"'+(ext.research.watchlistOnly?' checked':'')+'> Watchlist only</label>';
const researchPositionSelect=id=>'<label>Position<select id="'+id+'"><option value="">All players</option>'+[1,2,3,4].map(v=>'<option value="'+v+'"'+(ext.research.position===v?' selected':'')+'>'+positions[v]+'</option>').join('')+'</select></label>';
const researchVenueSelect=id=>'<label>Venue<select id="'+id+'">'+[['all','All'],['home','Home only'],['away','Away only']].map(([v,l])=>'<option value="'+v+'"'+(ext.research.venue===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label>';
const researchControls=prefix=>'<label>Minimum minutes<input id="'+prefix+'MinMinutes" type="number" min="0" max="4000" step="90" value="'+ext.research.minMinutes+'"></label>'+researchFlags(prefix);
document.addEventListener('change',e=>{
 const t=e.target;if(!t||!t.id)return;
 if(t.id==='labMinMinutes'||t.id==='valueMinMinutes'||t.id==='compareMinMinutes'){researchSet({minMinutes:t.value});({labs:renderLabs,market:renderMarket,playercompare:renderPlayerCompare})[state.view]?.();}
 else if(/^(lab|value|fixture|news|compare)(Owned|Watch)$/.test(t.id)){
  const [,prefix,flag]=t.id.match(/^(lab|value|fixture|news|compare)(Owned|Watch)$/);
  researchSet(flag==='Owned'?{ownedOnly:t.checked}:{watchlistOnly:t.checked});
  ({lab:renderLabs,value:renderMarket,fixture:renderTicker,news:renderNews,compare:renderPlayerCompare})[prefix]();
 }
 else if(t.id==='valuePosition'){researchSet({position:t.value||null});if(state.view==='market')renderMarket();}
 else if(t.id==='newsPosition'){researchSet({position:t.value||null});renderNews();}
 else if(t.id==='comparePosition'){researchSet({position:t.value||null});renderPlayerCompare();}
 else if(t.id==='compareVenue'){researchSet({venue:t.value});renderPlayerCompare();}
 else if(t.id==='fixtureGwFrom'||t.id==='fixtureGwTo'){
  const from=$('fixtureGwFrom').value,to=$('fixtureGwTo').value;
  if((from==='')!==(to===''))return;   // a range needs both ends; wait until the other is filled
  researchSet({gwFrom:from===''?null:from,gwTo:to===''?null:to});renderTicker();
 }
 else if(t.id==='fixtureVenue'){researchSet({venue:t.value});renderTicker();}
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-lab-pos]');if(b)researchSet({position:RESEARCH_POS_KEY.indexOf(b.dataset.labPos)});});
renderLabs=function(){
 const root=$('view-labs'),pos=ext.labPos||'DEF',gk=pos==='GK',defs=pos==='DEF';
 const mapped=gk?keeperScoutRows(candidatePlayers(),state.fixtures,state.teams).map(r=>({...r,xp:score(state.players[r.id])})):(ext.snapshot?.scouts?.[pos]?.rows||[]).filter(r=>snapshotPlayer(state.players[r.id])&&(ext.showInactive||!isInactivePlayer(state.players[r.id])));
 const query=(ext.labQuery||'').trim().toLowerCase();
 const data=mapped.filter(r=>researchPasses(r.minutes,r.id)&&(ext.labMinStart==null||r.startRate!=null&&r.startRate>=ext.labMinStart)&&(!ext.labClub||r.teamId===Number(ext.labClub))&&(!ext.labMax||r.price<=Number(ext.labMax))&&(!query||r.webName.toLowerCase().includes(query)));
 data.sort((a,b)=>(b.xp??-1)-(a.xp??-1)||a.webName.localeCompare(b.webName));
 const pages=Math.max(1,Math.ceil(data.length/10)),page=Math.max(1,Math.min(ext.labPage||1,pages));ext.labPage=page;
 const xLabel=gk?'Saves per 90':defs?'DefCon hit rate (%)':'xG per 90',yLabel=gk?'Points per game':defs?'xGI per 90':'xA per 90';
 const points=data.map(r=>({id:r.id,name:r.webName,x:gk?r.saves90:defs?r.defconHitRate*100:r.xg90,y:gk?r.pointsPerGame:defs?r.xgi90:r.xa90,r:4+Math.min(10,r.minutes/140),mine:ownIds().has(r.id),label:false})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 const top=(key,desc=true)=>[...mapped].filter(r=>r.minutes>=180&&r[key]!=null).sort((a,b)=>desc?b[key]-a[key]:a[key]-b[key]).slice(0,6);
 const list=(arr,key,pct=false)=>arr.map((r,i)=>'<div class="adv-row"><div><span class="muted">'+(i+1)+'. </span><button data-player="'+r.id+'">'+esc(r.webName)+'</button><small>'+esc(r.teamShort)+'</small></div><strong>'+fmt(r[key]==null?null:r[key]*(pct?100:1),pct?0:2)+(pct&&r[key]!=null?'%':'')+'</strong></div>').join('');
 const card=(title,key,description,asc=false,pct=false)=>'<article class="adv-card"><h3>'+title+'</h3><p>'+description+'</p>'+list(top(key,!asc),key,pct)+'</article>';
 const chart=scatter(points,xLabel,yLabel,{xMax:defs?100:null}).replaceAll('data-player=','data-lab-bubble=');
 root.innerHTML=inactiveToggle()+'<div class="adv-tabs">'+['GK','DEF','MID','FWD'].map(p=>'<button data-lab-pos="'+p+'" class="'+(pos===p?'active':'')+'">'+p+' · '+({GK:'Goalkeepers',DEF:'Defenders',MID:'Midfielders',FWD:'Forwards'}[p])+'</button>').join('')+'</div>'+(gk?sourceNote('Goalkeeper stats: official FPL bootstrap data. Start rate is calculated from starts / club matches that have already started.'):snapshotNotice())+panel(pos+' worth a look','<div class="adv-grid two">'+(gk?card('Save volume','saves90','Saves per 90 · minimum 180 minutes')+card('Clean sheets','cleanSheets','Total clean sheets · minimum 180 minutes'):card(defs?'Defensive contribution':'Goal threat',defs?'defconHitRate':'xg90','Minimum 180 minutes',false,defs)+card(defs?'Threat going forward':'Chance creation',defs?'xgi90':'xa90','Expected contribution per 90'))+card('Concede the least','xgc90','Expected goals conceded per 90 · lower is better',true)+card('Nailed on · historical','startRate','Starts / club matches',false,true)+'</div>')+panel('Explore the pool','<div class="toolbar"><label>Search player<input id="labSearch" type="search" placeholder="Search player name…" value="'+esc(ext.labQuery||'')+'"></label><label>Maximum price (£m)<input id="labMaxPrice" type="number" step=".5" min="3" value="'+esc(ext.labMax||'')+'" placeholder="Any"></label><label>Minimum start rate<select id="labStartRate">'+[['','Any'],['0.4','40%'],['0.6','60%'],['0.8','80%']].map(([v,l])=>'<option value="'+v+'"'+(String(ext.labMinStart??'')===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Team<select id="labClub"><option value="">All</option>'+Object.values(state.teams).map(t=>'<option value="'+t.id+'"'+(String(ext.labClub)===String(t.id)?' selected':'')+'>'+esc(t.short_name)+'</option>').join('')+'</select></label>'+researchControls('lab')+'<span class="badge">'+data.length+' players · minimum '+Math.max(60,ext.research.minMinutes)+' minutes'+(ext.research.ownedOnly?' · owned only':'')+'</span></div><div id="labInteractiveChart">'+chart+'</div><div class="chart-legend"><span>Bubble size: minutes played</span><span>Pink: your squad</span></div><p class="adv-note">Click / tap near a bubble to select a player. Overlapping bubbles will appear as a list. You can also search by name above or click a name in the table.</p><section id="labBubbleChoices" class="lab-bubble-choices" aria-label="Select bubble player" aria-live="polite"><p class="muted">Select a point on the chart to see nearby players.</p></section><div class="table-wrap"><table class="bubble-table"><thead><tr><th>Compare</th><th>Player</th><th>Price</th><th>'+(gk?'Saves/90':'DefCon hit')+'</th><th>'+(gk?'Clean sheets':'xGI/90')+'</th><th>xGC/90</th><th>Start rate</th><th>Min/start</th><th>BPS/90</th><th>xP</th></tr></thead><tbody>'+data.slice((page-1)*10,page*10).map(r=>'<tr><td><input type="checkbox" data-select-player="'+r.id+'" aria-label="Compare '+esc(r.webName)+'"'+(ext.compare.includes(r.id)?' checked':'')+'></td><td><button class="btn small ghost" data-player="'+r.id+'">'+esc(r.webName)+'</button><small class="muted">'+esc(r.teamShort)+'</small></td><td>£'+fmt(r.price,1)+'m</td><td>'+fmt(gk?r.saves90:r.defconHitRate*100,gk?2:0)+(gk?'':'%')+'</td><td>'+fmt(gk?r.cleanSheets:r.xgi90,gk?0:2)+'</td><td>'+fmt(r.xgc90,2)+'</td><td>'+fmt(r.startRate==null?null:r.startRate*100,0)+(r.startRate==null?'':'%')+'</td><td>'+fmt(r.minutesPerStart,0)+'</td><td>'+fmt(r.bps90,1)+'</td><td>'+fmt(r.xp,1)+'</td></tr>').join('')+'</tbody></table></div><div class="pagination"><button class="btn small" aria-label="Previous page" data-lab-page="'+(page-1)+'"'+(page<=1?' disabled':'')+'>← Previous</button><span>'+page+' / '+pages+' · '+Math.min(data.length,(page-1)*10+1)+'–'+Math.min(data.length,page*10)+' of '+data.length+'</span><button class="btn small" aria-label="Next page" data-lab-page="'+(page+1)+'"'+(page>=pages?' disabled':'')+'>Next →</button></div>')+(ext.compare.length?'<div class="sticky-compare"><span>'+ext.compare.length+' / 6 players selected</span><button class="btn small" data-compare-selected="1">Compare players ↗</button></div>':'');
 const rerender=()=>{ext.labPage=1;renderLabs();};
 $('labMaxPrice').onchange=e=>{ext.labMax=e.target.value;rerender();};$('labStartRate').onchange=e=>{ext.labMinStart=e.target.value===''?null:Number(e.target.value);rerender();};$('labClub').onchange=e=>{ext.labClub=e.target.value;rerender();};
 $('labSearch').oninput=e=>{ext.labQuery=e.target.value;const start=e.target.selectionStart;rerender();$('labSearch').focus();$('labSearch').setSelectionRange(start,start);};
 function selectNear(x,y){const circles=[...$('labInteractiveChart').querySelectorAll('circle[data-lab-bubble]')];const near=circles.map(c=>{const b=c.getBoundingClientRect(),distance=Math.hypot(x-b.x-b.width/2,y-b.y-b.height/2);return {circle:c,distance,radius:b.width/2};}).filter(p=>p.distance<=Math.max(24,p.radius+12)).sort((a,b)=>a.distance-b.distance);circles.forEach(c=>c.classList.toggle('lab-selected',near.some(n=>n.circle===c)));const selected=near.map(n=>data.find(p=>p.id===Number(n.circle.dataset.labBubble))).filter(Boolean);$('labBubbleChoices').innerHTML=selected.length?'<h3>'+selected.length+' players in this area</h3><div class="lab-choice-list">'+selected.map(r=>'<button class="btn" data-player="'+r.id+'"><strong>'+esc(r.webName)+'</strong><small>'+esc(r.teamShort)+' · '+esc(xLabel)+' '+fmt(points.find(p=>p.id===r.id)?.x,2)+' · '+esc(yLabel)+' '+fmt(points.find(p=>p.id===r.id)?.y,2)+'</small></button>').join('')+'</div>':'<p class="muted">No bubbles in this area yet. Click closer to a point or search by player name.</p>';}
 $('labInteractiveChart').onclick=e=>selectNear(e.clientX,e.clientY);
 $('labInteractiveChart').onkeydown=e=>{if(!['Enter',' '].includes(e.key)||!e.target.matches('circle[data-lab-bubble]'))return;e.preventDefault();const b=e.target.getBoundingClientRect();selectNear(b.x+b.width/2,b.y+b.height/2);};
};
