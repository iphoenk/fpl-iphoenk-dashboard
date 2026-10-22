function archiveSourceLabel(r){return r.source==='official-fpl'?'Official FPL | ep_next':r.source==='fpl-iphoenk-python-v1'?'FPL iphoenk Python | '+r.model:'FPL iphoenk | '+r.model+' / FPLens';}
function archivePage(r){return Math.min(ext.archivePages?.[r.source]||0,Math.max(0,Math.ceil((r.rows?.length||0)/10)-1));}
const phaseHealth={};let archiveState=null,archiveBusy=false,phaseLoaded=false;
const phaseApiBefore=api;api=async function(path){try{const data=await phaseApiBefore(path);phaseHealth[path]={receivedAt:Date.now(),error:false};renderPhaseQuality();return data;}catch(error){phaseHealth[path]={receivedAt:phaseHealth[path]?.receivedAt,error:true};renderPhaseQuality();throw error;}};
const qualityPanel=document.createElement('details');qualityPanel.className='phase-quality';overviewSwitch.after(qualityPanel);const overviewControls=document.createElement("div");overviewControls.className="overview-controls";overviewSwitch.before(overviewControls);overviewControls.append(overviewSwitch,qualityPanel);
function renderPhaseQuality(){
 const players=allPlayers(),matched=players.filter(p=>xp(p)!==null).length,modelHealth=sourceQuality({receivedAt:state.manifest?.generated_at,maxAge:86400000,matched,total:players.length,invalid:!!state.manifest&&(!state.next||state.manifest.gameweek!==state.next.id||Date.parse(state.manifest.deadline)!==Date.parse(state.next.deadline_time))});
 const facts=[['Official FPL · players',phaseHealth['bootstrap-static/']],['Official FPL · fixture',phaseHealth['fixtures/']]].map(([name,s])=>({name,health:s?.error?{status:'unavailable'}:sourceQuality(s),time:s?.receivedAt,checked:true}));
 facts.push({name:'Prediction · '+providerModelLabel(),health:modelHealth,time:Date.parse(state.manifest?.generated_at),checked:false});
 const labels={fresh:'Available',partial:'Partial coverage',stale:'Needs refresh',invalid:'Mismatch',unavailable:'Not yet available'},issues=facts.filter(f=>f.health.status!=='fresh').length;
 qualityPanel.innerHTML='<summary><span><strong>Data quality</strong><span class="quality-sep"> · </span><em class="quality-status">'+(issues?issues+(issues===1?' source needs review':' sources need review'):'Primary sources available')+'</em></span><span aria-hidden="true">⌄</span></summary><div class="phase-quality-body">'+facts.map(f=>'<div><strong>'+esc(f.name)+'</strong><span class="quality-state '+f.health.status+'">'+labels[f.health.status]+'</span><small>'+(f.time?esc((f.checked?'Checked ':'Published ')+dashboardDate(f.time)):'Time not yet available')+(f.health.total?' · '+f.health.matched+'/'+f.health.total+' players matched':'')+'</small></div>').join('')+'<p>This status separates the FPL check time from the prediction publish time. Missing coverage is not filled with zero. V6/V12 sources are not yet connected.</p><button class="btn small" data-goto="accuracy">View prediction archive →</button></div>';
}
async function loadForecastArchive(capture=false,gw=null){
 if(archiveBusy)return;archiveBusy=true;
 try{
  if(capture){const saved=await fetch('/api/forecast-archive',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(90000)});if(!saved.ok&&saved.status!==503)throw new Error('Capture unavailable');}
  const r=await fetch('/api/forecast-archive'+(gw?'?gw='+gw:''),{signal:AbortSignal.timeout(90000)});archiveState=await r.json();if(!r.ok)archiveState.status='unavailable';
 }catch{archiveState={status:'unavailable'};}finally{archiveBusy=false;renderForecastArchive();}
}
function renderForecastArchive(){
 const root=$('forecastArchivePanel');if(!root)return;
 if(!archiveState){root.innerHTML=panel('Dashboard prediction archive','<p class="adv-note">Checking private storage…</p>');return;}
 const data=archiveState,results=data.results||[],gws=[...new Set((data.archives||[]).map(a=>a.gw))].sort((a,b)=>b-a);
 const summary=data.status!=='ready'?'<div class="notice">Archive not yet accessible. The source evaluation below remains available.</div>':!gws.length?'<div class="notice">No snapshot before the deadline yet. The archive starts from the first recording; earlier GWs are not backfilled.</div>':'<div class="archive-results">'+results.map(r=>'<article class="archive-result"><h3>'+esc(archiveSourceLabel(r))+'</h3><p>Recorded '+esc(dashboardDate(Date.parse(r.captured_at)))+' · deadline '+esc(dashboardDate(Date.parse(r.deadline)))+'</p><p>Snapshot coverage · GW'+data.gameweek+' · '+r.coverage+'/'+r.universe+' players · '+(r.status==='pending'?'Awaiting final result':r.status==='partial'?'Actual results not yet complete':'Final result')+(r.mae!=null?' · MAE '+fmt(r.mae,3):'')+'</p>'+(r.by_position?'<p class="adv-note">'+Object.entries(r.by_position).map(([pos,m])=>esc(positions[pos])+': '+m.count+'/'+m.coverage+' scored'+(m.mae!=null?' | MAE '+fmt(m.mae,3):'')).join(' | ')+'</p>':'')+'<details><summary>Snapshot proof</summary><p class="archive-hash">SHA-256: '+esc(r.sha256)+'</p></details>'+(r.rows?.length?'<details open><summary>Predictions and results · '+r.count+' players scored</summary><div class="table-wrap"><table><thead><tr><th>Player</th><th>Predicted</th><th>Actual</th><th>Minutes</th></tr></thead><tbody>'+r.rows.slice(archivePage(r)*10,(archivePage(r)+1)*10).map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+fmt(p.predicted,2)+'</td><td>'+fmt(p.actual)+'</td><td>'+fmt(p.minutes)+'</td></tr>').join('')+'</tbody></table></div><div class="archive-pages"><button class="btn small" data-archive-source="'+r.source+'" data-archive-page="-1"'+(!(archivePage(r)>0)?' disabled':'')+'>Previous</button><span>'+((archivePage(r))+1)+' / '+Math.ceil(r.rows.length/10)+'</span><button class="btn small" data-archive-source="'+r.source+'" data-archive-page="1"'+(((archivePage(r))+1)*10>=r.rows.length?' disabled':'')+'>Next</button></div></details>':'')+'</article>').join('')+'</div>';
 root.innerHTML=panel('Dashboard prediction archive','<p class="adv-note">Private snapshot, recorded server-side before the deadline and never overwritten. Not yet using V6/V12. Capture happens when Overview is opened or the button below is pressed; there is no new automatic schedule.</p><div class="archive-toolbar">'+(gws.length?'<label>Gameweek <select id="archiveGw">'+gws.map(g=>'<option value="'+g+'"'+(g===data.gameweek?' selected':'')+'>GW'+g+'</option>').join('')+'</select></label>':'')+'<button class="btn small" id="captureForecast"'+(archiveBusy?' disabled':'')+'>Record next GW prediction</button></div>'+summary,'This internal archive is separate from the public source evaluation below.');
 $('captureForecast').onclick=()=>{if(archiveBusy)return;$('captureForecast').disabled=true;$('captureForecast').textContent='Recording…';loadForecastArchive(true);};if($('archiveGw'))$('archiveGw').onchange=e=>{ext.archivePages={};loadForecastArchive(false,Number(e.target.value));};
}
const phaseAccuracyBefore=renderAccuracy;renderAccuracy=async function(){try{await phaseAccuracyBefore();}catch{$('view-accuracy').innerHTML='<div class="notice">Source evaluation not yet available; the dashboard archive is checked separately.</div>';}const node=document.createElement('section');node.id='forecastArchivePanel';$('view-accuracy').prepend(node);renderForecastArchive();loadForecastArchive();};
const phaseOverviewBefore=renderDashboardOverview;renderDashboardOverview=function(){phaseOverviewBefore();renderPhaseQuality();if(!phaseLoaded&&state.bootstrap){phaseLoaded=true;loadForecastArchive(true);}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-archive-page]');if(!b)return;ext.archivePages=ext.archivePages||{};const key=b.dataset.archiveSource;ext.archivePages[key]=Math.max(0,(ext.archivePages[key]||0)+Number(b.dataset.archivePage));renderForecastArchive();});
function newsTopic(h){
 const t=String(h||'').toLowerCase();
 if(/injur|doubt|fitness|ruled out|knock|setback|sidelined|miss(es|ing)?\b|absent|illness|suspen/.test(t))return {k:'fit',l:'Fitness news'};
 if(/return|back in|available|recover|cleared|fit again/.test(t))return {k:'back',l:'Return-to-play news'};
 if(/squad|called up|call-up|named in|international/.test(t))return {k:'squad',l:'Squad/international call-up'};
 if(/rest|rotat|bench|start|line-?up|team news|xi\b|drop/.test(t))return {k:'xi',l:'Lineup/rotation news'};
 if(/transfer|sign|deal|loan|contract|bid/.test(t))return {k:'tr',l:'Transfer news'};
 if(/goal|score|assist|hat-?trick|win|clean sheet|praise|shine|brace/.test(t))return {k:'perf',l:'Player performance'};
 return {k:'gen',l:'Player news'};
}
function fplFacts(item,context){
 const st={a:'Available',d:'Doubtful',i:'Injured',s:'Suspended',u:'Unavailable',n:'Inactive'},topic=newsTopic(item.article?.headline),ps=(item.players||[]).slice(0,3);
 const names=ps.map(p=>esc(p.web_name)+' ('+esc(state.teams[p.team]?.short_name||'?')+')').join(', ')||'related players';
 const own=ps.filter(p=>context?.own?.has(p.id)),flagged=ps.filter(p=>p.status&&p.status!=='a');
 const lines=[topic.l+' for '+names+(own.length?' — including players in your squad':'')+'.'];
 ps.forEach(p=>{const bits=[st[p.status]||'status unclear'];if(p.chance_of_playing_next_round!=null)bits.push(fmt(p.chance_of_playing_next_round)+'% chance of playing');if(p.news)bits.push(esc(p.news));if(Number.isFinite(Number(p.form)))bits.push('form '+fmt(p.form,1));if(Number.isFinite(Number(p.selected_by_percent)))bits.push('owned by '+fmt(p.selected_by_percent,1)+'%');lines.push('<strong>'+esc(p.web_name)+'</strong> in FPL: '+bits.join(' · ')+'.');});
 const advice=topic.k==='fit'?(flagged.length?'FPL has already flagged this; watch for updates before the deadline.':'FPL has not flagged this yet; verify the news before setting your XI and captain.'):topic.k==='back'?'Check the official chance of playing before including them in your XI.':topic.k==='xi'?'Rotation can affect playing time; check the official lineup close to kick-off.':topic.k==='tr'?'No FPL impact until the player features; watch their minutes.':topic.k==='perf'?'Past performance; future value still depends on fixtures and playing time.':'Watch the impact on playing time and fixtures.';
 lines.push('<em>FPL impact:</em> '+advice);
 return lines.join('<br>')+'<br><small>Automatic summary from the headline and Official FPL data; open the source for full content.</small>';
}
// Headline expands inline; only the source opens the original publisher.
const phaseNewsArticleBefore=dashboardNewsArticle;dashboardNewsArticle=function(item,context){
 const html=phaseNewsArticleBefore(item,context);if(item.kind!=='article')return html;
 const article=item.article,href=/^https:\/\//.test(article.url||'')?article.url:null;
 const snippet=String(article.summary||article.snippet||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const content='<details class="inline-news-details"><summary>'+esc(article.headline)+'</summary><div class="news-summary">'+fplFacts(item,context)+'</div></details>';
 return html.replace(/<h3>[\s\S]*?<\/h3>/,content).replace('<small>'+esc(article.source||'The Guardian'),'<small>'+(href?'<a class="news-source-link" href="'+esc(href)+'" target="_blank" rel="noopener">'+esc(article.source||'The Guardian')+' ↗</a>':esc(article.source||'The Guardian')));
};
renderPhaseQuality();renderDashboardNews();
const heroValue=document.createElement('aside');heroValue.className='hero-team-value';heroValue.setAttribute('aria-label','Squad market value');document.querySelector('.team-hero-top').append(heroValue);
function renderHeroValue(){const squad=currentSquad(),complete=squad.length===15&&squad.every(p=>Number.isFinite(Number(p.now_cost))),total=complete?squad.reduce((n,p)=>n+Number(p.now_cost),0):null;heroValue.innerHTML='<div><span>SQUAD MARKET VALUE</span><strong>'+ (total==null?'—':money(total))+'</strong></div><div><span>PUBLIC BANK · GW'+(state.gw||'—')+'</span><strong>'+ (state.picks?.entry_history?.bank==null?'—':money(state.picks.entry_history.bank))+'</strong></div><small>FPL price at time of check · not the actual sale value</small>';}
const valueHeroBefore=updateDashboardHero;updateDashboardHero=function(){valueHeroBefore();renderHeroValue();};renderHeroValue();
