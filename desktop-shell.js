// Desktop shell: five-group sidebar that collapses to an icon rail, plus a title in the slim top bar.
// Reuses the existing data-view buttons and the global click handler, so no navigation logic is duplicated.
// Written against the DOM only: it observes body[data-view] instead of wrapping showView.
(function(){
if(document.querySelector('.app-side'))return;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const byId=id=>document.getElementById(id);
const shellIcons={dashboard:'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',tim:'M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z',decide:'M4 7h12m-4-4 4 4-4 4M20 17H8m4-4-4 4 4 4',research:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.3-4.3',league:'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',system:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2',accuracy:'M4 20V10m6 10V4m6 16v-7m4 7H2',insights:'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',about:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',chev:'M9 6l6 6-6 6',collapse:'M4 5h16v14H4zM9 5v14'};
const shellGroupsDef=[['dashboard','Home','dashboard',['dashboard']],['tim','Team','tim',['tim','optimal','watchlist']],['decide','Decisions','decide',['planning','transfers','chips']],['research','Research','research',['labs','playercompare','fixtures','market','news']],['league','League','league',['liga','banding']]];
const shellSystemViews=['accuracy','modelinsights','about'];
const shellViewLabels={dashboard:'Overview',tim:'Squad',optimal:'Optimal XI',watchlist:'Watchlist',planning:'Planning',transfers:'Transfer',chips:'Chips',labs:'Scout',playercompare:'Compare players',fixtures:'Fixture',market:'Market',news:'News',liga:'My league',banding:'Compare rivals',accuracy:'Model accuracy',modelinsights:'Model Insights',about:'About'};
const shellSvg=(d,cls)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'><path d="'+d+'"/></svg>';
const shellSide=document.createElement('aside');shellSide.className='app-side';shellSide.setAttribute('aria-label','Main menu');
const shellLogo=document.querySelector('.approved-brand img')?.getAttribute('src')||'';
shellSide.innerHTML='<div class="app-side-head"><button type="button" class="app-side-logo" id="sideToggle" aria-pressed="false" aria-label="Collapse menu" title="Collapse menu"><img class="logo-full" src="'+esc(shellLogo)+'" alt="FPL iphoenk"><span class="logo-mark" aria-hidden="true"></span></button></div><nav aria-label="Main navigation">'+shellGroupsDef.map(([key,label,icon,views])=>views.length===1?'<button type="button" data-view="'+views[0]+'" title="'+esc(label)+'">'+shellSvg(shellIcons[icon])+'<span class="side-text">'+esc(label)+'</span><span class="rail-text">'+esc(label)+'</span></button>':'<button type="button" class="side-group" data-shell-group="'+key+'" aria-expanded="false" title="'+esc(label)+'">'+shellSvg(shellIcons[icon])+'<span class="side-text">'+esc(label)+'</span><span class="rail-text">'+esc(label)+'</span>'+shellSvg(shellIcons.chev,'side-chev')+'</button><div class="app-side-subs" data-shell-subs="'+key+'">'+views.map(v=>'<button type="button" data-view="'+v+'">'+esc(shellViewLabels[v])+'</button>').join('')+'</div>').join('')+'</nav><div class="app-side-system"><small>System &amp; info</small>'+shellSystemViews.map(v=>{const ic={accuracy:'accuracy',modelinsights:'insights',about:'about'}[v],short={accuracy:'Accuracy',modelinsights:'Insights',about:'About'}[v];return '<button type="button" data-view="'+v+'" title="'+esc(shellViewLabels[v])+'">'+shellSvg(shellIcons[ic])+'<span class="side-text">'+esc(shellViewLabels[v])+'</span><span class="rail-text">'+short+'</span></button>';}).join('')+'</div>';
document.body.prepend(shellSide);
if(shellLogo)shellSide.querySelector('.logo-mark').style.backgroundImage='url("'+shellLogo.replace(/"/g,'%22')+'")';
const shellTitle=document.createElement('div');shellTitle.className='shell-title';shellTitle.id='shellTitle';
document.querySelector('.approved-header-inner')?.prepend(shellTitle);
function shellSetCollapsed(on,persist){document.body.classList.toggle('side-collapsed',on);const t=byId('sideToggle');t.setAttribute('aria-pressed',String(on));t.setAttribute('aria-label',on?'Expand menu':'Collapse menu');t.title=on?'Expand menu':'Collapse menu';if(persist)try{localStorage.setItem('fpl-iphoenk-side',on?'rail':'open');}catch{}}
function shellSyncGroups(view){shellGroupsDef.forEach(([key,,,views])=>{const open=views.length>1&&views.includes(view);const btn=shellSide.querySelector('[data-shell-group="'+key+'"]'),subs=shellSide.querySelector('[data-shell-subs="'+key+'"]');if(!btn)return;btn.classList.toggle('group-active',open);subs.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));});}
// Natural scrolling preserves legible typography across desktop and tablet.
function shellFit(){const lay=document.getElementById('dashboardLayout');if(!lay)return;lay.style.removeProperty('zoom');lay.removeAttribute('data-plan');}

let shellFitTimer=0;const shellFitSoon=()=>{clearTimeout(shellFitTimer);shellFitTimer=setTimeout(shellFit,60);};
shellSide.addEventListener('click',e=>{const g=e.target.closest('[data-shell-group]');if(g){const key=g.dataset.shellGroup,first=shellGroupsDef.find(x=>x[0]===key)[3][0];if(document.body.classList.contains('side-collapsed')){shellSide.querySelector('[data-view="'+first+'"]').click();return;}const subs=shellSide.querySelector('[data-shell-subs="'+key+'"]'),open=!subs.classList.contains('open');subs.classList.toggle('open',open);g.setAttribute('aria-expanded',String(open));return;}if(e.target.closest('#sideToggle'))shellSetCollapsed(!document.body.classList.contains('side-collapsed'),true);});
let shellSaved=null;try{shellSaved=localStorage.getItem('fpl-iphoenk-side');}catch{}
shellSetCollapsed(shellSaved?shellSaved==='rail':innerWidth<1280,false);
const shellSync=()=>{const view=document.body.dataset.view||'dashboard';shellTitle.textContent=shellViewLabels[view]||'';shellSyncGroups(view);shellFitSoon();};
new MutationObserver(()=>shellSync()).observe(document.body,{attributes:true,attributeFilter:['data-view']});
function shellPlaceExtras(){
 const desk=innerWidth>=1100&&document.body.classList.contains('has-team');
 const q=document.querySelector('.phase-quality'),sys=document.querySelector('.app-side-system'),ctl=document.querySelector('.overview-controls');
 if(q&&sys&&ctl){if(desk){if(q.parentNode!==sys)sys.appendChild(q);}else if(q.parentNode!==ctl)ctl.appendChild(q);}
 const grid=document.querySelector('.focus-grid'),inGrid=document.querySelector('.focus-grid>.focus-deadline'),inCtl=ctl&&ctl.querySelector('.focus-deadline');
 if(desk&&ctl){if(inGrid){if(inCtl)inCtl.remove();ctl.appendChild(inGrid);}}
 else if(inCtl&&grid&&!inGrid)grid.prepend(inCtl);
}
function shellPlaceRefresh(){const b=document.getElementById('refreshButton'),top=document.querySelector('.header-account-actions'),foot=document.querySelector('.footer');if(!b||!top||!foot)return;if(!b.dataset.shellIconOnly){b.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.35-5.65"/><path d="M20 4v6h-6"/></svg>';b.setAttribute('aria-label','Reload team data');b.setAttribute('title','Reload team data');b.dataset.shellIconOnly='true';}const ctx=document.getElementById('activeTeamContext');if(b.parentNode!==top){b.classList.add('shell-refresh');ctx&&ctx.parentNode===top?top.insertBefore(b,ctx):top.prepend(b);}}
addEventListener('resize',()=>{shellPlaceRefresh();shellPlaceExtras();});new MutationObserver(()=>{shellPlaceRefresh();shellPlaceExtras();}).observe(document.body,{childList:true,subtree:true});shellPlaceRefresh();shellPlaceExtras();
addEventListener('resize',shellFitSoon);new MutationObserver(shellFitSoon).observe(document.body,{attributes:true,attributeFilter:['class']});
const shellView=document.getElementById('view-dashboard');if(shellView)new MutationObserver(shellFitSoon).observe(shellView,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
shellSync();setTimeout(shellFit,600);setTimeout(shellFit,2500);
})();
