const sidebarIcons={dashboard:'i-grid',optimal:'i-cup',accuracy:'i-grid',tim:'i-shirt',planning:'i-plan',transfers:'i-compare',fixtures:'i-plan',chips:'i-cup',playercompare:'i-compare',news:'i-scout',watchlist:'i-cup',labs:'i-scout',market:'i-grid',liga:'i-cup',banding:'i-compare',modelinsights:'i-grid'};
for(const button of document.querySelectorAll('.nav [data-view]')){
 const label=button.textContent.trim();button.setAttribute('title',label);button.setAttribute('aria-label',label);
 button.innerHTML='<svg class="icon" fill="none" stroke="currentColor" stroke-width="1.5"><use href="#'+(sidebarIcons[button.dataset.view]||'i-grid')+'"/></svg><span class="nav-label">'+esc(label)+'</span>';
}
const sidebarToggle=document.createElement('button');sidebarToggle.id='sidebarToggle';sidebarToggle.className='sidebar-toggle';sidebarToggle.type='button';
document.querySelector('.sidebar').insertBefore(sidebarToggle,document.querySelector('.brand'));
function applySidebar(){const collapsed=!!safeRead('fpl-sidebar-collapsed',false);document.body.classList.toggle('sidebar-collapsed',collapsed);sidebarToggle.setAttribute('aria-expanded',String(!collapsed));sidebarToggle.setAttribute('aria-label',collapsed?'Perbesar sidebar':'Kecilkan sidebar');sidebarToggle.title=collapsed?'Perbesar sidebar':'Kecilkan sidebar';sidebarToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 6 8 12 14 18"/></svg>';}
sidebarToggle.onclick=()=>{safeWrite('fpl-sidebar-collapsed',!document.body.classList.contains('sidebar-collapsed'));applySidebar();};applySidebar();
const teamContext=document.createElement('button');teamContext.type='button';teamContext.id='activeTeamContext';teamContext.className='team-context';teamContext.dataset.goto='dashboard';document.querySelector('.top-actions').prepend(teamContext);
const entryFormNode=$('entryForm'),helpBoxNode=$('helpBox');
const dashboardViewBeforeLayout=showView;
showView=function(view){dashboardViewBeforeLayout(view);document.body.dataset.view=state.view;updateTeamContext();};
function updateTeamContext(){teamContext.textContent=state.entry?state.entry.name:'Connect team';teamContext.title=state.entry?'Entry '+state.entry.id+' · ganti tim di Dashboard':'Enter an Entry ID on the Dashboard';teamContext.setAttribute('aria-label',state.entry?'Tim aktif: '+state.entry.name+'. Buka dashboard untuk ganti tim.':'Connect team di Dashboard');}
function dashboardShell(){
 if($('dashboardLayout'))return;
 const root=$('view-dashboard');root.innerHTML='<div id="dashboardLayout"><section class="team-hero"><div class="team-hero-top"><div><div class="hero-kicker">FPL iphoenk <span>YOUR FPL COMMAND CENTRE</span></div><h1 id="dashboardTeamName">Your team. Your next move.</h1><p id="dashboardManager" class="hero-manager">One Entry ID keeps every analysis aligned with your team.</p></div><button class="hero-edit" id="editDashboardTeam" type="button">Change team ↗</button></div><div id="dashboardConnect" class="dashboard-connect"></div><div id="dashboardPlaying" class="hero-playing"></div><div id="dashboardHeroStats" class="hero-stats"></div></section><nav class="dashboard-tabs" aria-label="Analisis tim"><button class="active" data-goto="dashboard">Overview</button><button data-goto="tim">Squad</button><button data-goto="planning">Planning</button><button data-goto="liga">Mini-league</button><button data-goto="labs">Scout</button></nav><div class="dashboard-columns"><div class="dashboard-main"><div class="dashboard-section-nav"><button class="active" data-dashboard-jump="dashboardWorth">Worth a look</button><button data-dashboard-jump="dashboardRuns">Fixture runs</button><button data-dashboard-jump="dashboardPool">Explore the pool</button></div><div id="dashboardOverview"></div><details id="dashboardPool" class="panel dashboard-pool"><summary><span>EXPLORE THE POOL</span><small>All-player predictions, model selection and watchlist</small><span class="pool-chevron">⌄</span></summary><div class="panel-body" id="dashboardPredictions"></div></details></div><aside class="dashboard-news"><div class="news-rail-heading"><div><span class="eyebrow">THE LATEST</span><h2>News & updates</h2></div><span class="news-live-dot" title="Public FPL data"></span></div><div id="dashboardNewsContent"></div><button class="btn news-all" data-goto="news">All news and sentiment ↗</button><div class="news-rail-foot">FPL availability · Guardian via FPL iphoenk</div></aside></div></div>';
 $('dashboardConnect').append(entryFormNode,helpBoxNode);
 $('editDashboardTeam').onclick=()=>{ext.entryEditing=!ext.entryEditing;updateDashboardHero();if(ext.entryEditing)$('entryInput').focus();};
}
function heroMetric(label,value,description,accent=false){return '<article class="hero-stat'+(accent?' accent':'')+'"><span>'+esc(label)+'</span><strong>'+value+'</strong><small>'+esc(description)+'</small></article>';}
function updateDashboardHero(){
 dashboardShell();updateTeamContext();const entry=state.entry,h=state.picks?.entry_history,event=state.bootstrap?.events.find(e=>e.id===state.gw);
 $('dashboardTeamName').textContent=entry?.name||'Your team. Your next move.';
 const league=state.league?.league||entry?.leagues?.classic?.find(l=>l.league_type==='x')||null;
 $('dashboardManager').textContent=entry?[entry.player_first_name+' '+entry.player_last_name,'FPL ID: '+entry.id].filter(Boolean).join(' · '):'Masukkan Entry ID satu kali. Squad, Planning, Mini-league, dan Scout langsung mengikuti.';
 const connectOpen=!entry||!!ext.entryEditing;$('dashboardConnect').classList.toggle('hidden',!connectOpen);$('editDashboardTeam').classList.toggle('hidden',!entry);$('editDashboardTeam').textContent=connectOpen?'Tutup':'Change team ↗';
 const starting=state.picks?.picks.filter(p=>p.position<=11).map(p=>state.players[p.element]).filter(Boolean)||[],squad=currentSquad();
 const unfinishedTeams=new Set(state.fixtures.filter(f=>f.event===state.gw&&!f.finished).flatMap(f=>[f.team_h,f.team_a]));const pending=starting.filter(p=>unfinishedTeams.has(p.team));
 $('dashboardPlaying').innerHTML=entry?(pending.length?'<strong>'+pending.length+' masih memiliki pertandingan</strong> — '+esc(pending.slice(0,3).map(p=>p.web_name).join(', '))+(pending.length>3?'…':''): '<strong>Gameweek '+state.gw+'</strong> · '+(event?.finished?'Semua pertandingan telah selesai.':'Poin dan bonus mengikuti pembaruan FPL.')):'<strong>Start with your team.</strong> Tidak perlu login akun FPL.';
 const record=state.league?.standings?.results.find(r=>r.entry===entry?.id),leagueEntry=entry?.leagues?.classic?.find(l=>l.id===league?.id),rank=record?.rank??leagueEntry?.entry_rank;const size=state.league&&!state.league.standings.has_next&&state.leaguePage===1?state.league.standings.results.length:null;
 const projected=starting.length?teamPrediction(starting,1):null,flagged=squad.filter(p=>p.status!=='a').length;
 $('dashboardHeroStats').innerHTML=heroMetric('GAMEWEEK',fmt(h?.points),'GW'+(state.gw||'—')+' · '+fmt(event?.average_entry_score)+' average',true)+heroMetric('TOTAL',fmt(entry?.summary_overall_points),'Rank '+fmt(entry?.summary_overall_rank))+heroMetric('LEAGUE',rank?fmt(rank)+(size?'<em>/'+size+'</em>':''):'—',league?.name||'Pilih liga di Mini-league')+heroMetric('PROJECTED',fmt(projected,1),'Your XI · GW'+(state.next?.id||'—'))+heroMetric('NEEDS A LOOK',entry?fmt(flagged):'—',entry?(flagged?'Periksa status kebugaran':'Nobody flagged'):'Menunggu tim',true)+heroMetric('IN THE BANK',h?money(h.bank):'—','Saldo publik GW'+(state.gw||'—'));
}
function dashboardPositionCards(){
 const pos=['GK','DEF','MID','FWD'].includes(ext.dashboardPosition)?ext.dashboardPosition:'DEF';
 const gk=pos==='GK',defs=pos==='DEF';
 const snapshot=snapshotIsCurrent(ext.snapshot,state.bootstrap?.events,state.next)?ext.snapshot:null;
 // Goalkeepers use public Official FPL bootstrap + fixtures. Other positions
 // retain the gated scouting snapshot; never silently mix model and FPL rows.
 const keeperRows=keeperScoutRows(allPlayers(),state.fixtures,state.teams)
   .filter(r=>state.players[r.id]?.element_type===1&&r.minutes>=180);
 const rows=gk?keeperRows:(snapshot?.scouts?.[pos]?.rows||[])
   .filter(r=>labPlayer(state.players[r.id])&&r.minutes>=180);
 const sort=(key,asc=false)=>[...rows]
   .filter(r=>r[key]!==null&&r[key]!==undefined&&Number.isFinite(Number(r[key])))
   .sort((a,b)=>asc?Number(a[key])-Number(b[key]):Number(b[key])-Number(a[key]))
   .slice(0,6);
 const card=(title,description,key,asc=false,pct=false,cls='')=>{
   const ranked=sort(key,asc);
   return '<article class="adv-card '+cls+'"><h3>'+title+'</h3><p>'+description+'</p>'+
     (ranked.length?ranked.map((r,i)=>'<div class="adv-row"><div><span class="dashboard-rank '+(ownIds().has(r.id)?'mine':'')+'">'+(i+1)+'</span><button data-player="'+r.id+'">'+esc(r.webName)+'</button><small>'+esc(r.teamShort)+'</small></div><strong>'+fmt(Number(r[key])*(pct?100:1),pct?0:2)+(pct?'%':'')+'</strong></div>').join(''):'<p class="muted" style="padding:12px 0">Data tervalidasi belum tersedia.</p>')+'</article>';
 };
 const tabs=[['GK','Goalkeepers'],['DEF','Defenders'],['MID','Midfielders'],['FWD','Forwards']];
 const keeperCount=keeperRows.length;
 const options=tabs.map(([p,label])=>{
  const count=p==='GK'?keeperCount:((snapshot?.scouts?.[p]?.rows||[]).filter(r=>r.minutes>=180&&labPlayer(state.players[r.id])).length);
  return '<button type="button" data-dashboard-position="'+p+'" aria-pressed="'+(pos===p)+'" class="'+(pos===p?'active':'')+'"><span>'+p+'</span><strong>'+label+'</strong><small>'+fmt(count)+'</small></button>';
 }).join('');
 const metrics=gk
   ?card('Save volume','Penyelamatan per 90 menit · minimal 180 menit.','saves90')
     +card('Clean sheets','Total clean sheets musim berjalan.','cleanSheets')
     +card('Concede the least','Expected goals conceded per 90 · lebih rendah lebih baik.','xgc90',true,false,'green')
     +card('Nailed on · historical','Persentase starter terhadap pertandingan klub yang dimulai.','startRate',false,true,'blue')
   :card(defs?'Defensive contribution':'Goal threat',defs?'DefCon hit rate pada pertandingan yang dimainkan.':'Expected goals per 90.',defs?'defconHitRate':'xg90',false,defs)
     +card(defs?'Threat going forward':'Chance creation',defs?'Expected goal involvement per 90.':'Expected assists per 90.',defs?'xgi90':'xa90',false,false,'pink')
     +card('Concede the least','Expected goals conceded per 90, lowest first.','xgc90',true,false,'green')
     +card('Nailed on · historical','Starts as a share of team matches.','startRate',false,true,'blue');
 return '<div class="dashboard-pos-tabs" role="group" aria-label="Filter posisi Worth a look">'+options+'</div>'+
   '<h2 class="adv-section-title" id="dashboardWorth">Worth a look <small>Contributions, threat, solidity, and minutes. Each ranked on its own.</small></h2>'+
   '<details class="overview-methodology"><summary>Sumber & metodologi</summary><div class="overview-methodology-body">'+(gk?sourceNote('GK: saves, clean sheets, dan menit berasal dari Official FPL; minimal 180 menit.'):snapshotNotice())+'</div></details>'+
   panel(pos+' worth a look','<div class="notice">Minimum 180 minutes. Shortlist untuk ditelusuri, bukan jaminan performa.</div><div class="adv-grid two">'+metrics+'</div>');
}
function dashboardFixtureRuns(){if(!snapshotIsCurrent(ext.snapshot,state.bootstrap?.events,state.next))return '<h2 class="adv-section-title" id="dashboardRuns">Fixture runs</h2>'+panel('Fixture runs','<p class="muted">Snapshot jadwal sedang dimuat atau belum sesuai musim dan gameweek aktif.</p>');const rows=(ext.snapshot?.fixtures||[]).map(team=>{const cells=team.cells.filter(c=>c.gw>=state.next?.id&&c.gw<(state.next?.id||0)+6&&state.teams[team.teamId]?.short_name===team.club&&state.fixtures.some(f=>f.event===c.gw&&(c.home?f.team_h===team.teamId&&state.teams[f.team_a]?.short_name===c.opp:f.team_a===team.teamId&&state.teams[f.team_h]?.short_name===c.opp))); return {team,cells,cs:cells.length?cells.reduce((sum,c)=>sum+c.cleanSheetDifficulty,0)/cells.length:null,dc:cells.length?cells.reduce((sum,c)=>sum+c.defconDifficulty,0)/cells.length:null};}).filter(r=>r.cs!==null);
 const column=(title,key)=>'<div><h3>'+title+'</h3>'+[...rows].sort((a,b)=>a[key]-b[key]).slice(0,6).map((r,i)=>'<div class="dashboard-run-row"><span class="dashboard-rank">'+(i+1)+'</span><strong>'+esc(r.team.club)+'</strong><small>'+fmt(r[key],1)+'</small><div>'+r.cells.map(c=>{const d=key==='cs'?c.cleanSheetDifficulty:c.defconDifficulty;return '<span class="fixture fdr'+d+'" title="GW '+c.gw+' · '+(key==='cs'?'Clean sheet':'DefCon')+' difficulty '+d+'">'+esc(c.home?c.opp:c.opp.toLowerCase())+' '+d+'</span>';}).join('')+'</div></div>').join('')+'</div>';
 return '<h2 class="adv-section-title" id="dashboardRuns">Fixture runs <small>Kind runs for clean sheets, and busy ones for defensive contributions.</small></h2>'+panel('Fixture runs','<div class="adv-grid two">'+column('KINDEST FOR CLEAN SHEETS','cs')+column('MOST TO DEFEND AGAINST','dc')+'</div>'+sourceNote('Rating model FPL iphoenk 1–5; lebih rendah lebih mendukung metrik tersebut. Kandang ditulis huruf besar, tandang huruf kecil.'),'Next 6 gameweeks');
}
function renderDashboardOverview(){if(!$('dashboardOverview'))return;$('dashboardOverview').innerHTML=dashboardPositionCards()+dashboardFixtureRuns();}
function renderDashboardNews(){if(!$('dashboardNewsContent'))return;const own=ownIds(),articles=(ext.news?.articles||[]).slice(0,5);const notices=allPlayers().filter(p=>p.news||p.status!=='a').sort((a,b)=>(own.has(b.id)?1:0)-(own.has(a.id)?1:0)||Number(b.selected_by_percent)-Number(a.selected_by_percent)).slice(0,6);
 $('dashboardNewsContent').innerHTML=(articles.length?'<div class="news-rail-label">LATEST HEADLINES</div>'+articles.map(a=>'<article class="news-rail-item"><span class="news-source">THE GUARDIAN</span><h3>'+(/^https:\/\//.test(a.url||'')?'<a href="'+esc(a.url)+'" target="_blank" rel="noopener">'+esc(a.headline)+' ↗</a>':esc(a.headline))+'</h3><small>'+esc(a.date||'')+'</small></article>').join(''):'<div class="news-rail-status">'+(ext.newsLoading?'<span class="loader"></span> Mengambil headline terbaru…':'Headline Guardian belum tersedia. Kabar resmi FPL tampil di bawah.')+'</div>')+'<div class="news-rail-label">PLAYER UPDATES</div>'+notices.map(p=>'<article class="news-rail-item"><div class="news-player-top"><button data-player="'+p.id+'">'+esc(p.web_name)+'</button><span class="badge '+(p.status==='d'?'warn':p.status==='a'?'':'danger')+'">'+(p.status==='a'?'Update':p.chance_of_playing_next_round!=null?p.chance_of_playing_next_round+'%':'Unavailable')+'</span></div>'+(own.has(p.id)?'<span class="news-owned">IN YOUR SQUAD</span>':'')+'<p>'+esc(p.news||'Belum ada rincian kabar dari FPL.')+'</p><small>'+esc(state.teams[p.team]?.short_name)+' · FPL'+(p.news_added?' · '+new Date(p.news_added).toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'')+'</small></article>').join('');
}
const predictionDashboardBeforeLayout=renderPredictionDashboard;
renderPredictionDashboard=function(){dashboardShell();updateDashboardHero();renderDashboardOverview();renderDashboardNews();predictionDashboardBeforeLayout();if(!ext.dashboardSnapshotRequested){ext.dashboardSnapshotRequested=true;loadSnapshot().then(()=>{updateDashboardHero();renderDashboardOverview();}).catch(()=>{ext.dashboardSnapshotRequested=false;});}if(!ext.dashboardNewsRequested){ext.dashboardNewsRequested=true;loadLiveNews();}};
const newsBeforeDashboardLayout=loadLiveNews;
loadLiveNews=async function(){const result=newsBeforeDashboardLayout();renderDashboardNews();await result;renderDashboardNews();};
const heroLeagueOptions=renderLeagueOptions;
renderLeagueOptions=function(){ext.entryEditing=false;heroLeagueOptions();updateTeamContext();if($('dashboardLayout')){updateDashboardHero();renderDashboardNews();}};
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.dashboardPosition){ext.dashboardPosition=b.dataset.dashboardPosition;renderDashboardOverview();}if(b.dataset.dashboardJump){if(b.dataset.dashboardJump==='dashboardPool')$('dashboardPool').open=true;$(b.dataset.dashboardJump)?.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('[data-dashboard-jump]').forEach(x=>x.classList.toggle('active',x===b));}});

dashboardShell();updateTeamContext();

$('focusEntry').onclick=()=>{ext.entryEditing=true;showView('dashboard');dashboardShell();updateDashboardHero();$('entryInput').focus();};
