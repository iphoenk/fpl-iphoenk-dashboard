/* Decision-first dashboard: uses canonical FPL data; never synthesizes results. */
(function(){
  'use strict';
  const root=document.getElementById('dashboardLayout');
  if(!root||document.getElementById('decisionFirst'))return;
  const stage=document.createElement('section');
  stage.id='decisionFirst';
  stage.className='decision-first';
  stage.setAttribute('aria-label','Current team, selected league and next gameweek');
  root.querySelector('.team-hero')?.after(stage);
  const deep=document.createElement('details');
  deep.className='decision-deep';
  deep.innerHTML='<summary>Analisis tambahan Beranda <span>Berita pemain, formasi, fixture runs dan scouting</span></summary><div class="decision-deep-content"></div>';
  root.append(deep);
  const deepContent=deep.querySelector('.decision-deep-content');
  for(const selector of ['.overview-controls','.dashboard-brief','.overview-gw-switch','.approved-local-tabs','.next-gw-overview','.dashboard-columns','#dashboardPool']){
    const el=root.querySelector(':scope > '+selector);
    if(el)deepContent.append(el);
  }
  const safeName=(x)=>typeof esc==='function'?esc(String(x??'')):String(x??'').replace(/[&<>"']/g,'');
  const number=(n)=>Number.isFinite(Number(n))?fmt(Number(n)):'—';
  const leagueList=()=>state.entry?.leagues?.classic||[];
  const currentLeagueId=()=>{
    const leagues=leagueList();
    const saved=!state.visitingTeam&&state.entry?safeRead('fpl-iphoenk-league-'+state.entry.id,null):null;
    const possible=[saved,state.league?.league?.id,leagues[0]?.id].map(Number);
    return possible.find(id=>leagues.some(l=>Number(l.id)===id))||null;
  };
  const availability=(p)=>p?.status==='a'?'Available':p?.chance_of_playing_next_round!=null?String(p.chance_of_playing_next_round)+'%':'Check fitness';
  function pitchCard(){
    const actualPitch=document.getElementById('pitch'),actualBench=document.getElementById('bench');
    const picks=state.picks?.picks||[];
    const cap=picks.find(p=>p.is_captain),vice=picks.find(p=>p.is_vice_captain);
    const flags=picks.map(p=>state.players[p.element]).filter(p=>p&&p.status!=='a');
    const pitch=actualPitch?.innerHTML||'<div class="decision-empty">Starting XI is loading.</div>';
    const bench=actualBench?.innerHTML||'<div class="decision-empty">Bench is loading.</div>';
    return '<article class="decision-panel decision-team"><header class="decision-panel-head"><div><h2>Potret Tim Sekarang</h2><p>Starting XI dan bench dari pilihan publik GW '+safeName(state.gw||'—')+'</p></div><button class="decision-link" data-goto="tim">Detail skuad ↗</button></header>'+
      '<div class="decision-pitch"><div class="pitch">'+pitch+'</div></div>'+
      '<div class="decision-bench"><strong>Bench · '+picks.filter(p=>p.position>11).length+' pemain</strong><div class="bench-row">'+bench+'</div></div>'+
      '<footer class="decision-foot"><span>Captain: <strong>'+safeName(state.players[cap?.element]?.web_name||'—')+'</strong></span><span>Vice: <strong>'+safeName(state.players[vice?.element]?.web_name||'—')+'</strong></span><span>'+flags.length+' fitness flag</span></footer></article>';
  }
  function leagueCard(){
    const leagues=leagueList(),selected=currentLeagueId(),listed=leagues.find(l=>Number(l.id)===selected);
    const active=Number(state.league?.league?.id)===selected?state.league:null;
    const rows=active?.standings?.results||[];
    const ownId=String(state.entry?.id||'');
    const me=rows.find(x=>String(x.entry)===ownId);
    const rank=me?.rank??listed?.entry_rank??null;
    const leader=active&&state.leaguePage===1?rows[0]:null;
    const gap=leader&&me?Math.max(0,Number(leader.total)-Number(me.total)):null;
    let neighbors=[];
    if(me){const pos=rows.indexOf(me);neighbors=rows.slice(Math.max(0,pos-2),Math.min(rows.length,pos+3));}
    else neighbors=rows.slice(0,5);
    const list=leagues.map(l=>'<option value="'+l.id+'"'+(Number(l.id)===selected?' selected':'')+'>'+safeName(l.name)+'</option>').join('');
    const status=active?'Halaman '+state.leaguePage+' · '+rows.length+' peserta dimuat':'Klasemen belum dimuat';
    const lines=neighbors.map(r=>'<tr'+(String(r.entry)===ownId?' class="decision-mine"':'')+'><td>'+number(r.rank)+'</td><td class="decision-team-name"><button data-team="'+r.entry+'">'+safeName(r.entry_name)+'</button></td><td>'+number(r.event_total)+'</td><td>'+number(r.total)+'</td><td>'+safeName(r.last_rank?(r.last_rank-r.rank>0?'↑ '+(r.last_rank-r.rank):r.last_rank-r.rank<0?'↓ '+(r.rank-r.last_rank):'—'):'—')+'</td></tr>').join('');
    return '<article class="decision-panel decision-league"><header class="decision-panel-head"><div><h2>Mini-league Snapshot</h2><p>Ganti liga tanpa meninggalkan Beranda</p></div><button class="decision-link" data-goto="liga">Klasemen ↗</button></header>'+
      '<label class="decision-league-label" for="decisionLeagueSelect">Liga dipilih</label><select id="decisionLeagueSelect"'+(!leagues.length?' disabled':'')+'>'+(!leagues.length?'<option>Hubungkan tim FPL</option>':list)+'</select>'+
      '<div class="decision-league-kpis"><div><span>Posisi saya</span><strong>'+(rank!=null?number(rank):'—')+'</strong></div><div><span>Gap leader</span><strong>'+(gap!=null?number(gap)+' pts':'—')+'</strong></div><div><span>GW</span><strong>'+number(state.picks?.entry_history?.points)+'</strong></div></div>'+
      '<div class="decision-table-wrap"><table><thead><tr><th>Rank</th><th>Tim</th><th>GW</th><th>Total</th><th>Trend</th></tr></thead><tbody>'+(lines||'<tr><td colspan="5" class="decision-empty">Pilih liga untuk memuat peserta</td></tr>')+'</tbody></table></div>'+
      '<footer class="decision-foot"><span>'+safeName(listed?.name||'Classic League')+'</span><span>'+safeName(status)+'</span></footer></article>';
  }
  function planCard(){
    const picks=state.picks?.picks||[],gw=state.next?.id;
    const cap=picks.find(p=>p.is_captain),vice=picks.find(p=>p.is_vice_captain);
    const name=id=>safeName(state.players[id]?.web_name||'—');
    const first=cap?.element,second=vice?.element;
    let projected=null;
    const starters=picks.filter(p=>p.position<=11).map(p=>state.players[p.element]).filter(Boolean);
    if(starters.length===11&&starters.every(p=>typeof xp==='function'&&xp(p)!==null)){
      const score=teamPrediction(starters,1);if(Number.isFinite(score))projected=score;
    }
    let candidates=[];
    if(typeof dashboardNewsContext==='function'){
      try{const context=dashboardNewsContext();candidates=[...(context.candidates||new Map()).entries()].filter(([id,m])=>m&&state.players[id]&&Number.isFinite(Number(m.gain))).slice(0,2);}
      catch(_){}
    }
    const best=candidates[0],next=candidates[1];
    const scenario=(label,mode,pair,caption)=>{
      const player=pair?state.players[pair[0]]:null,delta=pair&&Number.isFinite(Number(pair[1].gain))?Number(pair[1].gain):null;
      const out=pair?pair[1].out:null;
      return '<div class="decision-scenario"><div class="decision-scenario-title"><strong>'+safeName(label)+'</strong><span>'+safeName(mode)+'</span></div>'+
        '<div class="decision-scenario-projection"><span>Projected XI</span><strong>'+(projected!==null&&mode==='Hold'?fmt(projected,1)+' xP':'—')+'</strong></div>'+
        '<p>'+(player&&out?safeName(out)+' → '+safeName(player.web_name):safeName(caption))+'</p>'+
        '<small>'+(delta!=null?'Candidate gain +'+fmt(delta,1)+' xP, before hits':'Perlu simulasi dan validasi prediksi')+'</small>'+
        '<div class="decision-captains"><span><b>C</b> '+name(first)+'</span><span><b>VC</b> '+name(second)+'</span></div>'+
        '<button class="decision-action" data-goto="'+(mode==='Hold'?'planning':'transfers')+'">Analisis skenario ↗</button></div>';
    };
    return '<article class="decision-panel decision-plan"><header class="decision-panel-head"><div><h2>Plan Next GW'+(gw?' · GW '+gw:'')+'</h2><p>Alternatif berbasis FPL dan model, bukan perubahan otomatis di akun FPL</p></div><button class="decision-link" data-goto="planning">Buka Planner ↗</button></header>'+
      '<div class="decision-scenarios">'+scenario('A · Hold','Hold',null,'Pertahankan 15 pemain dan optimalkan XI')+scenario('B · 1 Transfer','1 Transfer',best,'Kandidat terverifikasi belum tersedia')+scenario('C · Alternatif','Compare',next,'Bandingkan perubahan lain di Planner')+'</div>'+
      '<footer class="decision-foot"><span>Bank publik: '+safeName(state.picks?.entry_history?money(state.picks.entry_history.bank):'—')+'</span><span>Transfer dan XI GW berikutnya tidak tersedia lewat Entry ID publik</span></footer></article>';
  }
  function renderDecision(){
    if(!stage.isConnected)return;
    const ready=!!(state.entry&&state.picks);
    stage.hidden=!ready;
    if(!ready)return;
    stage.innerHTML='<div class="decision-primary">'+pitchCard()+leagueCard()+'</div>'+planCard();
  }
  const initialHero=updateDashboardHero;
  updateDashboardHero=function(){initialHero();renderDecision();};
  const initialPitch=renderPitch;
  renderPitch=function(){initialPitch();renderDecision();};
  const initialLoadLeague=loadLeague;
  loadLeague=async function(id,page=1){const response=await initialLoadLeague(id,page);renderDecision();return response;};
  const initialLoadTeam=loadTeam;
  loadTeam=async function(raw,gw=state.gw,options={}){
    const response=await initialLoadTeam(raw,gw,options);
    renderDecision();
    const id=currentLeagueId();
    if(state.entry&&!state.visitingTeam&&id&&(!state.league||Number(state.league.league.id)!==id))await loadLeague(id);
    return response;
  };
  document.addEventListener('change',e=>{
    if(e.target?.id!=='decisionLeagueSelect')return;
    const id=Number(e.target.value);
    if(!leagueList().some(l=>Number(l.id)===id))return;
    if(!state.visitingTeam)safeWrite('fpl-iphoenk-league-'+state.entry.id,id);
    loadLeague(id);
  });
  renderDecision();
})();
