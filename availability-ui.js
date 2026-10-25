/* Marks fitness-flagged players in text lists (Scout, Market, watchlist, news...) with the same amber/red shading as pitch cards. */
function decorateAvailability(root=document){
 const nodes=root.querySelectorAll('button[data-player],a[data-player]');
 for(const el of nodes){
  if(el.classList.contains('player')||el.dataset.fitDone==='1')continue;
  const p=state.players?.[Number(el.dataset.player)];if(!p){continue;}
  el.dataset.fitDone='1';
  const level=playerAvailabilityLevel(p);if(!level)continue;
  const label=playerAvailabilityLabel(p);
  el.classList.add('fit-inline','fit-'+level);
  if(!el.getAttribute('title'))el.setAttribute('title',label);
  el.setAttribute('aria-label',(el.textContent||p.web_name).trim()+' · '+label);
 }
}
(function watchAvailability(){
 if(typeof MutationObserver==='undefined'||typeof document==='undefined'||!document.body)return;
 let queued=false;
 const run=()=>{queued=false;try{decorateAvailability();}catch{}};
 new MutationObserver(()=>{if(!queued){queued=true;setTimeout(run,40);}}).observe(document.body,{childList:true,subtree:true});
 run();
})();
