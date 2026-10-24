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
  deep.innerHTML='<summary>Additional Overview analysis <span>Player news, formations, fixture runs and scouting</span></summary><div class="decision-deep-content"></div>';
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
      if(Number(data?.league?.id)!==Number(id)||!Array.isArray(data?.standings?.results))throw Error('Standings data mismatch.');
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
      Object.assign(snapshot,{local:null,loading:false,error:error?.message||'Failed to load standings'});
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
    return '<article class="decision-panel decision-team"><header class="decision-panel-head"><div><h2>Current Team</h2><p>Starting XI and bench from published GW '+safeName(state.gw||'—')+'</p></div><button class="decision-link" data-goto="tim">Squad details ↗</button></header>'+
      '<div class="decision-pitch"><div class="pitch">'+pitch+'</div></div>'+
      '<div class="decision-bench"><strong>Bench · '+picks.filter(p=>p.position>11).length+' players</strong><div class="bench-row">'+bench+'</div></div>'+
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
    const status=active?.loading?'Loading…':active?.error?'Failed to load':local?'Rank '+block+'–'+end+' · P '+page:'Standings not loaded';
    return '<article class="decision-panel decision-league"><header class="decision-panel-head"><div><h2>Mini-league Snapshot</h2><p>Ten teams around your rank in the selected league</p></div><button class="decision-link" data-goto="liga">Standings ↗</button></header>'+
      '<label class="decision-league-label" for="decisionLeagueSelect">Selected league</label><select id="decisionLeagueSelect"'+(!leagues.length?' disabled':'')+'>'+(!leagues.length?'<option>Connect an FPL team</option>':options)+'</select>'+
      '<div class="decision-league-kpis"><div><span>My rank</span><strong>'+number(rank)+'</strong></div><div><span>Gap to leader</span><strong>'+(gap!==null?number(gap)+' pts':'—')+'</strong></div><div><span>GW gross</span><strong>'+number(state.picks?.entry_history?.points)+'</strong>'+(Number(state.picks?.entry_history?.event_transfers_cost)>0?'<small>Hit −'+number(state.picks.entry_history.event_transfers_cost)+' · net '+number(Number(state.picks.entry_history.points)-Number(state.picks.entry_history.event_transfers_cost))+'</small>':'')+'</div></div>'+
      
      '<div id="decisionLeagueSwipe" class="decision-table-wrap" role="region" tabindex="0" aria-label="Ten-team standings; swipe horizontally to navigate rank ranges"><table><thead><tr><th>Rank</th><th>Team</th><th title="GW: gross points before transfer hits">GW</th><th>Total</th><th>Trend</th></tr></thead><tbody>'+(lines||'<tr><td colspan="5" class="decision-empty">'+(active?.loading?'Loading ten teams…':active?.error?'Could not load standings. Use the arrows to retry.':'Select a league to load teams')+'</td></tr>')+'</tbody></table></div>'+
      '<footer class="decision-foot decision-league-foot"><span class="decision-league-name" title="'+safeName(member?.name||'Classic League')+'">'+safeName(member?.name||'Classic League')+'</span><span class="decision-league-status" aria-live="polite" title="'+safeName(active?.error||'')+'">'+status+'</span><div class="decision-league-arrows" aria-label="Rank range navigation"><button type="button" data-league-block="-1" aria-label="Previous ten teams"'+(block===1||active?.loading?' disabled':'')+'>←</button><button type="button" data-league-block="1" aria-label="Next ten teams"'+(atEnd||active?.loading?' disabled':'')+'>→</button></div></footer></article>';
  }
  const publicPlan={entryId:null,gw:null,horizon:1,loading:false,report:null,error:null,request:0};
  function sameSquad(a,b){
    const left=(a||[]).map(p=>Number(p.element??p)).filter(Number.isInteger).sort((x,y)=>x-y);
    const right=(b||[]).map(p=>Number(p.element??p)).filter(Number.isInteger).sort((x,y)=>x-y);
    return left.length===15&&right.length===15&&left.every((id,i)=>id===right[i]);
  }
  function decisionMatchesActiveTeam(report,id,gw){
    const team=report?.team_state;
    if(!team)return true;
    return Number(team.requested_entry_id)===id&&Number(team.entry_id)===id&&
      Number(team.planning_gameweek)===gw&&sameSquad(team.squad,state.picks?.picks);
  }
  async function refreshPublicPlan(){
    const id=Number(state.entry?.id),gw=Number(state.next?.id);
    if(!id||!gw)return;
    const token=++publicPlan.request,selectedHorizon=publicPlan.horizon;
    Object.assign(publicPlan,{entryId:id,gw,loading:true,report:null,error:null});
    renderDecision();
    try{
      const report=await api('decision?entry_id='+id+'&horizon='+publicPlan.horizon);
      if(token!==publicPlan.request||Number(state.entry?.id)!==id||Number(state.next?.id)!==gw||selectedHorizon!==publicPlan.horizon)return;
      if(report?.status==='unavailable'){publicPlan.report=report;publicPlan.loading=false;renderDecision();return;}
      if(Number(report?.entry_id)!==id||Number(report?.planning_gw)!==gw||!decisionMatchesActiveTeam(report,id,gw)||
        !['PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1','PUBLIC_FPL_MULTIGW_ADVISORY_V2'].includes(report?.contract)||report?.canonical_v12!==false||report?.monte_carlo!==false||
        (report.contract==='PUBLIC_FPL_MULTIGW_ADVISORY_V2'&&report.horizon!==selectedHorizon))throw Error('Invalid public decision context');
      publicPlan.report=report;
    }catch(error){if(token===publicPlan.request){publicPlan.report=null;publicPlan.error=error?.message||'Source not accessible';}}
    if(token===publicPlan.request){
      publicPlan.loading=false;renderDecision();
      // Single source of truth for transfer recommendations across the app:
      // any other card/page that claims a "best transfer" must read this,
      // not recompute its own ranking from a different model/snapshot.
      ext.publicDecision={entryId:publicPlan.entryId,gw:publicPlan.gw,report:publicPlan.report,error:publicPlan.error};
      document.dispatchEvent(new CustomEvent('fpl:decision-updated'));
      if(typeof renderDashboardBrief==='function')renderDashboardBrief();
    }
  }
  function planCard(){
    const gw=Number(state.next?.id),report=publicPlan.entryId===Number(state.entry?.id)&&publicPlan.gw===gw?publicPlan.report:null;
    const modelReady=report?.contract==='PUBLIC_FPL_MULTIGW_ADVISORY_V2';
    const actualHorizon=modelReady?Number(report.horizon):1;
    const weekLabel='GW '+gw+(actualHorizon>1?'–'+Math.min(38,gw+actualHorizon-1):'');
    const modelStamp=report?.evidence?.model_built_at?deviceDateTime(report.evidence.model_built_at):null;
    const generated=report?.generated_at?deviceDateTime(report.generated_at):null;
    const account=report?.team_state;
    const accountLine=account?'<small class="decision-plan-account">Free transfers: <strong>'+number(account.free_transfers)+'</strong> · Bank: <strong>'+money(account.bank)+'</strong> · Hit cost: '+(account.hit_cost==null?'not verified':number(account.hit_cost))+'</small>':'';
    const scope=publicPlan.loading?'Fetching Official FPL data…':modelReady?
      'Public model projection '+actualHorizon+' GW · not canonical V12':report?.status==='unavailable'?
      'Validated prediction not yet available':'Official FPL fallback, 1 GW coverage';
    const name=id=>safeName(state.players[id]?.web_name||'—');
    const missingReason=key=>{
      if(publicPlan.loading)return 'Loading official sources and validating scenarios…';
      if(publicPlan.error)return 'Failed to fetch data: '+safeName(publicPlan.error);
      if(report?.status==='unavailable')return 'Not available: '+safeName(report.reason||report.error||'Official FPL prediction incomplete');
      if(!report)return 'No validated data yet for this gameweek';
      if(report?.economics_status==='UNAVAILABLE'&&key!=='A')return 'Historical balance or public price not available; affordability cannot yet be assessed';
      return key==='A'?'Hold calculation not yet available':'No legal transfer package with a positive xP gain found yet';
    };
    const scenario=(key,label)=>{
      const s=report?.scenarios?.[key];
      if(!s)return '<div class="decision-scenario"><div class="decision-scenario-title"><strong>'+label+'</strong><span>—</span></div><p class="decision-scenario-move">'+missingReason(key)+'</p><small class="decision-scenario-note">No fabricated projection values</small></div>';
      const changes=s.changes?.length?s.changes.map(c=>safeName(c.out.web_name)+' → '+safeName(c.in.web_name)).join(' · '):'Keep all 15 players · optimize XI';
      const delta=s.transfers?' · Gross difference vs Hold '+(s.gross_gain_vs_hold>0?'+':'')+fmt(s.gross_gain_vs_hold,1)+' xP':'';
      return '<div class="decision-scenario"><div class="decision-scenario-title"><strong>'+label+'</strong><span>'+fmt(s.expected_points,1)+' xP</span></div>'+
        '<p class="decision-scenario-move">'+changes+'</p><div class="decision-scenario-bottom">'+
        '<div class="decision-captains"><span><b>C</b> '+name(s.captain)+'</span><span><b>VC</b> '+name(s.vice_captain)+'</span></div>'+
        '<button class="decision-action" data-goto="'+(s.transfers?'transfers':'planning')+'">Analysis ↗</button></div>'+
        '<small class="decision-scenario-note">'+weekLabel+' · Formation '+safeName(s.formation)+delta+' · '+(report?.team_state?.free_transfers!==null&&report?.team_state?.free_transfers!==undefined?'FT '+number(report.team_state.free_transfers)+' · hit cost remains unverified':'FT not verified')+'</small></div>';
    };
    const economicsLabel={PUBLIC_CURRENT_PRICE_PROXY_INDICATIVE:'Sale price proxy · verify before transfer',PUBLIC_HISTORICAL_INDICATIVE:'Historical price/bank · indicative',UNAVAILABLE:'Affordability not verified'}[report?.economics_status]|| (report?.economics_status?'Economics status · verify before transfer':report?.status==='unavailable'?'Projection unavailable':publicPlan.error?'Official data unavailable':'Awaiting official data');
    return '<article class="decision-panel decision-plan"><header class="decision-panel-head"><div><h2>Next GW Plan'+(gw?' · GW '+gw:'')+'</h2><p>'+safeName(scope)+' · no Monte Carlo</p>'+accountLine+'</div><button class="decision-link" data-goto="planning">Planner ↗</button></header>'+
      '<div class="decision-horizon"><label for="decisionHorizonSelect">Horizon</label><select id="decisionHorizonSelect" aria-label="Optimization horizon">'+[1,3,5].map(h=>'<option value="'+h+'"'+(publicPlan.horizon===h?' selected':'')+'>'+h+' GW</option>').join('')+'</select><span>'+(modelStamp?'Model '+safeName(modelStamp):generated?'Official '+safeName(generated):'Source being verified')+'</span></div>'+
      (report&&!modelReady&&publicPlan.horizon>1?'<p class="decision-fallback-notice">The '+publicPlan.horizon+' GW projection is not yet validated. The available result only uses 1 GW of Official FPL.</p>':'')+
      (report?.economics_status==='PUBLIC_CURRENT_PRICE_PROXY_INDICATIVE'?'<p class="decision-fallback-notice">B/C use the Official FPL market price as a proxy for the sale price, and the bank from the last published GW. <strong>This may not be affordable in your account.</strong> Verify the sale price and hit before transferring.</p>':'')+
      '<div class="decision-scenarios">'+scenario('A','A · Hold')+scenario('B','B · 1 Transfer')+scenario('C','C · 2 Transfers')+'</div>'+
      '<footer class="decision-foot"><span>'+safeName(economicsLabel)+'</span><span>Public data · Non-canonical · Gross gain, not net after hit</span></footer></article>';
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
