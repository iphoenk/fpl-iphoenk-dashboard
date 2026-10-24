/* Planning Insights: presentation-only view of the same public A/B/C decision used by Overview.
   No local shortlist, projectedAt, transferSuggestions or competing recommendation engine. */
(function(){
  'use strict';
  function safeNumber(v){return v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;}
  function metric(v,suffix){const n=safeNumber(v);return n===null?'—':fmt(n,1)+(suffix||'');}
  function player(id){return state.players?.[id]||null;}
  function displayPlayer(v){
    if(!v)return 'Unknown player';
    if(typeof v==='object')return esc(v.web_name||v.name||'Unknown player');
    const p=player(v);return esc(p?.web_name||'Unknown player');
  }
  function infoPlayer(v){
    const id=typeof v==='object'?v.id:v;
    const p=player(id);
    if(!p)return '<p class="planning-muted">Player details unavailable.</p>';
    const team=state.teams?.[p.team]?.short_name||'—';
    return '<dl class="planning-player-facts"><div><dt>Club</dt><dd>'+esc(team)+'</dd></div>'+
      '<div><dt>Price</dt><dd>'+money(p.now_cost)+'</dd></div>'+
      '<div><dt>Form</dt><dd>'+metric(p.form)+'</dd></div>'+
      '<div><dt>Status</dt><dd>'+esc(p.status==='a'?'Available':p.news||'Check availability')+'</dd></div></dl>';
  }
  function stat(label,v){return '<div class="planning-kpi"><span>'+esc(label)+'</span><strong>'+v+'</strong></div>';}
  function moveCard(key,s){
    if(!s)return '<article class="planning-move"><header><strong>'+key+' · '+(key==='B'?'1 transfer':'2 transfers')+'</strong><span>Unavailable</span></header><p class="planning-muted">No validated proposal for this scenario.</p></article>';
    const changes=Array.isArray(s.changes)?s.changes:[];
    const gains=metric(s.gross_gain_vs_hold,' xP');
    const rows=changes.map(c=>'<div class="planning-move-row"><span>'+displayPlayer(c.out)+'</span><span class="planning-arrow" aria-hidden="true">→</span><strong>'+displayPlayer(c.in)+'</strong></div>').join('');
    const only=changes.length===1&&Number.isInteger(Number(changes[0].out?.id))&&Number.isInteger(Number(changes[0].in?.id));
    const action=only?'<button class="btn small" data-plan-transfer="'+Number(changes[0].out.id)+':'+Number(changes[0].in.id)+'">Simulate transfer</button>':
      '<button class="btn small" data-goto="transfers">Open transfer sandbox</button>';
    const detail=changes.length?'<details class="planning-player-details"><summary>Player details</summary><div class="planning-details-grid">'+changes.map(c=>'<div><strong>Out · '+displayPlayer(c.out)+'</strong>'+infoPlayer(c.out)+'</div><div><strong>In · '+displayPlayer(c.in)+'</strong>'+infoPlayer(c.in)+'</div>').join('')+'</div></details>':'';
    return '<article class="planning-move"><header><strong>'+key+' · '+(key==='B'?'1 transfer':'2 transfers')+'</strong><span>'+metric(s.expected_points,' xP')+'</span></header>'+
      (rows||'<p class="planning-muted">No player exchange in this scenario.</p>')+
      '<div class="planning-move-foot"><div><small>Gross gain vs Hold</small><strong>'+gains+'</strong></div><div><small>Confidence</small><strong>Not scored</strong></div>'+action+'</div>'+detail+'</article>';
  }
  renderPlanning=function(){
    const root=document.getElementById('view-planning');if(!root)return;
    root.classList.add('planning-compact-view');
    const valid=ext.publicDecision&&Number(ext.publicDecision.entryId)===Number(state.entry?.id)&&Number(ext.publicDecision.gw)===Number(state.next?.id);
    const report=valid?ext.publicDecision.report:null;
    const contract=['PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1','PUBLIC_FPL_MULTIGW_ADVISORY_V2'].includes(report?.contract);
    const ready=contract&&report?.canonical_v12===false&&report?.monte_carlo===false&&report?.status!=='unavailable';
    const a=ready?report.scenarios?.A:null,b=ready?report.scenarios?.B:null,c=ready?report.scenarios?.C:null;
    const gw=state.next?.id;
    const error=valid?ext.publicDecision.error:null;
    const status=!state.entry?'Connect your FPL Entry ID for personalized planning.':error?'Decision service unavailable: '+esc(error):report?.status==='unavailable'?'Validated projections are currently unavailable.':!ready?'Preparing the same A/B/C decision shown on Overview.':'Gross forecasts are indicative; bank and free transfers use official history when available; selling price and hit cost must be verified.';
    root.innerHTML='<div class="planning-compact-head"><div><h2>Planning Insights'+(gw?' · GW '+esc(gw):'')+'</h2><p>Decision summary and next moves</p></div><button class="btn small ghost" data-goto="dashboard">Overview ↗</button></div>'+
      '<div class="planning-kpis" aria-label="Scenario overview">'+stat('Hold · A',metric(a?.expected_points,' xP'))+
      stat('1 transfer · B',metric(b?.expected_points,' xP'))+stat('2 transfers · C',metric(c?.expected_points,' xP'))+
      stat('Forecast horizon',ready?esc(String(report.horizon||1))+' GW':'—')+'</div>'+
      '<p class="planning-status" role="status">'+status+'</p>'+
      '<section class="planning-moves" aria-labelledby="planningMovesTitle"><div class="planning-section-head"><h3 id="planningMovesTitle">Suggested Transfers</h3><small>Same A/B/C decision as Overview</small></div><div class="planning-move-grid">'+moveCard('B',b)+moveCard('C',c)+'</div></section>'+
      '<details class="planning-extra"><summary>Fixtures and supporting analysis</summary><div class="planning-extra-body">'+(state.next?fixtureHeatmap(3):'<p>Fixture data not loaded.</p>')+'</div></details>'+
      '<details class="planning-extra"><summary>Methodology and limitations</summary><div class="planning-extra-body"><p>Planning Insights displays the public deterministic A/B/C response already used on Overview. It does not run a separate transfer optimizer or a Monte Carlo model.</p><p>Projected gains are gross and do not include transfer hits. Confidence is not numerically scored by the decision API. Simulation is indicative until actual selling prices and free transfers are confirmed.</p></div></details>';
  };
  document.addEventListener('fpl:decision-updated',function(){
    if(state.view==='planning')renderPlanning();
  });
})();
