const themeToggle=document.createElement('button');
themeToggle.type='button';themeToggle.className='theme-toggle';themeToggle.id='themeToggle';
(document.querySelector('.approved-header-inner')||document.body).append(themeToggle);
const themeMedia=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(theme,persist=false){
 const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';
 themeToggle.setAttribute('aria-pressed',String(dark));
 const label=dark?'Enable light mode':'Enable dark mode';
 themeToggle.setAttribute('aria-label',label);themeToggle.title=label;
 themeToggle.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'+(dark?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>':'<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>')+'</svg><span>'+(dark?'Light':'Dark')+'</span>';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#0d1420':'#f7f9fb');
 if(persist)safeWrite('fpl-iphoenk-theme',dark?'dark':'light');
}
applyTheme(document.documentElement.dataset.theme|| (themeMedia.matches?'dark':'light'));
themeToggle.onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true);
themeMedia.addEventListener('change',e=>{if(!safeRead('fpl-iphoenk-theme'))applyTheme(e.matches?'dark':'light');});
