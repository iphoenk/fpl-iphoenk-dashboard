function archiveSourceLabel(r){return r.source==='official-fpl'?'Official FPL | ep_next':r.source==='fpl-iphoenk-python-v1'?'FPL iphoenk Python | '+r.model:'FPL iphoenk | '+r.model+' / FPLens';}
function archivePage(r){return Math.min(ext.archivePages?.[r.source]||0,Math.max(0,Math.ceil((r.rows?.length||0)/10)-1));}
const phaseHealth={};let archiveState=null,archiveBusy=false,phaseLoaded=false;
const phaseApiBefore=api;api=async function(path){try{const data=await phaseApiBefore(path);phaseHealth[path]={receivedAt:Date.now(),error:false};renderPhaseQuality();return data;}catch(error){phaseHealth[path]={receivedAt:phaseHealth[path]?.receivedAt,error:true};renderPhaseQuality();throw error;}};
const qualityPanel=document.createElement('details');qualityPanel.className='phase-quality';overviewSwitch.after(qualityPanel);const overviewControls=document.createElement("div");overviewControls.className="overview-controls";overviewSwitch.before(overviewControls);overviewControls.append(overviewSwitch,qualityPanel);
function renderPhaseQuality(){
 const players=allPlayers(),matched=players.filter(p=>xp(p)!==null).length,modelHealth=sourceQuality({receivedAt:state.manifest?.generated_at,maxAge:86400000,matched,total:players.length,invalid:!!state.manifest&&(!state.next||state.manifest.gameweek!==state.next.id||Date.parse(state.manifest.deadline)!==Date.parse(state.next.deadline_time))});
 const facts=[['Official FPL · pemain',phaseHealth['bootstrap-static/']],['Official FPL · fixture',phaseHealth['fixtures/']]].map(([name,s])=>({name,health:s?.error?{status:'unavailable'}:sourceQuality(s),time:s?.receivedAt,checked:true}));
 facts.push({name:'Prediksi · '+providerModelLabel(),health:modelHealth,time:Date.parse(state.manifest?.generated_at),checked:false});
 const labels={fresh:'Tersedia',partial:'Cakupan sebagian',stale:'Perlu diperbarui',invalid:'Tidak cocok',unavailable:'Belum tersedia'},issues=facts.filter(f=>f.health.status!=='fresh').length;
 qualityPanel.innerHTML='<summary><span><strong>Data quality</strong><span class="quality-sep"> · </span><em class="quality-status">'+(issues?issues+(issues===1?' source needs review':' sources need review'):'Primary sources available')+'</em></span><span aria-hidden="true">⌄</span></summary><div class="phase-quality-body">'+facts.map(f=>'<div><strong>'+esc(f.name)+'</strong><span class="quality-state '+f.health.status+'">'+labels[f.health.status]+'</span><small>'+(f.time?esc((f.checked?'Dicek ':'Diterbitkan ')+dashboardDate(f.time)):'Waktu belum tersedia')+(f.health.total?' · '+f.health.matched+'/'+f.health.total+' pemain cocok':'')+'</small></div>').join('')+'<p>Status ini memisahkan waktu pengecekan FPL dari waktu penerbitan prediksi. Cakupan kurang tidak diisi dengan nol. Sumber V6/V12 belum terhubung.</p><button class="btn small" data-goto="accuracy">Lihat arsip prediksi →</button></div>';
}
async function loadForecastArchive(capture=false,gw=null){
 if(archiveBusy)return;archiveBusy=true;
 try{
  if(capture){const saved=await fetch('/api/forecast-archive',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(90000)});if(!saved.ok&&saved.status!==503)throw new Error('Capture unavailable');}
  const r=await fetch('/api/forecast-archive'+(gw?'?gw='+gw:''),{signal:AbortSignal.timeout(90000)});archiveState=await r.json();if(!r.ok)archiveState.status='unavailable';
 }catch{archiveState={status:'unavailable'};}finally{archiveBusy=false;renderForecastArchive();}
}
function renderForecastArchive(){
 const root=$('forecastArchivePanel');if(!root)return;
 if(!archiveState){root.innerHTML=panel('Arsip prediksi dashboard','<p class="adv-note">Memeriksa penyimpanan privat…</p>');return;}
 const data=archiveState,results=data.results||[],gws=[...new Set((data.archives||[]).map(a=>a.gw))].sort((a,b)=>b-a);
 const summary=data.status!=='ready'?'<div class="notice">Arsip belum dapat diakses. Evaluasi sumber di bawah tetap tersedia.</div>':!gws.length?'<div class="notice">Belum ada snapshot sebelum deadline. Arsip dimulai dari pencatatan pertama; GW terdahulu tidak dibuat ulang.</div>':'<div class="archive-results">'+results.map(r=>'<article class="archive-result"><h3>'+esc(archiveSourceLabel(r))+'</h3><p>Dicatat '+esc(dashboardDate(Date.parse(r.captured_at)))+' · deadline '+esc(dashboardDate(Date.parse(r.deadline)))+'</p><p>Cakupan snapshot · GW'+data.gameweek+' · '+r.coverage+'/'+r.universe+' pemain · '+(r.status==='pending'?'Menunggu hasil final':r.status==='partial'?'Hasil aktual belum lengkap':'Hasil final')+(r.mae!=null?' · MAE '+fmt(r.mae,3):'')+'</p>'+(r.by_position?'<p class="adv-note">'+Object.entries(r.by_position).map(([pos,m])=>esc(positions[pos])+': '+m.count+'/'+m.coverage+' dinilai'+(m.mae!=null?' | MAE '+fmt(m.mae,3):'')).join(' | ')+'</p>':'')+'<details><summary>Bukti snapshot</summary><p class="archive-hash">SHA-256: '+esc(r.sha256)+'</p></details>'+(r.rows?.length?'<details open><summary>Prediksi dan hasil · '+r.count+' pemain dinilai</summary><div class="table-wrap"><table><thead><tr><th>Pemain</th><th>Prediksi</th><th>Aktual</th><th>Menit</th></tr></thead><tbody>'+r.rows.slice(archivePage(r)*10,(archivePage(r)+1)*10).map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+fmt(p.predicted,2)+'</td><td>'+fmt(p.actual)+'</td><td>'+fmt(p.minutes)+'</td></tr>').join('')+'</tbody></table></div><div class="archive-pages"><button class="btn small" data-archive-source="'+r.source+'" data-archive-page="-1"'+(!(archivePage(r)>0)?' disabled':'')+'>Previous</button><span>'+((archivePage(r))+1)+' / '+Math.ceil(r.rows.length/10)+'</span><button class="btn small" data-archive-source="'+r.source+'" data-archive-page="1"'+(((archivePage(r))+1)*10>=r.rows.length?' disabled':'')+'>Next</button></div></details>':'')+'</article>').join('')+'</div>';
 root.innerHTML=panel('Arsip prediksi dashboard','<p class="adv-note">Snapshot privat, dicatat server sebelum deadline dan tidak ditimpa. Belum memakai V6/V12. Capture dilakukan saat Overview dibuka atau tombol di bawah ditekan; tidak ada jadwal otomatis baru.</p><div class="archive-toolbar">'+(gws.length?'<label>Gameweek <select id="archiveGw">'+gws.map(g=>'<option value="'+g+'"'+(g===data.gameweek?' selected':'')+'>GW'+g+'</option>').join('')+'</select></label>':'')+'<button class="btn small" id="captureForecast"'+(archiveBusy?' disabled':'')+'>Catat prediksi GW berikutnya</button></div>'+summary,'Arsip internal terpisah dari evaluasi publik sumber di bawah.');
 $('captureForecast').onclick=()=>{if(archiveBusy)return;$('captureForecast').disabled=true;$('captureForecast').textContent='Mencatat…';loadForecastArchive(true);};if($('archiveGw'))$('archiveGw').onchange=e=>{ext.archivePages={};loadForecastArchive(false,Number(e.target.value));};
}
const phaseAccuracyBefore=renderAccuracy;renderAccuracy=async function(){try{await phaseAccuracyBefore();}catch{$('view-accuracy').innerHTML='<div class="notice">Evaluasi sumber belum tersedia; arsip dashboard diperiksa terpisah.</div>';}const node=document.createElement('section');node.id='forecastArchivePanel';$('view-accuracy').prepend(node);renderForecastArchive();loadForecastArchive();};
const phaseOverviewBefore=renderDashboardOverview;renderDashboardOverview=function(){phaseOverviewBefore();renderPhaseQuality();if(!phaseLoaded&&state.bootstrap){phaseLoaded=true;loadForecastArchive(true);}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-archive-page]');if(!b)return;ext.archivePages=ext.archivePages||{};const key=b.dataset.archiveSource;ext.archivePages[key]=Math.max(0,(ext.archivePages[key]||0)+Number(b.dataset.archivePage));renderForecastArchive();});
function newsTopic(h){
 const t=String(h||'').toLowerCase();
 if(/injur|doubt|fitness|ruled out|knock|setback|sidelined|miss(es|ing)?\b|absent|illness|suspen/.test(t))return {k:'fit',l:'Kabar kebugaran'};
 if(/return|back in|available|recover|cleared|fit again/.test(t))return {k:'back',l:'Kabar kembali bermain'};
 if(/squad|called up|call-up|named in|international/.test(t))return {k:'squad',l:'Panggilan skuad/timnas'};
 if(/rest|rotat|bench|start|line-?up|team news|xi\b|drop/.test(t))return {k:'xi',l:'Susunan pemain/rotasi'};
 if(/transfer|sign|deal|loan|contract|bid/.test(t))return {k:'tr',l:'Kabar transfer'};
 if(/goal|score|assist|hat-?trick|win|clean sheet|praise|shine|brace/.test(t))return {k:'perf',l:'Performa pemain'};
 return {k:'gen',l:'Berita pemain'};
}
function fplFacts(item,context){
 const st={a:'Tersedia',d:'Diragukan',i:'Cedera',s:'Skorsing',u:'Tidak tersedia',n:'Tidak aktif'},topic=newsTopic(item.article?.headline),ps=(item.players||[]).slice(0,3);
 const names=ps.map(p=>esc(p.web_name)+' ('+esc(state.teams[p.team]?.short_name||'?')+')').join(', ')||'pemain terkait';
 const own=ps.filter(p=>context?.own?.has(p.id)),flagged=ps.filter(p=>p.status&&p.status!=='a');
 const lines=[topic.l+' untuk '+names+(own.length?' — termasuk pemain di skuadmu':'')+'.'];
 ps.forEach(p=>{const bits=[st[p.status]||'status belum jelas'];if(p.chance_of_playing_next_round!=null)bits.push(fmt(p.chance_of_playing_next_round)+'% peluang tampil');if(p.news)bits.push(esc(p.news));if(Number.isFinite(Number(p.form)))bits.push('form '+fmt(p.form,1));if(Number.isFinite(Number(p.selected_by_percent)))bits.push('dimiliki '+fmt(p.selected_by_percent,1)+'%');lines.push('<strong>'+esc(p.web_name)+'</strong> di FPL: '+bits.join(' · ')+'.');});
 const advice=topic.k==='fit'?(flagged.length?'FPL sudah menandai flag; pantau pembaruan sebelum deadline.':'FPL belum menandai flag; verifikasi kabar sebelum menetapkan XI dan kapten.'):topic.k==='back'?'Cek peluang tampil resmi sebelum memasukkannya ke XI.':topic.k==='xi'?'Rotasi bisa memengaruhi menit main; cek susunan resmi dekat kick-off.':topic.k==='tr'?'Belum berdampak ke FPL sampai pemain tampil; pantau menit mainnya.':topic.k==='perf'?'Performa lampau; nilai masa depan tetap bergantung fixture dan menit main.':'Pantau dampaknya pada menit main dan fixture.';
 lines.push('<em>Dampak FPL:</em> '+advice);
 return lines.join('<br>')+'<br><small>Ringkasan otomatis dari judul dan data Official FPL; buka sumber untuk isi lengkap.</small>';
}
// Headline expands inline; only the source opens the original publisher.
const phaseNewsArticleBefore=dashboardNewsArticle;dashboardNewsArticle=function(item,context){
 const html=phaseNewsArticleBefore(item,context);if(item.kind!=='article')return html;
 const article=item.article,href=/^https:\/\//.test(article.url||'')?article.url:null;
 const snippet=String(article.summary||article.snippet||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const content='<details class="inline-news-details"><summary>'+esc(article.headline)+'</summary><div class="news-summary">'+fplFacts(item,context)+'</div></details>';
 return html.replace(/<h3>[\s\S]*?<\/h3>/,content).replace('<small>'+esc(article.source||'The Guardian'),'<small>'+(href?'<a class="news-source-link" href="'+esc(href)+'" target="_blank" rel="noopener">'+esc(article.source||'The Guardian')+' ↗</a>':esc(article.source||'The Guardian')));
};
renderPhaseQuality();renderDashboardNews();
const heroValue=document.createElement('aside');heroValue.className='hero-team-value';heroValue.setAttribute('aria-label','Nilai pasar skuad');document.querySelector('.team-hero-top').append(heroValue);
function renderHeroValue(){const squad=currentSquad(),complete=squad.length===15&&squad.every(p=>Number.isFinite(Number(p.now_cost))),total=complete?squad.reduce((n,p)=>n+Number(p.now_cost),0):null;heroValue.innerHTML='<div><span>NILAI PASAR SKUAD</span><strong>'+ (total==null?'—':money(total))+'</strong></div><div><span>BANK PUBLIK · GW'+(state.gw||'—')+'</span><strong>'+ (state.picks?.entry_history?.bank==null?'—':money(state.picks.entry_history.bank))+'</strong></div><small>Harga FPL saat dicek · bukan nilai jual aktual</small>';}
const valueHeroBefore=updateDashboardHero;updateDashboardHero=function(){valueHeroBefore();renderHeroValue();};renderHeroValue();
