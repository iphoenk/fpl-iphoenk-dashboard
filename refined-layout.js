// Shared connection gate; the original form keeps its validation and fetch handler.
document.querySelector('.brand strong').textContent='FPL iphoenk';
document.querySelector('.brand small').textContent='Your team. Your edge.';
document.querySelector('.side-label')?.remove();
const primaryViews=[['dashboard','Overview'],['tim','My Team'],['transfers','Transfers'],['fixtures','Fixtures'],['liga','Mini League'],['labs','Scout'],['watchlist','Watchlist']];
const nav=document.querySelector('.nav'),navButtons=[...nav.querySelectorAll('[data-view]')];
nav.replaceChildren();
for(const [view,label] of primaryViews){const b=navButtons.find(b=>b.dataset.view===view);b.querySelector('.nav-label').textContent=label;b.setAttribute('aria-label',label);nav.append(b);}
const advancedMenu=document.createElement('details');advancedMenu.className='advanced-menu';advancedMenu.innerHTML='<summary>More tools</summary>';
navButtons.filter(b=>!primaryViews.some(([v])=>v===b.dataset.view)).forEach(b=>advancedMenu.append(b));nav.append(advancedMenu);
const bottomNav=document.createElement('nav');bottomNav.className='mobile-bottom-nav';bottomNav.setAttribute('aria-label','Mobile navigation');
bottomNav.innerHTML=[['dashboard','Overview','i-grid'],['tim','My Team','i-shirt'],['transfers','Transfers','i-compare'],['liga','League','i-cup'],['more','More','i-scout']].map(([view,label,icon])=>'<button type="button" data-mobile-view="'+view+'"><svg class="icon"><use href="#'+icon+'"/></svg><span>'+label+'</span></button>').join('');document.body.append(bottomNav);
const moreBackdrop=document.createElement('div');moreBackdrop.className='mobile-more-backdrop hidden';moreBackdrop.setAttribute('aria-hidden','true');document.body.append(moreBackdrop);
const moreSheet=document.createElement('section');moreSheet.className='mobile-more hidden';moreSheet.setAttribute('role','dialog');moreSheet.setAttribute('aria-modal','true');moreSheet.setAttribute('aria-labelledby','moreToolsTitle');moreSheet.setAttribute('aria-hidden','true');
moreSheet.innerHTML='<div class="more-head"><div><h2 id="moreToolsTitle">More tools</h2><p>Explore your FPL insights</p></div><button type="button" class="btn more-close" id="closeMore" aria-label="Close tools">Close ✕</button></div>'+primaryViews.filter(([v])=>['fixtures','labs','watchlist'].includes(v)).map(([v,l])=>'<button type="button" class="btn" data-goto="'+v+'">'+l+'</button>').join('')+navButtons.filter(b=>!primaryViews.some(([v])=>v===b.dataset.view)).map(b=>'<button type="button" class="btn" data-goto="'+b.dataset.view+'">'+esc(b.textContent.trim())+'</button>').join('');document.body.append(moreSheet);
function setMoreOpen(open){
 const active=Boolean(open&&state.entry),trigger=bottomNav.querySelector('[data-mobile-view="more"]');
 moreSheet.classList.toggle('hidden',!active);moreBackdrop.classList.toggle('hidden',!active);
 moreSheet.setAttribute('aria-hidden',String(!active));trigger?.setAttribute('aria-expanded',String(active));
 document.body.classList.toggle('more-sheet-open',active);
 if(active)$('closeMore').focus({preventScroll:true});else if(moreSheet.contains(document.activeElement))trigger?.focus({preventScroll:true});
}
$('closeMore').onclick=()=>setMoreOpen(false);moreBackdrop.onclick=()=>setMoreOpen(false);
document.addEventListener('keydown',e=>{
 if(moreSheet.classList.contains('hidden'))return;
 if(e.key==='Escape'){e.preventDefault();setMoreOpen(false);return;}
 if(e.key!=='Tab')return;
 const buttons=[...moreSheet.querySelectorAll('button:not([disabled])')],first=buttons[0],last=buttons.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
const connection=document.createElement('section');connection.id='connectionGate';connection.className='connection-gate';connection.setAttribute('role','dialog');connection.setAttribute('aria-modal','true');connection.setAttribute('aria-label','Hubungkan tim FPL');
connection.innerHTML='<div class="connection-brand">FPL <b>iphoenk</b><small>Your team. Your edge.</small></div><div class="connection-card"><button class="connection-close hidden" id="closeConnection" aria-label="Tutup">×</button><div class="connection-shirt"><svg class="icon"><use href="#i-shirt"/></svg></div><h1>Tim kamu.<br>Insight yang lebih tajam.</h1><p>Hubungkan tim FPL untuk melihat squad, mini league, dan berita pemain pilihanmu.</p><div id="connectionFormHost"></div><div id="connectionFeedback" role="status" aria-live="polite"></div><small class="connection-privacy">Tanpa password FPL · Tim disimpan di browser ini</small></div>';
document.body.append(connection);$('connectionFormHost').append(entryFormNode,helpBoxNode);entryFormNode.querySelector('.entry-copy')?.remove();$('entrySubmit').textContent='Tampilkan tim saya →';$('helpButton').textContent='Cara menemukan Entry ID';helpBoxNode.innerHTML='<strong>Cara menemukan Entry ID</strong><ol><li>Buka situs Fantasy Premier League dan pilih <b>Points</b>.</li><li>Salin URL tim dari address bar.</li><li>Tempel URL atau angka setelah <b>/entry/</b> ke kolom di atas.</li></ol><p>Contoh: …/entry/<b>1234567</b>/event/8 → ID <b>1234567</b></p>';
function openConnection(){connection.classList.remove('hidden');document.body.classList.add('connecting-team');$('closeConnection').classList.toggle('hidden',!state.entry);document.querySelector('.shell').inert=true;bottomNav.inert=true;if(state.entry)setTimeout(()=>$('entryInput').focus(),0);}
function closeConnection(){if(!state.entry)return;connection.classList.add('hidden');document.body.classList.remove('connecting-team');document.querySelector('.shell').inert=false;bottomNav.inert=false;}
$('closeConnection').onclick=closeConnection;
connection.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.entry)closeConnection();if(e.key==='Tab'){const nodes=[...connection.querySelectorAll('button,input,a')].filter(n=>!n.disabled&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}});
entryFormNode.onsubmit=async function(e){e.preventDefault();state.manualEntryAttempt=true;const id=entryId($('entryInput').value);if(!id){$('connectionFeedback').textContent='Masukkan Entry ID atau URL tim FPL yang valid.';return;}$('connectionFeedback').textContent='Menghubungkan tim…';$('entrySubmit').disabled=true;try{if(!state.bootstrap)await loadBase();await loadTeam(id,state.gw,{visit:false});if(String(state.entry?.id)===String(id))closeConnection();}catch(error){$('connectionFeedback').textContent=error.message+' Tekan Tampilkan tim saya untuk mencoba lagi.';}finally{$('entrySubmit').disabled=false;$('entrySubmit').textContent='Tampilkan tim saya →';}};
const originalAlertForConnection=alertMessage;alertMessage=function(message){originalAlertForConnection(message);if(!connection.classList.contains('hidden'))$('connectionFeedback').textContent=message;};
const oldTeamContext=updateTeamContext;updateTeamContext=function(){oldTeamContext();if(state.entry){document.body.classList.add('has-team');$('closeConnection').classList.remove('hidden');}document.querySelectorAll('[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===state.view));};
const heroBeforeRefinement=updateDashboardHero;updateDashboardHero=function(){heroBeforeRefinement();document.querySelector('.hero-kicker').innerHTML='YOUR TEAM · GAMEWEEK '+(state.gw||'—');$('dashboardConnect').classList.add('hidden');$('editDashboardTeam').onclick=openConnection;const metrics=$('dashboardHeroStats').children;[4,5].forEach(i=>metrics[i]?.classList.add('secondary-metric'));if(state.picks)$('dashboardPlaying').innerHTML='<span>Bank '+money(state.picks.entry_history.bank)+' · '+currentSquad().filter(p=>p.status!=='a').length+' players flagged</span>';};
renderDashboardOverview=function(){
 if(!$('dashboardOverview'))return;
 // The decision-first card above owns the ONLY current XI + four-player bench.
 // This secondary Overview area adds distinct scouting and fixture analytics.
 const scouting=typeof dashboardPositionCards==='function'?dashboardPositionCards():'';
 const fixtures=typeof dashboardFixtureRuns==='function'?dashboardFixtureRuns():'';
 $('dashboardOverview').innerHTML=scouting+fixtures;

};
function personalizedNews(){const own=ownIds(),watch=new Set(ext.watch),trending=new Set([...allPlayers()].sort((a,b)=>(Number(b.transfers_in_event)||0)-(Number(a.transfers_in_event)||0)).slice(0,20).map(p=>p.id));const filter=ext.playerNewsFilter||'For You';const matches=id=>filter==='Squad'?own.has(id):filter==='Watchlist'?watch.has(id):filter==='Trending'?trending.has(id):own.has(id)||watch.has(id)||trending.has(id);const category=id=>own.has(id)?'MY SQUAD':watch.has(id)?'WATCHLIST':'TRENDING';const priority=id=>own.has(id)?0:watch.has(id)?1:2;
 const articleItems=(ext.news?.articles||[]).map(a=>{const players=(a.players||[]).filter(p=>state.players[p.element]?.web_name===p.web_name&&matches(p.element)).sort((a,b)=>priority(a.element)-priority(b.element));if(!players.length)return null;const ids=players.map(p=>p.element),id=ids.sort((a,b)=>priority(a)-priority(b))[0];return {key:a.url||a.headline,priority:priority(id),date:a.date||'',html:'<article class="news-rail-item"><span class="news-owned">'+category(id)+'</span><div class="news-player-top">'+players.slice(0,3).map(p=>'<button data-player="'+p.element+'">'+esc(p.web_name)+'</button>').join(' · ')+'</div><h3>'+(/^https:\/\//.test(a.url||'')?'<a target="_blank" rel="noopener" href="'+esc(a.url)+'">'+esc(a.headline)+' ↗</a>':esc(a.headline))+'</h3><small>Guardian · '+esc(a.date||'')+'</small></article>'};}).filter(Boolean);
 const updates=allPlayers().filter(p=>matches(p.id)&&p.news).map(p=>({key:'fpl-'+p.id,priority:priority(p.id),date:p.news_added||'',html:'<article class="news-rail-item"><span class="news-owned">'+category(p.id)+' · FITNESS</span><div class="news-player-top"><button data-player="'+p.id+'">'+esc(p.web_name)+'</button><span class="badge">'+(p.chance_of_playing_next_round==null?'Update':p.chance_of_playing_next_round+'%')+'</span></div><p>'+esc(p.news)+'</p><small>FPL · '+esc(state.teams[p.team]?.short_name)+(p.news_added?' · '+new Date(p.news_added).toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'')+'</small></article>'}));
 const seen=new Set();return [...updates,...articleItems].sort((a,b)=>a.priority-b.priority||b.date.localeCompare(a.date)).filter(a=>{if(seen.has(a.key))return false;seen.add(a.key);return true;}).slice(0,8);
}
renderDashboardNews=function(){if(!$('dashboardNewsContent'))return;document.querySelector('.news-rail-heading').innerHTML='<div><h2>Player News</h2><p>Your players. Your priorities.</p></div>';const filter=ext.playerNewsFilter||'For You',items=personalizedNews();$('dashboardNewsContent').innerHTML='<div class="player-news-filters">'+['For You','Squad','Watchlist','Trending'].map(f=>'<button type="button" data-player-news-filter="'+f+'" class="'+(f===filter?'active':'')+'">'+f+'</button>').join('')+'</div>'+items.map(a=>a.html).join('')+(items.length?'':'<p class="news-rail-status">'+(filter==='Watchlist'&&!ext.watch.length?'Tambahkan pemain ke Watchlist untuk mengikuti kabarnya.':'Belum ada berita relevan'+(ext.newsLoading?' · Headline sedang dimuat.':'.'))+'</p>');document.querySelector('.news-rail-foot').textContent='Squad · Watchlist · Trending berdasarkan transfer masuk GW ini';};
// The classic league selector previously populated on team connect without loading
// its standings. Open League using the team-scoped saved league or first membership.
let leagueFirstOpenPending=null;
function preferredTeamLeague(){
 const leagues=state.entry?.leagues?.classic||[];
 if(!leagues.length)return null;
 const saved=!state.visitingTeam?safeRead('fpl-iphoenk-league-'+state.entry.id,null):null;
 const candidates=[saved,$('leagueSelect')?.value,state.league?.league?.id,leagues[0]?.id];
 return candidates.map(Number).find(id=>Number.isInteger(id)&&id>0&&leagues.some(l=>Number(l.id)===id))||null;
}
function ensureLeagueOnEntry(){
 if(state.view!=='liga'||!state.entry)return;
 const id=preferredTeamLeague(),selector=$('leagueSelect');
 if(!id||!selector)return;
 selector.value=String(id);
 if(Number(state.league?.league?.id)===id)return;
 const key=state.entry.id+':'+id;
 if(leagueFirstOpenPending===key)return;
 leagueFirstOpenPending=key;
 Promise.resolve().then(()=>loadLeague(id,1)).catch(error=>alertMessage(error?.message||'Klasemen belum dapat dimuat.'))
   .finally(()=>{if(leagueFirstOpenPending===key)leagueFirstOpenPending=null;});
}
const connectedLeagueOptions=renderLeagueOptions;renderLeagueOptions=function(){
 connectedLeagueOptions();
 if(state.entry){
  const id=preferredTeamLeague();if(id)$('leagueSelect').value=String(id);
  closeConnection();renderDashboardOverview();ensureLeagueOnEntry();
 }
};
const connectedShowView=showView;showView=function(view){
 connectedShowView(view);setMoreOpen(false);if(!state.entry)openConnection();else ensureLeagueOnEntry();
};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.mobileView){if(b.dataset.mobileView==='more')setMoreOpen(moreSheet.classList.contains('hidden'));else showView(b.dataset.mobileView);}
 if(b.dataset.playerNewsFilter){ext.playerNewsFilter=b.dataset.playerNewsFilter;renderDashboardNews();}
});
teamContext.onclick=()=>{showView('dashboard');openConnection();};$('focusEntry').onclick=openConnection;
document.querySelector('.dashboard-tabs').remove();document.querySelector('.dashboard-section-nav').remove();
openConnection();


const mobileBrand=document.createElement('div');mobileBrand.className='mobile-brand';mobileBrand.innerHTML='<strong>FPL iphoenk</strong><small>Your team. Your edge.</small>';document.querySelector('.topbar').prepend(mobileBrand);

