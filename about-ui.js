/* About: factual, compact product information; styling belongs to about.css. */
function renderAbout(){
 const seasonStart=Number(state.bootstrap?.events?.[0]?.deadline_time?.slice(0,4));
 const season=Number.isInteger(seasonStart)&&seasonStart>=2020&&seasonStart<2100?seasonStart+'/'+String(seasonStart+1).slice(-2):'Awaiting Official FPL season';
 const revision='__FPL_DASHBOARD_BUILD__';
 const providers=[
  ['Official Fantasy Premier League','https://fantasy.premierleague.com/','Published players, fixtures, prices, points, teams and leagues.'],
  ['FPLens','https://github.com/abdelmalek-maskri/fplens','Independent model snapshots and player projections.'],
  ['FPL Core Insights','https://github.com/olbauday/FPL-Core-Insights','Additional public reference data, where explicitly sourced.'],
  ['The Guardian','https://www.theguardian.com/football','Football reporting, linked to its source when shown.'],
  ['FPL Jakarta','https://github.com/fpljakarta/fpl-jakarta-dashboard','Inspiration for awards; interface and calculations are independent.'],
  ['FPL iphoenk V6/V12/MC Engine','https://github.com/iphoenk/FPL-iphoenk-engine','Canonical factual, decision, audit and MC500K engine owned by FPL iphoenk.']
 ];
 const credits=(typeof FPL_CREDITS!=='undefined'&&Array.isArray(FPL_CREDITS.entries))?FPL_CREDITS.entries:[];
 const safeUrl=url=>/^https:\/\/github\.com\//.test(String(url||''))?url:'#';
 const licenseLabel=entry=>entry.license==='MIT'?'MIT license':entry.license==='none-visible'?'No license visible · ideas only':'License unverified · ideas only';
 const statusLabel={planned:'Planned',backlog:'Backlog',partial:'Partly in the dashboard',implemented:'In the dashboard','reviewed-no-adoption':'Reviewed'};
 const creditCard=entry=>{
  const list=items=>'<ul>'+items.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>';
  const built=(entry.implemented||[]).length?'<details class="about-credit-ideas"><summary>Already in the dashboard, built independently ('+entry.implemented.length+')</summary>'+list(entry.implemented)+'</details>':'';
  const pending=(entry.adopted||[]).length?'<details class="about-credit-ideas"><summary>Ideas under evaluation ('+entry.adopted.length+')</summary>'+list(entry.adopted)+'</details>':'';
  const ideas=built+pending;
  return '<li class="about-source about-credit" data-credit="'+esc(entry.id)+'"><a href="'+esc(safeUrl(entry.url))+'" target="_blank" rel="noopener noreferrer">'+esc(entry.name)+' <span aria-hidden="true">↗</span></a><p class="about-credit-meta">by '+esc(entry.author)+' · '+esc(licenseLabel(entry))+' · '+esc(statusLabel[entry.status]||entry.status)+'</p><p>'+esc(entry.summary)+'</p>'+ideas+'</li>';
 };
 const creditGroup=(title,note,list)=>list.length?'<div class="about-credit-group"><h4>'+title+'</h4><p class="about-credit-note">'+note+'</p><ul class="about-source-grid">'+list.map(creditCard).join('')+'</ul></div>':'';
 const codeCredits=credits.filter(entry=>entry.codeCopied===true&&entry.license==='MIT');
 const referenceCredits=credits.filter(entry=>entry.codeCopied!==true&&entry.status!=='reviewed-no-adoption');
 const reviewedCredits=credits.filter(entry=>entry.codeCopied!==true&&entry.status==='reviewed-no-adoption');
 const creditsHtml=
  creditGroup('Code used (MIT)','Source code copied under the MIT license; the license notice ships with this project.',codeCredits)+
  creditGroup('Inspired by','Ideas studied and rewritten independently. No code is copied from these projects.',referenceCredits)+
  creditGroup('Reviewed, nothing adopted','Looked at during research; no code or design was taken.',reviewedCredits);
 const sourceCard=([name,url,summary])=>'<li class="about-source"><a href="'+url+'" target="_blank" rel="noopener noreferrer">'+esc(name)+' <span aria-hidden="true">↗</span></a><p>'+esc(summary)+'</p></li>';
 const methodItem=(number,title,description)=>'<div class="about-method-step"><span class="about-method-number">'+number+'</span><div><h4>'+title+'</h4><p>'+description+'</p></div></div>';
 $('view-about').innerHTML=
 '<div class="about-page">'+
  '<header class="about-hero"><p class="about-kicker">FPL iphoenk · About</p><h2>Your team. Your edge.</h2><p>An independent Fantasy Premier League companion for published squads, gameweek fixtures, classic leagues and public planning insights.</p><div class="about-release"><span>FPL season <strong>'+esc(season)+'</strong></span><span>Dashboard build <strong>'+esc(revision)+'</strong></span></div></header>'+
  '<div class="about-intro-grid">'+
   '<section class="about-card"><h3>What you can explore</h3><ul class="about-list"><li>Your published Starting XI, bench, captain and vice-captain.</li><li>Fixtures, results, team form and mini-league rivals.</li><li>Public A/B/C transfer scenarios and scouting projections.</li></ul></section>'+
   '<section class="about-card"><h3>Know the limits</h3><ul class="about-list"><li>Enter a public FPL ID; no account login is needed.</li><li>No access to unpublished picks, true selling prices or live account transfers.</li><li>Predictions are estimates, never guaranteed points.</li></ul></section>'+
  '</div>'+
  '<section class="about-card about-method"><div class="about-section-head"><div><h3>How the numbers work</h3><p>Public facts and model estimates have different roles.</p></div><button type="button" class="about-link-button" data-goto="accuracy">Model accuracy <span aria-hidden="true">↗</span></button></div>'+
   '<div class="about-method-grid">'+
    methodItem('01','Official data','Published picks, scores, player availability, fixtures and prices come from Official FPL.')+
    methodItem('02','Public decisions','A/B/C uses legal formations and Official FPL ep_next for a one-GW fallback. Longer horizons require a validated public snapshot.')+
    methodItem('03','Independent forecasts','FPLens and other attributed sources provide third-party model inputs. Forecast accuracy varies by GW.')+
   '</div>'+
   '<details class="about-details"><summary>Technical methodology & uncertainty</summary><div class="about-details-body">'+
    '<p>Public transfer candidates are evaluated with bounded deterministic search and XI/bench/C/VC optimization. Monte Carlo is not executed in the browser: our FPL iphoenk engine owns MC500K as a governed research and evidence layer, and the dashboard may consume only validated, contract-compliant outputs. Public prices and historical bank balances are indicative: real selling prices, free transfers and hit costs cannot always be verified.</p>'+
    '<p>Projected xG shown beside upcoming fixtures is an experimental estimate derived from Official FPL season xG and goalkeeper xGC, not recorded match xG. Missing or stale evidence is displayed as unavailable rather than invented.</p>'+
    '<p>FPL iphoenk V6 owns factual acquisition and provenance, Canonical V12 owns the decision contract, and the MC500K layer remains inside the engine for governed probability evidence. This no-login dashboard consumes only public or explicitly published contract outputs and never exposes private credentials.</p>'+
   '</div></details>'+
  '</section>'+
  '<section class="about-card about-sources"><div class="about-section-head"><div><h3>Sources & credits</h3><p>Each provider retains ownership of its data and models. Linked repositories are credited for the ideas listed; inclusion is not an endorsement.</p></div></div><ul class="about-source-grid">'+providers.map(sourceCard).join('')+'</ul>'+creditsHtml+'</section>'+
  '<section class="about-card about-python"><div class="about-section-head"><div><h3>Independent Python Engine</h3><p>FPL iphoenk Python · experimental v0.1.1</p></div></div><p>Our position-aware Python baseline is calculated offline from checked Official FPL data. The dashboard can optionally load validated precomputed forecasts for comparison; it never executes Python in the browser or silently replaces public planning recommendations.</p><p>Third-party models such as FPLens retain separate attribution. The Python model is experimental and has not demonstrated superior predictive accuracy.</p></section>'+'<section class="about-card about-bottom"><h3>Privacy & independence</h3><p>FPL iphoenk is independently built and is not affiliated with or endorsed by the Premier League. Source data, editorial content, models and trademarks belong to their respective owners.</p><p>Public team IDs do not prove account ownership. This website cannot make transfers, activate chips or read authenticated private FPL account data.</p></section>'+
 '</div>';
}
