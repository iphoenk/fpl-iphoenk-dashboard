// Approved header and dashboard composition; all values remain sourced from FPL.
const approvedLogo='/*__APPROVED_LOGO__*/';
const approvedHeader=document.createElement('header');approvedHeader.className='approved-header';
approvedHeader.innerHTML='<div class="approved-header-inner"><a href="#dashboard" class="approved-brand" aria-label="FPL iphoenk home"><img src="'+approvedLogo+'" alt="FPL iphoenk — Your team. Your edge." width="230" height="82"></a><nav class="approved-navigation" aria-label="Primary navigation">'+[['dashboard','Overview'],['tim','My Team'],['planning','Planning'],['liga','Leagues'],['labs','Scout']].map(([view,label])=>'<button type="button" data-view="'+view+'">'+label+'</button>').join('')+'<details class="approved-more"><summary>More</summary><div>'+navButtons.filter(b=>!['dashboard','tim','planning','liga','labs'].includes(b.dataset.view)).map(b=>'<button type="button" data-view="'+b.dataset.view+'">'+esc(b.textContent.trim())+'</button>').join('')+'</div></details></nav></div>';
document.querySelector('.shell').before(approvedHeader);
document.querySelector('.connection-brand').innerHTML='<img src="'+approvedLogo+'" alt="FPL iphoenk — Your team. Your edge." width="260" height="93">';
const newsRail=document.querySelector('.dashboard-news'),newsPanel=document.createElement('section');newsPanel.className='approved-news-panel';
while(newsRail.firstChild)newsPanel.append(newsRail.firstChild);newsRail.append(newsPanel);
const summaryPanel=document.createElement('section');summaryPanel.id='approvedGameweekSummary';summaryPanel.className='panel approved-summary';newsRail.prepend(summaryPanel);
const approvedTabs=document.createElement('nav');approvedTabs.className='approved-local-tabs';approvedTabs.setAttribute('aria-label','Dashboard sections');approvedTabs.innerHTML='<button type="button" class="active" data-approved-section="squad">Squad</button><button type="button" data-approved-section="summary">Summary</button><button type="button" data-goto="transfers">Transfers</button><button type="button" data-goto="fixtures">Fixtures</button>';
document.querySelector('.dashboard-columns').before(approvedTabs);
function approvedTeamMetrics(){
 const history=state.picks?.entry_history,entry=state.entry,picks=state.picks?.picks||[],capPick=picks.find(p=>Number(p.multiplier)>1)||picks.find(p=>p.is_captain),captain=state.players[capPick?.element],gross=history?.points,hit=history?.event_transfers_cost,net=gross==null||hit==null?null:gross-hit,capPoints=state.live[captain?.id]?.stats?.total_points,projected=teamPrediction(picks.filter(p=>p.position<=11).map(p=>state.players[p.element]).filter(Boolean),1);
 return {history,entry,gross,hit,net,captain,capPick,capPoints,projected};
}
function approvedSummary(){const m=approvedTeamMetrics(),bench=m.history?.points_on_bench;summaryPanel.innerHTML='<div class="panel-head"><h2>Gameweek summary</h2><span class="approved-gw">GW'+(state.gw||'—')+'</span></div><div class="approved-summary-body">'+[['Gross points',fmt(m.gross)],['Transfer hit',m.hit?'<span class="negative">−'+fmt(m.hit)+'</span>':fmt(m.hit)],['Net points',fmt(m.net)],['Points on bench',fmt(bench)]].map(([label,value])=>'<div class="approved-summary-row"><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+'</div>';}
const approvedHeroBefore=updateDashboardHero;
updateDashboardHero=function(){approvedHeroBefore();const m=approvedTeamMetrics();
 $('dashboardHeroStats').innerHTML=heroMetric('GW POINTS · NET',fmt(m.net),m.gross==null?'Waiting for team data':fmt(m.gross)+' points − '+fmt(m.hit)+' transfer hit',true)+heroMetric('TOTAL POINTS',fmt(m.entry?.summary_overall_points),'Season total')+heroMetric('OVERALL RANK',fmt(m.entry?.summary_overall_rank),'Official FPL ranking')+heroMetric('CAPTAIN',esc(m.captain?.web_name||'—'),m.capPoints==null?'Points not yet available':'Player points '+fmt(m.capPoints)+' · Captain '+fmt(m.capPoints*(m.capPick?.multiplier||1)));
 $('dashboardPlaying').textContent=m.history?'Bank '+money(m.history.bank)+' · '+currentSquad().filter(p=>p.status!=='a').length+' players flagged · Next GW projection '+fmt(m.projected,1):'Connect your team to see the analysis.';
 approvedSummary();
};
const approvedNewsBefore=renderDashboardNews;renderDashboardNews=function(){approvedNewsBefore();approvedSummary();};
const approvedViewBefore=showView;showView=function(view){approvedViewBefore(view);document.querySelectorAll('.approved-navigation [data-view]').forEach(b=>{const active=b.dataset.view===state.view;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});if(state.view!=='dashboard'){$('pageTitle').textContent=menuGroups.flatMap(([,items])=>items).find(([v])=>v===state.view)?.[1]||'My Team';$('pageDesc').textContent='';}document.querySelector('.approved-more')?.removeAttribute('open');};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b?.dataset.approvedSection)return;if(b.dataset.approvedSection==='summary')summaryPanel.scrollIntoView({behavior:'smooth',block:'center'});else $('dashboardOverview').scrollIntoView({behavior:'smooth',block:'start'});approvedTabs.querySelectorAll('button').forEach(n=>n.classList.toggle('active',n===b));});
updateDashboardHero();


// Let the player table use the full content width, outside the pitch/news grid.
$('dashboardLayout').append($('dashboardPool'));

const teamVisitNotice=document.createElement('section');
teamVisitNotice.className='notice hidden';
teamVisitNotice.setAttribute('aria-label','Team currently being viewed');
document.querySelector('.shell').before(teamVisitNotice);
const teamContextBeforeVisit=updateTeamContext;
updateTeamContext=function(){
 teamContextBeforeVisit();
 teamVisitNotice.classList.toggle('hidden',!state.visitingTeam);
 if(state.visitingTeam)teamVisitNotice.innerHTML='<div><strong>Viewing team: '+esc(state.entry?.name||'')+'</strong><p>'+esc([state.entry?.player_first_name,state.entry?.player_last_name].filter(Boolean).join(' '))+' · <strong>FPL ID: '+esc(state.entry?.id)+'</strong></p><p>Your main team remains saved.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-return-home>Back to my team</button><button class="btn" data-goto="liga">← Back to mini league</button></div>';
};
teamVisitNotice.addEventListener('click',async e=>{
 const button=e.target.closest('[data-return-home]');if(!button)return;
 const id=state.homeEntryId||safeRead('dugout-entry');if(!id){openConnection();return;}
 button.disabled=true;button.textContent='Loading my team…';
 await loadTeam(id,state.gw,{visit:false});
 if(!state.visitingTeam)showView('tim');
 else {button.disabled=false;button.textContent='Back to my team';}
});
