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
  const number=(n)=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?fmt(Number(n)):'—';
  const leagueList=()=>state.entry?.leagues?.classic||[];
  const currentLeagueId=()=>{
    const leagues=leagueList();
    const saved=!state.visitingTeam&&state.entry?safeRead('fpl-iphoenk-league-'+state.entry.id,null):null;
    const possible=[saved,state.league?.league?.id,leagues[0]?.id].map(Number);
    return possible.find(id=>leagues.some(l=>Number(l.id)===id))||null;
  };
  const availability=(p)=>p?.status==='a'?'Available':p?.chance_of_playing_next_round!=null?String(p.chance_of_playing_next_round)+'%':'Check fitness';
  // Official classic standings contain up to 50 teams per page. Show ten at a time.
  function leagueBlockStart(rank){const n=Number(rank);return Number.isInteger(n)&&n>0?Math.floor((n-1)/10)*10+1:1;}
  function leagueStandingsPage(block){return Math.floor((block-1)/50)+1;}
  function leagueBlockRows(rows,block){const i=(block-1)%50;return rows.slice(i,i+10);}
  const validLeagueNumber=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
  const snapshot={leagueId:null,entryId:null,blockStart:1,leader:null,own:null,local:null,loading:false,error:null,request:0};
  const standingsCache=new Map();
  const leagueMember=id=>leagueList().find(l=>Number(l.id)===Number(id));
  async function fetchStandingsPage(id,page){
    const key=id+':'+page+':'+state.gw,prev=standingsCache.get(key);
    if(prev&&Date.now()-prev.time<120000)return prev.promise;
    const promise=api('leagues-classic/'+id+'/standings/?page_standings='+page).then(data=>{
      if(Number(data?.league?.id)!==Number(id)||!Array.isArray(data?.standings?.results))throw Error('Data klasemen tidak cocok.');
      return data;
    }).catch(e=>{standingsCache.delete(key);throw e;});
    standingsCache.set(key,{time:Date.now(),promise});return promise;
  }
  async function refreshLeagueSnapshot(id=currentLeagueId(),block=null){
    if(!state.entry||!id||!leagueMember(id))return;
    const entryId=String(state.entry.id),member=leagueMember(id);
    const switched=Number(snapshot.leagueId)!==Number(id)||String(snapshot.entryId)!==entryId;
    const rank=validLeagueNumber(member.entry_rank);
    const start=block!==null?leagueBlockStart(block):switched?leagueBlockStart(rank):snapshot.blockStart;
    const token=++snapshot.request;
    Object.assign(snapshot,{leagueId:Number(id),entryId,blockStart:start,loading:true,error:null,local:null,
      ...(switched?{leader:null,own:null}:{})});
    renderDecision();
    try{
      // Page 1 supplies the leader; page 6 (for rank 274) supplies positions 271–280.
      const [top,local]=await Promise.all([fetchStandingsPage(id,1),fetchStandingsPage(id,leagueStandingsPage(start))]);
      if(token!==snapshot.request||String(state.entry?.id)!==entryId||currentLeagueId()!==Number(id))return;
      const head=top.standings.results[0],own=local.standings.results.find(x=>String(x.entry)===entryId)
        ||top.standings.results.find(x=>String(x.entry)===entryId)||snapshot.own;
      Object.assign(snapshot,{leader:Number(head?.rank)===1?head:null,own:own||null,local,loading:false,error:null});
    }catch(error){
      if(token!==snapshot.request)return;
      Object.assign(snapshot,{local:null,loading:false,error:error?.message||'Gagal memuat klasemen'});
    }
    renderDecision();
  }
  function changeLeagueBlock(direction){
    if(snapshot.loading)return;
    const start=snapshot.blockStart+Number(direction)*10;
    if(start<1)return;
    const current=snapshot.local,rows=current?.standings?.results||[];
    if(direction>0&&current&&!current.standings.has_next&&
       leagueStandingsPage(start)>leagueStandingsPage(snapshot.blockStart))return;
    if(direction>0&&current&&leagueStandingsPage(start)===leagueStandingsPage(snapshot.blockStart)&&!leagueBlockRows(rows,start).length)return;
    refreshLeagueSnapshot(currentLeagueId(),start);
  }
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
    const leagues=leagueList(),selected=currentLeagueId(),member=leagueMember(selected),ownId=String(state.entry?.id||'');
    const active=Number(snapshot.leagueId)===Number(selected)&&String(snapshot.entryId)===ownId?snapshot:null;
    const rank=validLeagueNumber(active?.own?.rank)??validLeagueNumber(member?.entry_rank);
    const block=active?.blockStart??leagueBlockStart(rank),page=leagueStandingsPage(block);
    const local=active&&!active.loading&&active.local?active.local:null;
    const rows=local?leagueBlockRows(local.standings.results,block):[];
    const total=validLeagueNumber(active?.own?.total),leader=validLeagueNumber(active?.leader?.total);
    const gap=total!==null&&leader!==null?Math.max(0,leader-total):null;
    const options=leagues.map(l=>'<option value="'+Number(l.id)+'"'+(Number(l.id)===selected?' selected':'')+'>'+safeName(l.name)+'</option>').join('');
    const lines=rows.map(r=>{
      const previous=validLeagueNumber(r.last_rank),current=validLeagueNumber(r.rank);
      const delta=previous!==null&&current!==null?previous-current:null;
      return '<tr'+(String(r.entry)===ownId?' class="decision-mine" aria-current="true"':'')+'><td>'+number(r.rank)+'</td><td class="decision-team-name"><button data-team="'+Number(r.entry)+'">'+safeName(r.entry_name)+'</button></td><td>'+number(r.event_total)+'</td><td>'+number(r.total)+'</td><td>'+(delta===null?'—':delta>0?'↑ '+number(delta):delta<0?'↓ '+number(-delta):'—')+'</td></tr>';
    }).join('');
    const end=block+Math.max(0,rows.length?rows.length-1:9);
    const atEnd=local&&!local.standings.has_next&&!leagueBlockRows(local.standings.results,block+10).length&&leagueStandingsPage(block+10)>=page;
    const status=active?.loading?'Memuat blok '+block+'–'+(block+9)+'…':active?.error?'Gagal memuat: '+safeName(active.error):local?'Peringkat '+block+'–'+end+' · halaman FPL '+page:'Klasemen belum dimuat';
    return '<article class="decision-panel decision-league"><header class="decision-panel-head"><div><h2>Mini-league Snapshot</h2><p>10 tim sesuai posisi di liga terpilih</p></div><button class="decision-link" data-goto="liga">Klasemen ↗</button></header>'+
      '<label class="decision-league-label" for="decisionLeagueSelect">Liga dipilih</label><select id="decisionLeagueSelect"'+(!leagues.length?' disabled':'')+'>'+(!leagues.length?'<option>Hubungkan tim FPL</option>':options)+'</select>'+
      '<div class="decision-league-kpis"><div><span>Posisi saya</span><strong>'+number(rank)+'</strong></div><div><span>Gap leader</span><strong>'+(gap!==null?number(gap)+' pts':'—')+'</strong></div><div><span>GW</span><strong>'+number(state.picks?.entry_history?.points)+'</strong></div></div>'+
      '<div class="decision-league-toolbar"><span>Tim '+block+'–'+end+'</span><div class="decision-league-arrows"><button type="button" data-league-block="-1" aria-label="10 tim sebelumnya"'+(block===1||active?.loading?' disabled':'')+'>←</button><button type="button" data-league-block="1" aria-label="10 tim berikutnya"'+(atEnd||active?.loading?' disabled':'')+'>→</button></div></div>'+
      '<div id="decisionLeagueSwipe" class="decision-table-wrap" role="region" tabindex="0" aria-label="Klasemen 10 tim, swipe horizontal untuk berpindah blok"><table><thead><tr><th>Rank</th><th>Tim</th><th>GW</th><th>Total</th><th>Trend</th></tr></thead><tbody>'+(lines||'<tr><td colspan="5" class="decision-empty">'+(active?.loading?'Memuat 10 tim…':active?.error?'Klasemen gagal dimuat, gunakan panah untuk mencoba lagi.':'Pilih liga untuk memuat peserta')+'</td></tr>')+'</tbody></table></div>'+
      '<footer class="decision-foot"><span>'+safeName(member?.name||'Classic League')+'</span><span>'+status+'</span></footer></article>';
  }
  const publicPlan={entryId:null,gw:null,horizon:3,loading:false,report:null,request:0};
  async function refreshPublicPlan(){
    const id=Number(state.entry?.id),gw=Number(state.next?.id);
    if(!id||!gw)return;
    const token=++publicPlan.request,selectedHorizon=publicPlan.horizon;
    Object.assign(publicPlan,{entryId:id,gw,loading:true,report:null});
    renderDecision();
    try{
      const report=await api('decision?entry_id='+id+'&horizon='+publicPlan.horizon);
      if(token!==publicPlan.request||Number(state.entry?.id)!==id||Number(state.next?.id)!==gw||selectedHorizon!==publicPlan.horizon)return;
      if(Number(report?.entry_id)!==id||Number(report?.planning_gw)!==gw||
        !['PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1','PUBLIC_FPL_MULTIGW_ADVISORY_V2'].includes(report?.contract)||report?.canonical_v12!==false||report?.monte_carlo!==false||
        (report.contract==='PUBLIC_FPL_MULTIGW_ADVISORY_V2'&&report.horizon!==selectedHorizon))throw Error('Invalid public decision context');
      publicPlan.report=report;
    }catch(_){if(token===publicPlan.request)publicPlan.report=null;}
    if(token===publicPlan.request){publicPlan.loading=false;renderDecision();}
  }
  function planCard(){
    const gw=Number(state.next?.id),report=publicPlan.entryId===Number(state.entry?.id)&&publicPlan.gw===gw?publicPlan.report:null;
    const name=id=>safeName(state.players[id]?.web_name||'—');
    const scenario=(key,label)=>{
      const s=report?.scenarios?.[key];
      if(!s)return '<div class="decision-scenario"><div class="decision-scenario-title"><strong>'+label+'</strong><span>—</span></div><p class="decision-scenario-move">'+(publicPlan.loading?'Loading Official FPL advisory…':'No validated option available')+'</p><small class="decision-scenario-note">Unverified numbers are not displayed</small></div>';
      const changes=s.changes?.length?s.changes.map(c=>safeName(c.out.web_name)+' → '+safeName(c.in.web_name)).join(' · '):'Keep all 15 · optimize XI';
      const delta=s.transfers?' · Gross Δ '+(s.gross_gain_vs_hold>0?'+':'')+fmt(s.gross_gain_vs_hold,1)+' xP':'';
      return '<div class="decision-scenario"><div class="decision-scenario-title"><strong>'+label+'</strong><span>'+fmt(s.expected_points,1)+' xP</span></div>'+
        '<p class="decision-scenario-move">'+changes+'</p><div class="decision-scenario-bottom">'+
        '<div class="decision-captains"><span><b>C</b> '+name(s.captain)+'</span><span><b>VC</b> '+name(s.vice_captain)+'</span></div>'+
        '<button class="decision-action" data-goto="'+(s.transfers?'transfers':'planning')+'">Analyse ↗</button></div>'+
        '<small class="decision-scenario-note">GW '+gw+' · '+safeName(s.formation)+delta+' · No verified FT/hit</small></div>';
    };
    return '<article class="decision-panel decision-plan"><header class="decision-panel-head"><div><h2>Plan Next GW'+(gw?' · GW '+gw:'')+'</h2><p>'+(report?.contract==='PUBLIC_FPL_MULTIGW_ADVISORY_V2'?'Public model · V12-informed deterministic':'Official FPL 1-GW fallback')+' · no Monte Carlo</p></div><button class="decision-link" data-goto="planning">Planner ↗</button></header>'+
      '<div class="decision-horizon">Horizon <select id="decisionHorizonSelect" aria-label="Horizon optimasi">'+[1,3,5].map(h=>'<option value="'+h+'"'+(publicPlan.horizon===h?' selected':'')+'>'+h+' GW</option>').join('')+'</select> <span>'+(report?.evidence?.model_built_at?'Snapshot '+safeName(report.evidence.model_built_at.slice(0,16)):'Official fallback / source unavailable')+'</span></div><div class="decision-scenarios">'+scenario('A','A · Hold')+scenario('B','B · 1 Transfer')+scenario('C','C · 2 Transfers')+'</div>'+
      '<footer class="decision-foot"><span>'+(report?safeName(report.economics_status):'Official data pending')+'</span><span>No login · Not canonical V12 · No invented transfer hits</span></footer></article>';
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
  loadLeague=async function(id,page=1){
    const response=await initialLoadLeague(id,page);
    if(leagueMember(id)&&state.entry&&!state.visitingTeam){
      safeWrite('fpl-iphoenk-league-'+state.entry.id,Number(id));
      refreshLeagueSnapshot(Number(id));
    }
    renderDecision();return response;
  };
  const initialLoadTeam=loadTeam;
  loadTeam=async function(raw,gw=state.gw,options={}){
    const response=await initialLoadTeam(raw,gw,options);
    renderDecision();
    const id=currentLeagueId();
    if(state.entry&&id)refreshLeagueSnapshot(id);
    if(state.entry&&!state.visitingTeam)refreshPublicPlan();
    return response;
  };
  document.addEventListener('change',e=>{
    if(e.target?.id==='decisionHorizonSelect'){
      const h=Number(e.target.value);if([1,3,5].includes(h)){publicPlan.horizon=h;refreshPublicPlan();}return;
    }
    if(e.target?.id!=='decisionLeagueSelect')return;
    const id=Number(e.target.value);
    if(!leagueList().some(l=>Number(l.id)===id))return;
    if(!state.visitingTeam)safeWrite('fpl-iphoenk-league-'+state.entry.id,id);
    if(document.getElementById('leagueSelect'))document.getElementById('leagueSelect').value=id;
    refreshLeagueSnapshot(id);
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-league-block]');
    if(b){changeLeagueBlock(Number(b.dataset.leagueBlock));return;}
    if(e.target.closest?.('.decision-league [data-goto="liga"]')&&currentLeagueId())
      loadLeague(currentLeagueId(),leagueStandingsPage(snapshot.blockStart));
  });
  let touch=null;
  document.addEventListener('touchstart',e=>{
    if(e.touches.length===1&&e.target.closest?.('#decisionLeagueSwipe'))touch={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!touch||!e.target.closest?.('#decisionLeagueSwipe')){touch=null;return;}
    const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;
    touch=null;
    if(Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.4)changeLeagueBlock(dx<0?1:-1);
  },{passive:true});
  document.addEventListener('keydown',e=>{
    if(!e.target.closest?.('#decisionLeagueSwipe')||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();changeLeagueBlock(e.key==='ArrowRight'?1:-1);
  });
  renderDecision();
})();
