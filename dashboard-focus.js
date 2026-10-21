// Keep computed signals tied to the current team and validated prediction snapshot.
let dashboardContextCache=null;
function dashboardNewsContext(){
 const key=[state.entry?.id,state.gw,ext.watch.join(','),ext.selectedModel,ext.transferBank,JSON.stringify(ext.salePrices||{})].join('|');
 if(dashboardContextCache?.key===key&&dashboardContextCache.players===state.players&&dashboardContextCache.picks===state.picks&&dashboardContextCache.snapshot===ext.snapshot)return dashboardContextCache.context;
 let suggestions=[];try{if(state.picks&&ext.snapshot?.gw===state.next?.id)suggestions=transferSuggestions(3);}catch{}
 const context=buildNewsContext(allPlayers(),ownIds(),ext.watch,suggestions);
 dashboardContextCache={key,players:state.players,picks:state.picks,snapshot:ext.snapshot,context};return context;
}
function dashboardDate(time){return Number.isFinite(time)&&time>0?deviceDateTime(time):'Tanggal belum tersedia';}
function newsPublishedDate(value){if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(value));return dashboardDate(typeof value==='number'?value:Date.parse(value));}
function newsReason(player,context){
 const labels=[];
 if(context.own.has(player.id))labels.push('Ada di skuad 15 pemainmu');
 if(context.watch.has(player.id))labels.push('Kamu simpan di Watchlist');
 const candidate=context.candidates.get(player.id);if(candidate)labels.push('Kandidat pengganti '+candidate.out+' · +'+fmt(candidate.gain,1)+' xP / 3 GW sebelum hit');
 const trend=context.trending.get(player.id);if(trend&&!labels.length){const performance=trend.find(r=>r.type==='performance'),transfers=trend.find(r=>r.type==='transfers');labels.push(performance?'Performa GW'+(state.bootstrap?.events.find(e=>e.is_current)?.id||state.gw)+' · '+fmt(performance.value)+' poin':fmt(transfers.value)+' transfer masuk GW ini');}
 return labels.join(' · ');
}
function europeArticles(){
 const key=ext.europeFetchedAt+'|'+allPlayers().length;
 if(ext.europeAttached?.key!==key)ext.europeAttached={key,articles:attachMentionedPlayers(ext.europeNews||[],allPlayers(),state.teams)};
 return ext.europeAttached.articles;
}
personalizedNews=function(){return selectPersonalNews({players:allPlayers(),teams:state.teams,articles:[...(ext.news?.articles||[]),...europeArticles()],context:dashboardNewsContext(),filter:ext.playerNewsFilter||'For You'});};
function dashboardNewsArticle(item,context){
 const labels={Squad:'Our 15',Watchlist:'Watchlist',Targets:'Transfer target',Trending:'Trending'},article=item.article;
 const source=item.kind==='fitness'?'Official FPL':(article.source||'The Guardian')+(article.source_type==='europe'?' · laga Eropa, bukan skor FPL':'');
 const href=item.kind==='article'&&/^https:\/\//.test(article.url||'')?article.url:null;
 return '<article class="news-rail-item focus-news-item">'+(item.urgent?'<span class="news-priority">Perlu diperhatikan · skuadmu</span>':'')+'<div class="news-player-top">'+item.players.slice(0,3).map(p=>'<button data-player="'+p.id+'">'+esc(p.web_name)+'</button>').join('<span aria-hidden="true"> · </span>')+'<span class="news-category-tags">'+item.categories.map(c=>'<span>'+labels[c]+'</span>').join('')+'</span></div><h3>'+(item.kind==='fitness'?esc(item.news):href?'<a href="'+esc(href)+'" target="_blank" rel="noopener">'+esc(article.headline)+' ↗</a>':esc(article.headline))+'</h3><p class="news-reason">'+item.players.slice(0,2).map(p=>esc(newsReason(p,context))).join('<br>')+'</p><small>'+esc(source)+' · '+(item.ongoing?'Status masih aktif · pembaruan ': '')+esc(newsPublishedDate(item.kind==='article'?article.date:item.time))+'</small></article>';
}
renderDashboardNews=function(){
 if(!$('dashboardNewsContent'))return;
 approvedSummary();
 const context=dashboardNewsContext(),filter=ext.playerNewsFilter||'For You',items=personalizedNews(),filterKey=state.entry?.id+'|'+filter;
 if(ext.focusNewsFilterKey!==filterKey){ext.focusNewsFilterKey=filterKey;ext.focusNewsVisible=10;}
 const visible=ext.focusNewsVisible=compactPageEnd(items.length,ext.focusNewsVisible);
 document.querySelector('.news-rail-heading').innerHTML='<div class="news-title-line"><h2>Player News</h2>'+(ext.newsFetchedAt&&!ext.newsError&&!ext.newsLoading?'<small class="news-checked" title="Dicek '+esc(dashboardDate(ext.newsFetchedAt))+'. Berita 7 hari terakhir + status kebugaran aktif">Dicek '+esc(new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(ext.newsFetchedAt)))+'</small>':'')+'</div><button class="btn small ghost" id="refreshPersonalNews"'+(ext.newsLoading?' disabled':'')+' aria-label="Muat ulang berita pemain">'+(ext.newsLoading?'Memuat…':'↻ Refresh')+'</button>';
 $('dashboardNewsContent').innerHTML='<nav class="player-news-filters" aria-label="Filter berita pemain">'+['For You','Squad','Watchlist','Targets','Trending'].map(f=>'<button type="button" data-player-news-filter="'+f+'" aria-pressed="'+(f===filter)+'" class="'+(f===filter?'active':'')+'">'+(f==='Squad'?'Our 15':f)+'</button>').join('')+'</nav>'+(ext.newsError||ext.newsLoading||!ext.newsFetchedAt?'<div class="news-freshness">'+(ext.newsError?'Headline belum berhasil diperbarui. ':ext.newsLoading?'Memeriksa headline terbaru… ':'')+'Berita 7 hari terakhir + status kebugaran aktif.</div>':'')+items.slice(visible-10,visible).map(item=>dashboardNewsArticle(item,context)).join('')+(visible>10?'<button class="btn news-load-more" data-previous-personal-news>← Sebelumnya</button>':'')+(items.length>visible?'<button class="btn news-load-more" data-more-personal-news>Berita berikutnya · '+(items.length-visible)+' lagi ↓</button>':'')+(items.length?'<div class="news-count">'+Math.min(visible,items.length)+' dari '+items.length+' kabar relevan</div>':'<div class="news-rail-status">'+(filter==='Watchlist'&&!context.watch.size?'Watchlist masih kosong. <button class="btn small" data-goto="watchlist">Cari pemain →</button>':filter==='Targets'&&!context.candidates.size?'Belum ada kandidat transfer legal dari proyeksi yang tersedia.':'Belum ada headline baru yang relevan dari sumber tersedia. Status FPL tetap diperiksa.')+'</div>');
 document.querySelector('.news-rail-foot').textContent='Guardian & Official FPL · terbaru lebih dulu. Target transfer berdasarkan proyeksi 3 GW, harga pasar, dan batas klub.';
 $('refreshPersonalNews').onclick=()=>{ext.newsFetchedAt=0;ext.focusNewsLastAttempt=Date.now();loadLiveNews();};
 if($('dashboardBrief'))renderDashboardBrief();
};
const focusBrief=document.createElement('section');focusBrief.id='dashboardBrief';focusBrief.className='dashboard-brief';focusBrief.setAttribute('aria-label','Ringkasan tindakan tim');
document.querySelector('.team-hero').after(focusBrief);
// Point totals already have a hero: keep the detailed breakdown available on demand.
const gameweekDetails=document.createElement('details');gameweekDetails.className='gameweek-details';gameweekDetails.innerHTML='<summary>Gameweek breakdown <span>Gross, hit & bench</span></summary>';gameweekDetails.append(summaryPanel);document.querySelector('.dashboard-news').append(gameweekDetails);
function renderDashboardBrief(){
 if(!state.entry||!state.picks){focusBrief.innerHTML='';return;}
 const context=dashboardNewsContext(),squad=currentSquad(),flags=squad.filter(p=>p.status!=='a'),target=[...context.candidates.entries()][0],incoming=target?state.players[target[0]]:null,move=target?.[1],deadline=deadlineBrief(state.next),newsCount=personalizedNews().length;
 focusBrief.innerHTML='<div class="brief-heading"><div><span class="eyebrow">YOUR NEXT MOVE</span><h2>At a glance</h2></div><button class="btn small ghost" data-focus-news>Player News <span class="badge">'+newsCount+'</span> ↓</button></div><div class="focus-grid"><article class="focus-card '+(flags.length?'needs-attention':'')+'"><span class="focus-kicker">SQUAD CHECK</span><h3>'+(flags.length?flags.length+'&#160; pemain perlu dicek':'Tidak ada flag kebugaran')+'</h3><p>'+(flags.length?flags.slice(0,3).map(p=>'<strong>'+esc(p.web_name)+'</strong><br>'+esc(p.news||({d:'Diragukan tampil',i:'Cedera',s:'Skorsing',u:'Tidak tersedia',n:'Tidak aktif'}[p.status]||'Status perlu diverifikasi'))+(p.chance_of_playing_next_round!=null&&!String(p.news||'').includes('%')?'<br>'+fmt(p.chance_of_playing_next_round)+'% peluang tampil menurut FPL':'')+'<br><small>Official FPL</small>').join('<br><br>'):'Status resmi FPL untuk '+squad.length+' pemain. Tetap cek peluang starter.')+'</p><button class="focus-link" data-goto="tim">Periksa skuad →</button></article><article class="focus-card"><span class="focus-kicker">TRANSFER RADAR · 3 GW</span><h3>'+(incoming?esc(move.out)+' <span aria-hidden="true">→</span> '+esc(incoming.web_name):'Pantau pilihan berikutnya')+'</h3><p>'+(incoming?'<strong>+'+fmt(move.gain,1)+' xP</strong> sebelum transfer hit · harga jual memakai estimasi pasar.':'Kandidat muncul saat prediksi sesuai GW dan transfer memenuhi budget serta batas klub.')+'</p><button class="focus-link" '+(incoming?'data-plan-transfer="'+move.outId+':'+incoming.id+'"':'data-goto="transfers"')+'>Buka simulasi →</button></article><article class="focus-card focus-deadline"><div><span class="focus-kicker">DEADLINE · GW'+(state.next?.id||'—')+'</span><h3>'+esc(deadline?.short||'Menunggu jadwal')+'</h3><p>'+esc(deadline?dashboardDate(deadline.time):'Deadline resmi FPL belum tersedia.')+'</p></div><button class="focus-link" data-goto="planning">Siapkan gameweek →</button></article></div>';
}
const focusHeroBefore=updateDashboardHero;updateDashboardHero=function(){focusHeroBefore();renderDashboardBrief();};
const focusOverviewBefore=renderDashboardOverview;renderDashboardOverview=function(){focusOverviewBefore();renderDashboardBrief();renderDashboardNews();};
document.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-previous-personal-news')){ext.focusNewsVisible=Math.max(10,(ext.focusNewsVisible||10)-10);renderDashboardNews();}
 if(button.hasAttribute('data-more-personal-news')){ext.focusNewsVisible=(ext.focusNewsVisible||10)+10;renderDashboardNews();}
 if(button.hasAttribute('data-focus-news'))document.querySelector('.approved-news-panel').scrollIntoView({behavior:'smooth',block:'start'});
 if(button.dataset.approvedSection==='summary'){gameweekDetails.open=true;gameweekDetails.scrollIntoView({behavior:'smooth',block:'center'});}
 if(button.dataset.watch&&state.view!=='watchlist')renderDashboardNews();
});
function refreshDashboardNewsIfNeeded(){if(state.view!=='dashboard'||!state.entry||document.hidden||ext.newsLoading)return;const now=Date.now();if(now-(ext.newsFetchedAt||0)>=600000&&now-(ext.focusNewsLastAttempt||0)>=600000){ext.focusNewsLastAttempt=now;loadLiveNews();}}
const focusShowBefore=showView;showView=function(view){focusShowBefore(view);refreshDashboardNewsIfNeeded();};
document.addEventListener('visibilitychange',refreshDashboardNewsIfNeeded);
renderDashboardBrief();renderDashboardNews();
setInterval(()=>{if(state.view==='dashboard'&&state.entry&&!document.hidden){renderDashboardBrief();refreshDashboardNewsIfNeeded();}},60000);

// One account control in the header; no duplicate switch action in the hero.
const headerAccountActions=document.createElement('div');headerAccountActions.className='header-account-actions';
headerAccountActions.append(teamContext,themeToggle);document.querySelector('.approved-header-inner').append(headerAccountActions);
const focusTeamContextBefore=updateTeamContext;updateTeamContext=function(){focusTeamContextBefore();teamContext.title=state.entry?'FPL ID '+state.entry.id+' · klik untuk ganti tim':'Hubungkan tim FPL';teamContext.setAttribute('aria-label',state.entry?'Tim aktif '+state.entry.name+'. Klik untuk mengganti tim.':'Hubungkan tim FPL');};

// Overview switches between public GW results and a separate next-deadline draft.
let overviewMode='this';
const overviewSwitch=document.createElement('nav');overviewSwitch.className='overview-gw-switch';overviewSwitch.setAttribute('aria-label','Gameweek overview');
overviewSwitch.innerHTML='<button type="button" data-overview-mode="this" aria-pressed="true" class="active">This GW</button><button type="button" data-overview-mode="next" aria-pressed="false">Plan Next GW</button>';
approvedTabs.before(overviewSwitch);
const nextGwOverview=document.createElement('section');nextGwOverview.className='panel next-gw-overview';nextGwOverview.hidden=true;$('dashboardOverview').before(nextGwOverview);
function renderNextGwOverview(){
 const squad=currentSquad(),gw=state.next?.id;
 if(!squad.length||!gw){nextGwOverview.innerHTML='<div class="panel-head"><h2>Plan Next GW</h2></div><p class="next-plan-note">Hubungkan tim dan tunggu jadwal resmi FPL tersedia.</p>';return;}
 const key='fpl-overview-plan-'+state.entry.id+'-'+gw,saved=safeRead(key,{})||{},captain=squad.some(p=>p.id===Number(saved.captain))?Number(saved.captain):(state.picks?.picks.find(p=>p.is_captain)?.element||squad[0].id);
 const deadline=deadlineBrief(state.next);
 nextGwOverview.innerHTML='<div class="panel-head"><div><h2>Plan Next GW · GW'+gw+'</h2><p>Dasar skuad publik GW'+state.gw+' · data Official FPL</p></div><button class="btn small" data-goto="transfers">Simulasi transfer →</button></div><div class="next-plan-note">'+esc(deadline?dashboardDate(deadline.time):'Deadline belum tersedia')+' · Rencana lokal, belum dikirim ke FPL. Transfer dan susunan sebelum deadline tidak tersedia dari FPL ID publik.</div><div class="next-plan-controls"><label>Rencana kapten <select id="overviewPlanCaptain">'+squad.map(p=>'<option value="'+p.id+'"'+(p.id===captain?' selected':'')+'>'+esc(p.web_name)+'</option>').join('')+'</select></label><a class="btn small" href="https://fantasy.premierleague.com/my-team" target="_blank" rel="noopener">Atur di Official FPL ↗</a></div><div class="table-wrap"><table><thead><tr><th>Pemain</th><th>Posisi</th><th>Lawan GW'+gw+'</th><th>Status FPL</th><th>FPL xP</th></tr></thead><tbody>'+[...squad].sort((a,b)=>a.element_type-b.element_type).map(p=>{const fixtures=state.fixtures.filter(f=>f.event===gw&&(f.team_h===p.team||f.team_a===p.team));const projection=p.ep_next==null||p.ep_next===''?null:Number(p.ep_next);return '<tr><td><button data-player="'+p.id+'">'+esc(p.web_name)+'</button>'+(p.id===captain?' <span class="badge">C ×2</span>':'')+'</td><td>'+esc(positions[p.element_type]||'—')+'</td><td>'+(fixtures.length?fixtures.map(f=>esc(state.teams[f.team_h===p.team?f.team_a:f.team_h]?.short_name||'TBC')+' ('+(f.team_h===p.team?'H':'A')+')').join(' · '):'Blank / belum dijadwalkan')+'</td><td>'+esc(p.status==='a'?'Available':p.chance_of_playing_next_round!=null?p.chance_of_playing_next_round+'% peluang bermain':'Periksa kabar')+'</td><td>'+fmt(Number.isFinite(projection)?projection*(p.id===captain?2:1):null,1)+'</td></tr>';}).join('')+'</tbody></table></div><p class="next-plan-note">xP memakai ep_next resmi FPL, bukan poin aktual. Kapten rencana ×2; chip belum diasumsikan aktif. Pilihan kapten tersimpan untuk tim dan GW ini.</p>';
 $('overviewPlanCaptain').onchange=e=>{safeWrite(key,{captain:Number(e.target.value)});renderNextGwOverview();};
}
function applyOverviewMode(){
 const next=overviewMode==='next';nextGwOverview.hidden=!next;$('dashboardOverview').hidden=next;approvedTabs.hidden=next;
 overviewSwitch.querySelectorAll('button').forEach(b=>{const active=b.dataset.overviewMode===overviewMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 overviewSwitch.querySelector('[data-overview-mode="this"]').textContent='This GW'+(state.gw?' · GW'+state.gw:'');
 overviewSwitch.querySelector('[data-overview-mode="next"]').textContent='Plan Next GW'+(state.next?.id?' · GW'+state.next.id:'');
 if(next)renderNextGwOverview();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-overview-mode]');if(!b)return;overviewMode=b.dataset.overviewMode;applyOverviewMode();});
const planOverviewBefore=renderDashboardOverview;renderDashboardOverview=function(){planOverviewBefore();applyOverviewMode();};
applyOverviewMode();
