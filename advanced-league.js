async function mapLimited(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;try{out[i]={ok:true,value:await fn(items[i],i)};}catch(error){out[i]={ok:false,error:error.message,item:items[i]};}}}));return out;}
const leagueColors=['#3366cc','#743ad1','#008650','#ce2f4e','#c4932b','#88bc29','#23bf56','#2ab8b1','#c15baf','#6873bf','#ca6743','#71936f'];
function chipLabel(value){return {wildcard:'Wildcard',freehit:'Free Hit',bboost:'Bench Boost','3xc':'Triple Captain'}[value]||value||'—';}

/* Read every standings page before reporting whole-league ownership.
   Missing pages or picks fail closed: sample numerators cannot be divided by the full league size. */
async function collectCompleteLeagueStandings(data,token){
 const leagueId=data.league.id,seen=new Set(),rows=[];
 const maxPages=20,maxTeams=1000;
 let page=1,hasNext=true;
 while(hasNext&&page<=maxPages){
  if(token!==ext.leagueToken||String(state.league?.league.id)!==String(leagueId))return null;
  let response;
  try{response=page===1&&state.leaguePage===1?data:await api('leagues-classic/'+leagueId+'/standings/?page_standings='+page);}
  catch(error){return {complete:false,rows,reason:'Halaman '+page+' gagal dimuat: '+error.message};}
  if(Number(response?.league?.id)!==Number(leagueId)||!Array.isArray(response?.standings?.results))
   return {complete:false,rows,reason:'Respons klasemen tidak cocok dengan liga terpilih.'};
  if(!response.standings.results.length&&response.standings.has_next)
   return {complete:false,rows,reason:'Halaman '+page+' kosong meski masih ada halaman berikutnya.'};
  for(const entry of response.standings.results){
   const id=String(entry.entry);
   if(!/^[1-9]\d*$/.test(id)||seen.has(id))
    return {complete:false,rows,reason:'Entry ID tidak valid atau duplikat antar halaman.'};
   seen.add(id);rows.push(entry);
  }
  hasNext=!!response.standings.has_next;
  if(rows.length>maxTeams)return {complete:false,rows,reason:'Liga melebihi batas '+maxTeams+' peserta untuk audit ownership.'};
  page++;
 }
 return {complete:!hasNext,rows,reason:hasNext?'Belum semua halaman klasemen berhasil dimuat.':null};
}
function validLeaguePicks(picks,gw){
 return Array.isArray(picks?.picks)&&picks.picks.length===15
  &&new Set(picks.picks.map(p=>Number(p.element))).size===15
  &&picks.picks.every(p=>Number.isInteger(Number(p.element))&&Number(p.element)>0)
  &&(picks.entry_history?.event==null||Number(picks.entry_history.event)===Number(gw));
}

async function renderLeagueExtras(data){const token=++ext.leagueToken;let holder=$('leagueExtras');if(!holder){holder=document.createElement('div');holder.id='leagueExtras';$('leaguePagination').after(holder);}holder.innerHTML='<div class="section-loading"><span class="loader"></span> Memuat picks dan riwayat peserta untuk analisis liga…</div>';
 const leagueId=data.league.id,gw=state.gw;if(!gw){holder.innerHTML=emptyState('Gameweek belum tersedia.');return;}const rows=data.standings.results.slice(0,20);const cacheKey=leagueId+'-'+state.leaguePage+'-'+gw;let records=ext.cache['league-'+cacheKey];
 if(!records){const results=await mapLimited(rows,4,async row=>{const [picks,history]=await Promise.all([extraData('picks-'+row.entry+'-'+gw,'entry/'+row.entry+'/event/'+gw+'/picks/'),extraData('history-'+row.entry,'entry/'+row.entry+'/history/')]);return {row,picks,history};});records=results.filter(r=>r.ok).map(r=>r.value);ext.cache['league-'+cacheKey]=records;ext.leagueFailures=results.filter(r=>!r.ok).length;}
 if(token!==ext.leagueToken||String(state.league?.league.id)!==String(leagueId))return;
 const fullKey='league-full-'+leagueId+'-'+gw;let full=ext.cache[fullKey];
 if(!full){
  holder.innerHTML='<div class="section-loading"><span class="loader"></span> Memuat seluruh halaman klasemen sebelum menghitung ownership liga…</div>';
  full=await collectCompleteLeagueStandings(data,token);
  if(!full)return;
  if(full.complete)ext.cache[fullKey]=full;
 }
 if(token!==ext.leagueToken||String(state.league?.league.id)!==String(leagueId))return;
 const ownKey='leagueown-full-'+leagueId+'-'+gw;let ownRecords=ext.cache[ownKey];
 if(!ownRecords||ownRecords.length!==full.rows.length){
  const known=new Map(records.filter(r=>validLeaguePicks(r.picks,gw)).map(r=>[String(r.row.entry),r]));
  const missing=full.rows.filter(r=>!known.has(String(r.entry)));
  holder.innerHTML='<div class="section-loading"><span class="loader"></span> Memverifikasi picks '+full.rows.length+' peserta liga…</div>';
  const got=await mapLimited(missing,5,async row=>{
   const picks=await extraData('picks-'+row.entry+'-'+gw,'entry/'+row.entry+'/event/'+gw+'/picks/');
   if(!validLeaguePicks(picks,gw))throw new Error('Picks tidak lengkap atau berbeda GW');
   return {row,picks};
  });
  const pickMap=new Map([...known,...got.filter(x=>x.ok).map(x=>[String(x.value.row.entry),x.value])]);
  ownRecords=full.rows.map(r=>pickMap.get(String(r.entry))).filter(Boolean);
  if(full.complete&&ownRecords.length===full.rows.length)ext.cache[ownKey]=ownRecords;
 }
 if(token!==ext.leagueToken||String(state.league?.league.id)!==String(leagueId))return;
 const coverage={complete:full.complete&&ownRecords.length===full.rows.length,
  total:full.complete?full.rows.length:null,loaded:ownRecords.length,
  standingsLoaded:full.rows.length,reason:full.reason};
 ext.leagueCoverage=coverage;
 ext.leagueOwnRecords=coverage.complete?ownRecords:[];
 if(!ext.snapshot)try{await loadSnapshot();}catch{}
 if(token!==ext.leagueToken)return;
 ext.leagueRecords=records;ext.leagueAnalyzedId=leagueId;ext.leagueAnalyzedGw=gw;
 holder.innerHTML='<div class="notice '+(coverage.complete?'ok':'warn')+'">Analisis rival dan riwayat: '+records.length+' dari '+rows.length+' peserta halaman '+state.leaguePage+'. '+(coverage.complete?'Ownership: seluruh '+coverage.total+' tim liga, data picks terverifikasi.':'Ownership seluruh liga belum dapat dihitung: '+coverage.standingsLoaded+' peserta klasemen dan '+coverage.loaded+' picks terbaca. '+(coverage.reason||'Sebagian picks tidak berhasil dimuat.')+' Coba refresh.')+(ext.leagueFailures?' '+ext.leagueFailures+' riwayat peserta gagal dimuat.':'')+'</div>'+leagueDetailedTable(records)+panel('League position over time','<div class="adv-tabs"><button data-league-chart="rank" class="'+(ext.leagueTab==='rank'?'active':'')+'">Position</button><button data-league-chart="points" class="'+(ext.leagueTab==='points'?'active':'')+'">Points</button></div><div id="leagueChart">'+leagueHistoryChart(records,ext.leagueTab)+'</div>','Posisi dihitung dari total poin peserta yang berhasil dimuat; seri memakai competition rank.')+'<h2 class="adv-section-title">What the league owns <small>Template, ownership, and where you differ.</small></h2>'+leagueOwnershipPanels(ext.leagueOwnRecords,coverage)+'<h2 class="adv-section-title">How they are playing it <small>Who is scoring against you, and how your rivals differ.</small></h2>'+leagueThreatPanels(records)+leagueChipsTable(records);
}
function leagueDetailedTable(records){
 // One table only: detail columns are merged into the official league table instead of repeating every team in a second one.
 const table=document.querySelector('#leaguePanel table');if(!table||table.dataset.detailMerged==='1'||!records.length)return '';
 const byEntry=new Map(records.map(r=>[String(r.row.entry),r.picks]));
 const heads=['Captain','Chip','Bench','Hits','XI xGI/90'],headRow=table.querySelector('thead tr');if(!headRow)return '';
 const last=headRow.lastElementChild;heads.forEach(h=>{const th=document.createElement('th');th.textContent=h;th.title=h==='XI xGI/90'?'Jumlah laju xGI musim dari starter; bukan xGI aktual pertandingan GW ini.':h;headRow.insertBefore(th,last);});
 table.querySelectorAll('tbody tr').forEach(tr=>{const btn=tr.querySelector('[data-team]'),picks=btn&&byEntry.get(String(btn.dataset.team)),lastTd=tr.lastElementChild;
  const cells=picks?(()=>{const cap=picks.picks.find(p=>p.is_captain),xgi=picks.picks.filter(p=>p.position<=11).reduce((sum,p)=>sum+Number(state.players[p.element]?.expected_goal_involvements_per_90||0),0);return [state.players[cap?.element]?.web_name||'—',chipLabel(picks.active_chip),fmt(picks.entry_history.points_on_bench),fmt(picks.entry_history.event_transfers_cost),fmt(xgi,2)];})():['—','—','—','—','—'];
  cells.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.insertBefore(td,lastTd);});});
 table.dataset.detailMerged='1';return '';
}
function leagueHistoryChart(records,mode='rank'){if(!records.length)return emptyState('Riwayat peserta belum tersedia.');const gws=[...new Set(records.flatMap(r=>r.history.current.map(g=>g.event)))].filter(g=>g<=state.gw).sort((a,b)=>a-b),W=1000,H=380,L=50,R=25,T=25,B=40;const maxPoints=Math.max(1,...records.flatMap(r=>r.history.current.map(g=>g.total_points))),maxRank=Math.max(2,records.length);const values=records.map(r=>gws.map(gw=>{const score=r.history.current.find(g=>g.event===gw)?.total_points;if(score==null)return null;if(mode==='points')return score;return 1+records.filter(x=>(x.history.current.find(g=>g.event===gw)?.total_points??-1)>score).length;}));const y=v=>mode==='points'?H-B-(v/maxPoints)*(H-B-T):T+(v-1)/(maxRank-1)*(H-B-T),x=i=>L+(W-L-R)*(gws.length===1?.5:i/(gws.length-1));const lines=values.map((vals,index)=>{const color=leagueColors[index%leagueColors.length],own=records[index].row.entry===state.entry?.id;return '<polyline points="'+vals.map((v,i)=>v===null?'':x(i)+','+y(v)).filter(Boolean).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+(own?3.5:1.5)+'"/>'+vals.map((v,i)=>v===null?'':'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="'+(own?4:2.8)+'" fill="'+color+'"><title>'+esc(records[index].row.entry_name)+' · GW'+gws[i]+' · '+fmt(v)+'</title></circle>').join('');}).join('');return '<svg class="adv-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="League '+mode+' over time">'+Array.from({length:5},(_,i)=>{const v=mode==='points'?maxPoints*i/4:1+(maxRank-1)*i/4;return '<line class="axis" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="'+(L-12)+'" y="'+(y(v)+4)+'" text-anchor="end">'+fmt(v)+'</text>';}).join('')+gws.map((gw,i)=>'<text x="'+x(i)+'" y="'+(H-12)+'" text-anchor="middle">GW'+gw+'</text>').join('')+lines+'</svg><div class="chart-legend">'+records.map((r,i)=>'<span style="'+(r.row.entry===state.entry?.id?'font-weight:700;color:#35003c':'')+'"><i style="background:'+leagueColors[i%leagueColors.length]+'"></i>'+esc(r.row.entry_name)+'</span>').join('')+'</div>';}
function leagueCounts(records){const counts={},captains={};for(const r of records){for(const p of r.picks.picks){counts[p.element]=(counts[p.element]||0)+1;if(p.is_captain)captains[p.element]=(captains[p.element]||0)+1;}}return {counts,captains};}
function leagueOwnershipPanels(records,coverage){if(!coverage?.complete)return panel('Who owns whom',emptyState('Ownership liga belum ditampilkan karena data seluruh peserta belum lengkap. Muat ulang untuk mencoba kembali.'),'Cegah angka sampel seperti 42/50 ditampilkan sebagai ownership 58 tim.');const {counts,captains}=leagueCounts(records),n=coverage.total;if(!n||records.length!==n)return emptyState('Ownership liga belum lengkap.');const list=Object.keys(counts).map(id=>state.players[id]).filter(Boolean).sort((a,b)=>counts[b.id]-counts[a.id]||Number(b.total_points)-Number(a.total_points));const template=legalXI(list,p=>counts[p.id]||0),own=ownIds(),differentials=list.filter(p=>own.has(p.id)&&counts[p.id]===1),watch=insightRanked(3).filter(p=>!counts[p.id]).slice(0,6);
 const ownershipPitch=template?pitchFor(template.players,p=>counts[p.id]/n*100):emptyState('Belum cukup pemain untuk template XI.');const details=list.slice(0,15).map(p=>'<article class="ownership-card"><div class="donut" title="Dimiliki '+counts[p.id]+' dari '+n+' tim di liga" style="--pct:'+counts[p.id]/n*100+'"><div>'+counts[p.id]+'/'+n+'<small>'+fmt(counts[p.id]/n*100)+'%</small></div></div><button class="btn small ghost" data-player="'+p.id+'"><strong>'+esc(p.web_name)+'</strong></button><p>'+esc(state.teams[p.team]?.short_name)+' · '+fmt(p.total_points)+' pts<br>'+'Kapten di '+fmt(captains[p.id]||0)+' tim</p><p class="'+(own.has(p.id)?'owned':'')+'">'+(own.has(p.id)?'You own him':'Not in your squad')+'</p></article>').join('');return panel('League template',ownershipPitch,'XI berdasarkan ownership seluruh '+n+' tim di liga yang dipilih, dengan formasi legal. Angka di lapangan adalah % ownership liga; tanpa batas budget.')+panel('Who owns whom','<div class="ownership-scroll">'+details+'</div>','15 pemain teratas ditampilkan sekaligus. Geser horizontal untuk melihat semuanya. Angka x/'+n+' = x dari keseluruhan '+n+' tim yang terdaftar di liga ini dan berhasil diverifikasi picks-nya. Bukan ownership global FPL.')+panel('Your differentials',state.entry?(differentials.length?'<div class="adv-grid two">'+differentials.map(p=>'<div class="adv-card"><div class="compare-player-head">'+playerPhoto(p)+'<div><h3>'+esc(p.web_name)+'</h3><p>'+esc(state.teams[p.team]?.short_name)+' · '+money(p.now_cost)+'</p><div class="mini-statline"><div><span>POINTS</span><strong>'+fmt(p.total_points)+'</strong></div><div><span>xGI</span><strong>'+fmt(p.expected_goal_involvements,2)+'</strong></div><div><span>GLOBAL OWNED</span><strong>'+fmt(p.selected_by_percent,1)+'%</strong></div></div></div></div></div>').join('')+'</div>':emptyState('Tidak ada pemain unik timmu pada seluruh liga ini.')):emptyState(),'Dimiliki tim kamu dan tidak dimiliki tim lain dalam liga yang sudah diverifikasi sepenuhnya.')+panel('Differential watchlist','<div class="adv-grid">'+watch.map(p=>'<div class="adv-card"><div class="compare-player-head">'+playerPhoto(p)+'<div><h3>'+esc(p.web_name)+'</h3><p>'+esc(state.teams[p.team]?.short_name)+' · '+money(p.now_cost)+'</p></div></div><div class="mini-statline"><div><span>NEXT 3 GW</span><strong>'+fmt(projectedAt(p,3),1)+'</strong></div><div><span>GLOBAL OWNED</span><strong>'+fmt(p.selected_by_percent,1)+'%</strong></div></div>'+fixturePills(p.team,1)+'</div>').join('')+'</div>','Tidak dimiliki seluruh peserta liga. Global ownership ditampilkan terpisah.');}
function leagueThreatPanels(records){const ownRecord=records.find(r=>r.row.entry===state.entry?.id);if(!ownRecord)return panel('Scoring against you',emptyState('Tim yang sedang dibuka tidak ada pada sampel halaman ini. Pilih tim peserta atau halaman liga yang memuat Entry ID kamu.'));const ownMult=Object.fromEntries(ownRecord.picks.picks.map(p=>[p.element,p.multiplier]));const rivals=records.filter(r=>r!==ownRecord),threats={};for(const r of rivals)for(const pick of r.picks.picks){if(pick.multiplier<=0||ownMult[pick.element]>0)continue;const p=state.players[pick.element],pts=state.live[pick.element]?.stats?.total_points;if(!p||pts==null)continue;const item=threats[p.id]||{p,points:pts,damage:0,started:0};item.damage+=pts*pick.multiplier;item.started++;threats[p.id]=item;}const ranked=Object.values(threats).sort((a,b)=>b.damage-a.damage).slice(0,8),max=Math.max(1,...ranked.map(r=>r.damage)),{counts,captains}=leagueCounts(records);const notOwned=Object.keys(counts).map(id=>state.players[id]).filter(p=>p&&!ownIds().has(p.id)).sort((a,b)=>counts[b.id]-counts[a.id]).slice(0,3);const bench=[...records].sort((a,b)=>b.picks.entry_history.points_on_bench-a.picks.entry_history.points_on_bench).slice(0,4);return panel('Scoring against you',ranked.length?ranked.map(r=>'<div style="display:grid;grid-template-columns:180px 45px 1fr;gap:14px;align-items:center;margin:17px 0"><div><button class="btn small ghost" data-player="'+r.p.id+'">'+esc(r.p.web_name)+'</button><p class="adv-note" style="margin:4px 0">Started by '+r.started+' of '+rivals.length+' rivals</p></div><strong style="color:#bd1746">'+fmt(r.points)+'</strong><div class="adv-bar" style="margin:0"><span style="width:'+Math.max(2,r.damage/max*100)+'%;background:#245be4" title="'+r.damage+' cumulative rival points"></span></div></div>').join(''):emptyState('Tidak ada ancaman positif yang tercatat pada GW ini.'),'Poin GW pemain yang tidak menghasilkan poin di XI kamu. Panjang bar = poin tertimbang pengali rival, bukan pengurangan langsung dari poinmu.')+panel('How the league differs','<div class="adv-grid">'+shortlist('THE LEAGUE HAS, YOU DO NOT',notOwned,p=>counts[p.id],'Jumlah peserta yang memiliki pemain tersebut.','yellow')+'<div class="adv-card"><h3>CAPTAIN PICKS</h3>'+Object.keys(captains).map(id=>'<div class="adv-row"><strong>'+esc(state.players[id]?.web_name)+'</strong><span>'+captains[id]+'/'+records.length+'</span></div><p>'+records.filter(r=>r.picks.picks.some(p=>p.element===Number(id)&&p.is_captain)).map(r=>esc(r.row.entry_name)).join(', ')+'</p>').join('')+'</div><div class="adv-card yellow"><h3>POINTS LEFT ON THE BENCH</h3>'+bench.map(r=>'<div class="adv-row"><strong>'+esc(r.row.entry_name)+'</strong><span>'+fmt(r.picks.entry_history.points_on_bench)+'</span></div>').join('')+'</div></div>');}
function leagueChipsTable(records){return panel('Chips used','<div class="table-wrap"><table><thead><tr><th>Manager / team</th><th>Wildcard</th><th>Free Hit</th><th>Bench Boost</th><th>Triple Captain</th></tr></thead><tbody>'+records.map(r=>'<tr><td class="team-name">'+esc(r.row.entry_name)+'<small>'+esc(r.row.player_name)+'</small></td>'+['wildcard','freehit','bboost','3xc'].map(chip=>'<td>'+((r.history.chips||[]).filter(c=>c.name===chip).map(c=>'GW'+c.event).join(', ')||'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>','Riwayat chip publik dari endpoint entry/history; aktivasi sebelum deadline belum terlihat.');}
document.addEventListener('click',event=>{const b=event.target.closest('button');if(b?.dataset.leagueChart){ext.leagueTab=b.dataset.leagueChart;if($('leagueChart'))$('leagueChart').innerHTML=leagueHistoryChart(ext.leagueRecords||[],ext.leagueTab);b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));}});
