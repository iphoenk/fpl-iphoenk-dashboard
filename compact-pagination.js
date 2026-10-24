// Presentation only: all loaded records remain available to calculations.
function compactPageEnd(total,end){return Math.max(10,Math.min(Math.ceil(Math.max(0,total)/10)*10,Math.ceil((Number(end)||10)/10)*10));}
// The public squad is always fifteen picks; never hide its last five behind Next.
function shouldCompactPaginate(list){return !list.closest('#squadTable');}
(()=>{
 const registered=new WeakMap();
 let backTarget=null;
 // Ownership shows all fifteen cards in a horizontally swipeable rail, never compact-paginated.
 const selector='table > tbody, .adv-grid, .captain-evidence-grid, .captain-history, .compact-feature-list, #savedPlans';
 function paginate(list){
  if(!shouldCompactPaginate(list))return;
  const items=Array.from(list.children);
  const league=!!list.closest('#leaguePanel');
  if((items.length<=10&&!league)||registered.has(list))return;
  // Mixed layouts are sections, not a list of repeated cards.
  if(list.matches('.adv-grid')&&!items.every(n=>n.matches('.adv-card')))return;
  const upstream=league?{previous:document.getElementById('leaguePrev')?.onclick,next:document.getElementById('leagueNext')?.onclick,hasPrevious:state.leaguePage>1,hasNext:!!state.league?.standings?.has_next}:null;
  const nav=document.createElement('nav');nav.className='compact-pagination';nav.setAttribute('aria-label','List navigation');
  const previous=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');
  previous.className=next.className='btn small';previous.type=next.type='button';previous.textContent='← Previous';next.textContent='Next →';label.setAttribute('aria-live','polite');
  nav.append(previous,label,next);
  const anchor=list.matches('tbody')?list.closest('.table-wrap')||list.closest('table'):list;
  if(league){const host=document.getElementById('leagueHeaderPage')||document.getElementById('leaguePagination');host.replaceChildren(nav);}else anchor.after(nav);let page=league&&backTarget?.id===state.league?.league.id&&backTarget?.page===state.leaguePage?Math.floor((items.length-1)/10):0;if(league)backTarget=null;
  const render=()=>{items.forEach((item,i)=>{item.hidden=i<page*10||i>=(page+1)*10;});previous.disabled=page===0&&!upstream?.hasPrevious;next.disabled=(page+1)*10>=items.length&&!upstream?.hasNext;label.textContent=(page*10+1)+'–'+Math.min((page+1)*10,items.length)+' of '+items.length+(league?' · group '+state.leaguePage:'');};
  previous.onclick=()=>{if(page===0){if(league)backTarget={id:state.league.league.id,page:state.leaguePage-1};upstream?.previous?.();return;}page--;render();};next.onclick=()=>{if((page+1)*10>=items.length){upstream?.next?.();return;}page++;render();};
  registered.set(list,{nav,items});render();
 }
 let queued=false;
 function scan(){queued=false;document.querySelectorAll(selector).forEach(list=>{const old=registered.get(list);if(old&&(old.items.length!==list.children.length||old.items.some((item,i)=>item!==list.children[i]))){old.nav.remove();registered.delete(list);}paginate(list);});}
 new MutationObserver(records=>{if(records.some(r=>r.type==='childList')&&!queued){queued=true;queueMicrotask(scan);}}).observe(document.body,{childList:true,subtree:true});
 const style=document.createElement('style');style.textContent='[hidden]{display:none!important}.compact-pagination{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:12px;padding:14px 12px;color:var(--muted);font-size:13px}.compact-pagination button:disabled{opacity:.4;cursor:default}';document.head.append(style);scan();
})();
