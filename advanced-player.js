const basePlayerDetail=playerDetail;
playerDetail=function(id){basePlayerDetail(id);ext.dialogPlayer=id;appendMatchLog(id);};
async function appendMatchLog(id){
 try{if(!ext.snapshot)await loadSnapshot();}catch{return;}
 if(ext.dialogPlayer!==id||!$('playerDialog').open)return;
 const player=state.players[id],details=snapshotPlayer(player),lab=labPlayer(player);const matches=details?.log||lab?.matches||[];
 if(!matches.length)return;const existing=$('extendedMatchLog');if(existing)existing.remove();
 const holder=document.createElement('section');holder.id='extendedMatchLog';holder.className='dialog-content';
 holder.innerHTML='<h3>Match-by-match log</h3><p class="adv-note">FPL iphoenk snapshot · season '+esc($('seasonLabel').textContent.replace('SEASON ',''))+'. Blank dan fixture ganda mengikuti catatan sumber.</p><div class="table-wrap"><table><thead><tr><th>GW</th><th>Opponent</th><th>Min</th><th>Pts</th><th>xG</th><th>xA</th><th>DefCon</th></tr></thead><tbody>'+[...matches].reverse().map(m=>'<tr><td>'+esc(m.gw)+'</td><td>'+esc(m.opp)+' '+(m.home?'H':'A')+'</td><td>'+fmt(m.min??m.minutes)+'</td><td>'+fmt(m.pts??m.points)+'</td><td>'+fmt(m.xg,2)+'</td><td>'+fmt(m.xa,2)+'</td><td>'+fmt(m.dc??m.defcon)+'</td></tr>').join('')+'</tbody></table></div>';
 $('playerDetail').append(holder);
}
document.addEventListener('click',event=>{const point=event.target.closest('circle[data-player]');if(point)playerDetail(Number(point.dataset.player));});
document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('circle[data-player]')){event.preventDefault();playerDetail(Number(event.target.dataset.player));}});
