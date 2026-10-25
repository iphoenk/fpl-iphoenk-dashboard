const requestedView=location.hash.slice(1);
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=0)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('id-ID',{maximumFractionDigits:d,minimumFractionDigits:d});
const money=v=>'£'+fmt(Number(v)/10,1)+'m';
const safeRead=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const state={bootstrap:null,players:{},teams:{},fixtures:[],model:null,manifest:null,entry:null,picks:null,teamState:null,live:{},gw:null,metric:'points',next:null,view:'tim',league:null,leaguePage:1,scoutPage:1,teamRequest:0,leagueRequest:0,modelError:null,apiTime:null};
const positions={1:'GK',2:'DEF',3:'MID',4:'FWD'};
const palettes={ARS:'#df4545',AVL:'#9d5a7d',BOU:'#e85454',BRE:'#f06464',BHA:'#69a3f7',BUR:'#a06981',CHE:'#6183ee',CRY:'#a36ee5',EVE:'#6491ed',FUL:'#e4e8df',IPS:'#89b5ef',LEE:'#f1ecdc',LEI:'#77a3ed',LIV:'#f14c4b',MCI:'#93d4ef',MUN:'#ee625a',NEW:'#c5ccc0',NFO:'#eb6151',SOU:'#f48073',SUN:'#ef9d9b',TOT:'#f1efe3',WHU:'#ba7693',WOL:'#edba50'};
function alertMessage(message){$('alertText').textContent=message;$('alert').classList.remove('hidden');}
function clearAlert(){$('alert').classList.add('hidden');}
async function api(path){
 const requestPath='/api/'+path.replace(/\/(?=\?|$)/,'');
 const cacheBust=/^\/api\/decision(?:\?|$)/.test(requestPath)?'':(requestPath.includes('?')?'&':'?')+'_client_nonce='+Date.now();
 const response=await fetch(requestPath+cacheBust,{cache:'no-store',signal:AbortSignal.timeout(27000)});let data;
 try{data=await response.json();}catch{throw new Error('Invalid data source response. Try reloading.');}
 const providerMode=response.headers.get('X-Provider-Mode');if(providerMode){state.providers??={};state.providers[path]={mode:providerMode,captured:response.headers.get('X-Provider-Captured-At')};if(typeof renderProviderStatus==='function')renderProviderStatus();}
 if(!response.ok)throw new Error(data.error||'Data not yet available.');
 state.apiTime=response.headers.get('X-Data-Fetched-At')||new Date().toISOString();return data;
}
function xp(p){return projection(p,state.model,state.manifest,state.next,state.teams[p.team]);}
function modelPlayer(p){return xp(p)===null?null:state.model?.[p.id];}
function nextFixtures(team,count=3){if(!state.next)return [];return state.fixtures.filter(f=>f.event>=state.next.id&&(f.team_h===team||f.team_a===team)).sort((a,b)=>a.event-b.event).filter(f=>f.event<state.next.id+count);}
function fixturePills(team,count=3){const fixtures=nextFixtures(team,count);if(!fixtures.length)return '<span class="muted">Schedule not yet available</span>';return fixtures.map(f=>{const home=f.team_h===team,op=state.teams[home?f.team_a:f.team_h],difficulty=home?f.team_h_difficulty:f.team_a_difficulty;return '<span class="fixture fdr'+Number(difficulty)+'" title="GW '+f.event+' · FDR '+difficulty+'">'+esc(op?.short_name||'?')+' '+(home?'H':'A')+' · '+difficulty+'</span>';}).join('');}
function selectedGwFixtures(gw=state.gw){
 const event=Number(gw);
 if(!Number.isInteger(event)||event<1)return [];
 return (state.fixtures||[]).filter(f=>Number(f.event)===event).sort((a,b)=>{
  const time=f=>{const millis=Date.parse(f.kickoff_time||'');return Number.isFinite(millis)?millis:Number.POSITIVE_INFINITY;};
  return time(a)-time(b)||Number(a.id||0)-Number(b.id||0);
 });
}
function currentFixture(team){const gw=Number(state.gw);if(!gw)return null;return state.fixtures.find(f=>Number(f.event)===gw&&(f.team_h===team||f.team_a===team))||null;}
function playerFixture(team){const fixture=currentFixture(team);if(!fixture)return '<span class="player-fixture blank" title="No fixture in the selected gameweek">BLANK</span>';const home=fixture.team_h===team,op=state.teams[home?fixture.team_a:fixture.team_h],side=home?'H':'A';const phase=fixturePhase(fixture),live=phase==='live',finished=phase==='finished';const score=finished&&fixture.team_h_score!=null&&fixture.team_a_score!=null?' · '+fixture.team_h_score+'-'+fixture.team_a_score:'';const label=(op?.short_name||'?')+' ('+side+')';return '<span class="player-fixture '+(live?'live':finished?'finished':'upcoming')+'" title="GW '+fixture.event+(live?' · Live':finished?' · Finished':' · Upcoming')+'">'+esc(label)+esc(score)+(live?' · LIVE':'')+'</span>';}
function playerPortraitUrl(p){return officialPhotoSources(p)[0]||'';}
function playerAvailabilityLevel(p){
 // Official FPL: chance_of_playing_next_round is 0/25/50/75/100 or null. 75 => amber, below 75 => red.
 const flag=String(p?.status||'a'),raw=p?.chance_of_playing_next_round,chance=raw===null||raw===undefined||raw===''?null:Number(raw);
 if(chance!==null&&Number.isFinite(chance)){if(chance>=100)return flag==='a'?'':(flag==='d'?'amber':'red');return chance<75?'red':'amber';}
 if(flag==='a')return '';
 return flag==='d'?'amber':'red';
}
function cleanFitnessNews(news){
 // Official FPL news often ends with "- 75% chance of playing"; the chance is shown separately, so drop that suffix.
 return String(news||'').replace(/\s*[-–—]\s*\d{1,3}% chance of playing\.?\s*$/i,'').trim();
}
function playerAvailabilityLabel(p){
 // Official FPL flags are evidence only. They are never shown or used as a probability of playing (V12_PLAYER_MINUTES owns that).
 const level=playerAvailabilityLevel(p),flag=String(p?.status||'a');if(flag==='a'&&!level)return '';
 if(flag==='u'){const note=cleanFitnessNews(p.news);return 'Tidak aktif di FPL'+(note?' · '+note:'');}
 const label=flag==='d'?'Doubtful':flag==='s'?'Suspended':flag==='i'?'Injured':flag==='a'?'Fitness concern':'Unavailable';
 const raw=p.chance_of_playing_next_round,chance=raw===null||raw===undefined||raw===''?null:Number(raw);
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],added=String(p.news_added||'');
 const month=Number(added.slice(5,7)),day=Number(added.slice(8,10));
 const parts=[chance===null||!Number.isFinite(chance)?label:label+' · FPL flag '+chance+'%'];
 const news=cleanFitnessNews(p.news);if(news)parts.push(news);
 if(month>=1&&month<=12&&day>=1)parts.push('updated '+day+' '+months[month-1]);
 return parts.join(' · ');
}
function playerAvailabilitySummary(players){
 const flagged=players.filter(p=>p&&playerAvailabilityLevel(p));if(!flagged.length)return '';
 const rank=p=>playerAvailabilityLevel(p)==='red'?0:1;
 return 'Fitness flags: '+flagged.sort((x,y)=>rank(x)-rank(y)).map(p=>{const c=p.chance_of_playing_next_round;return p.web_name+' '+(String(p.status)==='u'?'inactive in FPL':c===null||c===undefined?String(p.status||'').toUpperCase():c+'%');}).join(', ')+'. Official FPL status flags, not a probability of starting. Amber = flag 75%, red = flag below 75% or out; hover a card for details.';
}
document.addEventListener('error',event=>{
 const img=event.target;if(!img||img.tagName!=='IMG'||!img.hasAttribute('data-player-photo'))return;
 const srcs=officialPhotoSources(state.players[Number(img.dataset.playerPhoto)]||{}),next=(Number(img.dataset.photoStage)||0)+1;
 img.classList.remove('loaded');
 if(next<srcs.length){img.dataset.photoStage=String(next);img.src=srcs[next];}
 else img.parentElement?.classList.add('failed');
},true);
function fixturePhase(f,now=Date.now()){
 if(f.finished===true)return 'finished';
 if(f.finished_provisional===true)return 'provisional';
 const kickoff=Date.parse(f.kickoff_time||'');
 if(Number.isFinite(kickoff)&&now-kickoff>4*60*60*1000)return 'awaiting';
 return f.started===true?'live':f.kickoff_time?'upcoming':'tbc';
}
function fixtureMatchStatus(f,now=Date.now()){
 const phase=fixturePhase(f,now);
 const completeScore=f.team_h_score!=null&&f.team_a_score!=null;
 if(phase==='finished'||(phase==='provisional'&&completeScore))return 'FT';
 if(phase==='provisional')return 'FT pending';
 if(phase==='awaiting')return 'Final pending';
 if(phase==='live')return 'LIVE';
 return null;
}
function projectedFixtureXg(f){
 if(!f||fixturePhase(f)!=='upcoming')return null;
 const completed=(state.fixtures||[]).filter(g=>g.finished===true);
 const players=Object.values(state.players||{});
 const estimates=team=>{
  const played=completed.filter(g=>g.team_h===team||g.team_a===team).length;
  const roster=players.filter(p=>p.team===team);
  const xg=roster.filter(p=>p.expected_goals!=null&&p.expected_goals!==''&&Number.isFinite(Number(p.expected_goals)));
  const gk=roster.filter(p=>p.element_type===1&&p.expected_goals_conceded!=null&&p.expected_goals_conceded!==''&&Number.isFinite(Number(p.expected_goals_conceded)));
  if(played<3||xg.length<8||!gk.length)return null;
  const attack=xg.reduce((sum,p)=>sum+Number(p.expected_goals),0)/played;
  const conceded=gk.reduce((sum,p)=>sum+Number(p.expected_goals_conceded),0)/played;
  return attack>0&&conceded>0?{attack,conceded}:null;
 };
 const home=estimates(f.team_h),away=estimates(f.team_a);
 if(!home||!away)return null;
 const h=Math.sqrt(home.attack*away.conceded)*1.05,a=Math.sqrt(away.attack*home.conceded)*.95;
 if(!Number.isFinite(h)||!Number.isFinite(a))return null;
 return {home:Math.max(.1,Math.min(4.5,h)),away:Math.max(.1,Math.min(4.5,a)),source:'Official FPL season xG and goalkeeper xGC',method:'Experimental deterministic pre-match estimate'};
}

function showView(view){if(!['tim','liga','banding','scout','planner'].includes(view))view='tim';state.view=view;document.querySelectorAll('.page-view').forEach(el=>el.classList.toggle('hidden',el.id!=='view-'+view));document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);el.setAttribute('aria-current',el.dataset.view===view?'page':'false');});const copy={tim:['My Team','Your team.<br><span class="lime">The bigger picture.</span>','Everything you need, before the first whistle.'],liga:['Mini League','Your league.<br><span class="lime">Every rival, in focus.</span>','Know who to chase, and where the opportunities are.'],banding:['Compare','Two teams.<br><span class="lime">One clearer picture.</span>','See what is shared. Find what gives you the edge.'],scout:['Scout','Less guesswork.<br><span class="lime">More game plan.</span>','Find players for your next move.'],planner:['Planner','Think ahead.<br><span class="lime">Play your next move.</span>','From transfer idea to gameweek plan.']}[view];$('crumb').textContent=copy[0];$('pageTitle').innerHTML=copy[1];$('pageDesc').textContent=copy[2];if(location.hash!=='#'+view)history.replaceState(null,'','#'+view);if(view==='scout')renderScout();if(view==='planner'){renderPlanner();renderFixtures();}}
function stat(label,value,note,first=false){return '<article class="stat"><div class="eyebrow">'+esc(label)+'</div><div class="stat-decoration">↗</div><div class="stat-num">'+value+'</div><div class="stat-foot">'+esc(note)+'</div></article>';}
function renderStats(){const e=state.entry,h=state.picks?.entry_history;$('teamStats').innerHTML=stat('Gameweek '+(state.gw||'—'),fmt(h?.points),state.scoreContext?describeScoreBasis(state.scoreContext):'GW points from public picks')+stat('Total points',fmt(e?.summary_overall_points),'Season total • FPL data')+stat('Overall rank',fmt(e?.summary_overall_rank),e?'Manager: '+e.player_first_name+' '+e.player_last_name:'Time to connect your team')+stat('Squad value',h?money(h.value):'—',h?'Public bank: '+money(h.bank):'Value at the selected gameweek');}
function playerCard(pick,bench=false){const p=state.players[pick.element];if(!p)return '';const pred=xp(p);const points=state.live[p.id]?.stats?.total_points;const value=state.metric==='xp'?(pred===null?'—':fmt(pred,1)+' xP'):(points==null?'—':fmt(displayPickPoints(points,pick))+' pts');const team=state.teams[p.team],photo=playerPortraitUrl(p);return '<button type="button" class="player'+(bench?' bench':'')+(playerAvailabilityLevel(p)?' fit-'+playerAvailabilityLevel(p):'')+'" data-player="'+p.id+'"'+(playerAvailabilityLabel(p)?' title="'+esc(playerAvailabilityLabel(p))+'"':'')+' aria-label="Details '+esc(p.web_name+(playerAvailabilityLabel(p)?' · '+playerAvailabilityLabel(p):''))+'">'+(photo?'<span class="player-portrait-frame"><img class="player-portrait" src="'+photo+'" alt="" loading="lazy" data-player-photo="'+p.id+'" data-photo-stage="0" onload="this.classList.add(\'loaded\')"></span>':'')+(bench?'<span class="bench-position">'+esc(positions[p.element_type]||'')+'</span>':'')+'<svg class="shirt" style="color:'+esc(palettes[team?.short_name]||'#c0d88a')+'"><use href="#i-shirt"/></svg>'+(pick.is_captain?'<span class="cap cap-captain" aria-label="Captain">C</span>':pick.is_vice_captain?'<span class="cap cap-vice" aria-label="Vice-captain">VC</span>':'')+'<span class="player-name">'+esc(p.web_name)+'</span>'+playerFixture(p.team)+'<span class="player-score">'+value+'</span></button>';}
function renderPitch(){
 if(!state.picks)return;
 const picks=state.picks.picks;const starting=picks.filter(p=>p.position<=11);
 let html='<span class="penalty top"></span><span class="penalty bottom"></span>';
 for(const type of [1,2,3,4])html+='<div class="pitch-row">'+starting.filter(p=>state.players[p.element]?.element_type===type).map(p=>playerCard(p)).join('')+'</div>';
 $('pitch').innerHTML=html;$('bench').innerHTML=picks.filter(p=>p.position>11).sort((a,b)=>a.position-b.position).map(p=>playerCard(p,true)).join('');
 $('squadTitle').textContent=state.entry.name;$('squadSub').textContent='GW '+state.gw+' · '+state.entry.player_first_name+' '+state.entry.player_last_name+' · FPL ID: '+state.entry.id;
 $('teamNote').textContent=state.metric==='xp'?'xP = model prediction for GW '+(state.next?.id||'next')+', not the selected GW. Value per player before the captain multiplier.':'Points already follow the FPL captain multiplier (×2 / ×3 Triple Captain). The bench shows player points; autosubs may change while the GW is in progress.'; const fitnessSummary=playerAvailabilitySummary(picks.map(p=>state.players[p.element]));if(fitnessSummary)$('teamNote').textContent+=' '+fitnessSummary;
 $('squadTable').innerHTML='<table><thead><tr><th>Player</th><th>Position</th><th>Price</th><th>Form</th><th>xG</th><th>xA</th><th>Next xP</th><th>GW points</th></tr></thead><tbody>'+picks.map(pick=>{const p=state.players[pick.element];if(!p)return '';return '<tr><td><button class="btn small ghost" data-player="'+p.id+'">'+esc(p.web_name)+(pick.is_captain?' Ⓒ':'')+'</button></td><td>'+positions[p.element_type]+'</td><td>'+money(p.now_cost)+'</td><td>'+fmt(p.form,1)+'</td><td>'+fmt(p.expected_goals,2)+'</td><td>'+fmt(p.expected_assists,2)+'</td><td class="lime">'+fmt(xp(p),1)+'</td><td>'+fmt(displayPickPoints(state.live[p.id]?.stats?.total_points,pick))+'</td></tr>';}).join('')+'</tbody></table>';
}
function rankedPlayers(){return Object.values(state.players).filter(p=>xp(p)!==null).sort((a,b)=>xp(b)-xp(a));}
function renderInsights(){
 const ranked=rankedPlayers();const own=state.picks?.picks.filter(p=>p.position<=11).map(p=>state.players[p.element]).filter(Boolean)||[];const candidate=[...(own.length?own:ranked)].filter(p=>xp(p)!==null).sort((a,b)=>xp(b)-xp(a))[0];
 $('captainCard').innerHTML='<div class="eyebrow">CAPTAIN WATCH · '+(state.next?'GW '+state.next.id:'NEXT GW')+'</div>'+(candidate?'<h3>'+esc(candidate.web_name)+'<span class="lime"> ↗</span></h3><p>'+(own.length?'Highest prediction among your starters.':'Highest prediction among all players.')+' Check fitness news ahead of the deadline.</p><div class="metric">'+fmt(xp(candidate),1)+'<small>expected points</small></div><div>'+fixturePills(candidate.team,1)+'</div><div class="spotlight-bottom"><span>FPL iphoenk · '+esc(state.manifest.default_model)+'<br>Prediction before the captain multiplier</span><button class="btn small" data-player="'+candidate.id+'">View analysis ↗</button></div>':'<h3>Pick the armband<br><span class="lime">with a little insight.</span></h3><p>Captain recommendations appear once FPL iphoenk predictions match the gameweek and active players.</p><div class="metric">—<small>expected points</small></div><div class="spotlight-bottom"><span>No fabricated fallback predictions.</span><button class="btn small" data-goto="scout">Open Scout ↗</button></div>');
 $('radar').innerHTML=ranked.length?ranked.slice(0,3).map((p,i)=>'<div class="compact-item"><span class="rank-badge">0'+(i+1)+'</span><div><button data-player="'+p.id+'" style="background:none;border:0;padding:0;text-align:left"><strong>'+esc(p.web_name)+'</strong></button><small>'+esc(state.teams[p.team]?.short_name)+' · '+positions[p.element_type]+' · '+money(p.now_cost)+'</small></div><div class="compact-score lime">'+fmt(xp(p),1)+'<small>xP next GW</small></div></div>').join(''):'<div class="empty" style="padding:20px 0">Active predictions not yet available. FPL stats can still be explored in Scout.</div>';
 const generated=state.manifest?.generated_at;const label=ranked.length?'Snapshot '+deviceDateTime(generated)+' · '+ranked.length+' matched players.':state.modelError||'Model snapshot does not yet match the gameweek, deadline, or active player identities. xP is hidden.';
 $('modelStatus').textContent=label;$('scoutNotice').textContent=label;$('scoutNotice').classList.toggle('hidden',ranked.length>0);
}
async function loadBase(){
 $('dataStatus').innerHTML='<span class="loader"></span> Loading data';
 const [bootstrap,fixtures]=await Promise.all([api('bootstrap-static/'),api('fixtures/')]);
 state.bootstrap=bootstrap;state.players=Object.fromEntries(bootstrap.elements.map(p=>[p.id,p]));state.teams=Object.fromEntries(bootstrap.teams.map(t=>[t.id,t]));state.fixtures=fixtures;state.fixturesFetchedAt=Date.now();state.next=bootstrap.events.find(e=>e.is_next)||bootstrap.events.find(e=>!e.finished&&!e.is_current);state.gw=defaultGameweek(bootstrap.events);
 const events=bootstrap.events.filter(e=>e.id<=(state.gw||0));$('gwSelect').innerHTML=events.reverse().map(e=>'<option value="'+e.id+'"'+(e.id===state.gw?' selected':'')+'>GW '+e.id+'</option>').join('')||'<option value="">Not started yet</option>';
 $('dataStatus').innerHTML='<span class="dot"></span> FPL connected';$('dataStatus').title='Fetched '+new Date(state.apiTime).toLocaleString('en-GB');
 $('deadline').textContent=state.next?deviceDateTime(state.next.deadline_time):'Season finished';$('deadlineGw').textContent=state.next?'GAMEWEEK '+state.next.id+' · '+deviceTimeLabel():'Waiting for next season';
 const year=bootstrap.events[0]?new Date(bootstrap.events[0].deadline_time).getFullYear():new Date().getFullYear();$('seasonLabel').textContent='SEASON '+year+'/'+String(year+1).slice(-2);
 renderStats();renderInsights();renderScout();renderFixtures();
 try{const bundle=await api('model/bundle');state.manifest=bundle.manifest;state.model=bundle.players;}catch{state.modelError='FPL iphoenk source is currently unavailable. FPL stats can still be used.';}
 renderInsights();renderScout();renderPitch();
}
async function fetchTeam(id,gw){
 const result=await Promise.all([api('entry/'+id+'/'),api('entry/'+id+'/event/'+gw+'/picks/')]);
 if(Number(result[0]?.id)===Number(id))return {entry:result[0],picks:result[1]};
 const retry=await api('entry/'+id+'/?identity_retry='+Date.now());
 if(Number(retry?.id)!==Number(id))throw new Error('The loaded team does not match the entered FPL ID. Please try again.');
 return {entry:retry,picks:result[1]};
}
async function loadTeam(raw,gw=state.gw,options={}){
 const visiting=options.visit??state.visitingTeam??false;
 const parsedId=entryId(raw);if(!parsedId){alertMessage('Enter an Entry ID as a number or a valid FPL team link.');return;}const id=Number(parsedId);
 if(!state.bootstrap){alertMessage('FPL data is not ready yet. Try reloading the data.');return;}
 if(!gw){alertMessage('No public gameweek yet for this team. Try again after the first deadline.');return;}
 const request=++state.teamRequest;$('entrySubmit').disabled=true;$('entrySubmit').textContent='Connecting…';clearAlert();
 try{let team=null,live=null,selectedGw=null,lastError=null;const candidates=(options.explicitGw?[gw]:[gw,...(state.bootstrap.events||[]).filter(e=>e.finished).reverse().map(e=>e.id)]).filter((value,index,array)=>value&&array.indexOf(value)===index);
  for(const candidate of candidates){try{const [candidateTeam,candidateLive]=await Promise.all([fetchTeam(id,candidate),api('event/'+candidate+'/live/').catch(()=>null)]);if(Number(candidateTeam.entry?.id)!==id)throw new Error('The loaded team does not match the entered FPL ID. Please try again.');team=candidateTeam;live=candidateLive;selectedGw=Number(candidate);break;}catch(error){lastError=error;}}
  if(!team)throw options.explicitGw?Object.assign(new Error('GW '+gw+' could not be loaded for this team, so the page still shows GW '+(state.gw||'—')+'. Press the refresh button to retry or pick another gameweek.'),{userFacing:true}):(lastError||new Error('Unable to load the Official FPL team.'));
  if(request!==state.teamRequest)return;
  if(!visiting&&!state.visitingTeam&&state.league&&!(team.entry.leagues?.classic||[]).some(l=>l.id===state.league.league.id)){state.league=null;state.leagueRequest++;ext.leagueToken++;$('leaguePanel').innerHTML='<div class="empty">Select a mini league for this team.</div>';$('leaguePagination').innerHTML='';$('leagueInput').value='';document.getElementById('leagueExtras')?.remove();}
  state.entry=team.entry;state.picks=team.picks;state.teamState={requestedEntryId:id,entryId:Number(team.entry.id),teamName:team.entry.name||null,managerName:[team.entry.player_first_name,team.entry.player_last_name].filter(Boolean).join(' ')||null,gameweek:selectedGw,squad:(team.picks.picks||[]).map(p=>({element:Number(p.element),position:Number(p.position),multiplier:Number.isFinite(Number(p.multiplier))?Number(p.multiplier):null,isCaptain:Boolean(p.is_captain),isViceCaptain:Boolean(p.is_vice_captain)})),source:'Official FPL',authority:'OFFICIAL_FPL',fetchedAt:new Date().toISOString()};state.gw=selectedGw;state.live=Object.fromEntries((live?.elements||[]).map(p=>[p.id,p]));state.gwFallback=Number(selectedGw)!==Number(gw)?{requested:Number(gw),actual:Number(selectedGw)}:null;state.scoreContext=buildScoreContext({entry:team.entry,picks:team.picks,live,event:(state.bootstrap.events||[]).find(e=>e.id===Number(selectedGw))||null,standing:null,season:state.bootstrap?.game_settings?.season??null,gameweek:selectedGw,sourceMeta:{source_as_of:null,fetched_at:new Date().toISOString()}});$('gwSelect').value=selectedGw;$('entryInput').value=id;$('compareA').value=id;state.visitingTeam=visiting;if(!visiting){state.homeEntryId=id;safeWrite('dugout-entry',id);}
  renderStats();renderPitch();renderInsights();renderPlanner();renderLeagueOptions();renderFixtures();if(state.gwFallback)alertMessage('GW '+state.gwFallback.requested+' was not available for this team, so GW '+state.gwFallback.actual+' is shown instead.');else if(!live)alertMessage('Team loaded successfully, but per-player points are not yet available. The gameweek total follows the FPL picks data.');
 }catch(error){if(request===state.teamRequest&&options.explicitGw&&state.gw)$('gwSelect').value=state.gw;if(request===state.teamRequest)alertMessage(error?.userFacing||error?.message?.includes('does not match the entered FPL ID')?error.message:'Unable to connect to FPL. The FPL data service is temporarily unavailable. Please try again shortly. Your previously selected team remains unchanged.');}
 finally{if(request===state.teamRequest){$('entrySubmit').disabled=false;$('entrySubmit').innerHTML='Connect team ↗';}}
}
function renderLeagueOptions(){const leagues=state.entry?.leagues?.classic||[];$('leagueSelect').innerHTML='<option value="">Select a mini league ('+leagues.length+')</option>'+leagues.map(l=>'<option value="'+l.id+'">'+esc(l.name)+'</option>').join('');if(state.league&&leagues.some(l=>l.id===state.league.league.id))$('leagueSelect').value=state.league.league.id;}
async function loadLeague(id,page=1){if(!/^[1-9]\d{0,9}$/.test(String(id))){alertMessage('Mini league ID must be a number.');return;}const request=++state.leagueRequest;clearAlert();$('leaguePanel').innerHTML='<div class="empty"><span class="loader"></span> Loading standings…</div>';$('leaguePagination').innerHTML='';try{const data=await api('leagues-classic/'+id+'/standings/?page_standings='+page);if(request!==state.leagueRequest)return;state.league=data;state.leaguePage=page;const rows=data.standings.results;const same=String(state.visitingTeam?(state.homeEntryId||safeRead('dugout-entry')||''):state.entry?.id),viewing=state.visitingTeam?String(state.entry?.id):'';$('leagueInput').value=id;
 $('leaguePanel').innerHTML='<div class="panel-head"><div class="panel-heading"><h2>'+esc(data.league.name)+'</h2><small>Classic league · official FPL ranking</small></div><span class="badge">Page '+page+'</span></div><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Team & manager</th><th>GW points</th><th>Total points</th><th>Movement</th><th>Analysis</th></tr></thead><tbody>'+rows.map(r=>{const movement=r.last_rank?r.last_rank-r.rank:0;return '<tr class="'+(String(r.entry)===same?'selected-row':'')+'"><td>'+fmt(r.rank)+'</td><td class="team-name">'+esc(r.entry_name)+(String(r.entry)===same?' <span class="badge">You</span>':'')+(viewing&&String(r.entry)===viewing?' <span class="badge">Viewing</span>':'')+'<small>'+esc(r.player_name)+'</small></td><td>'+fmt(r.event_total)+'</td><td class="lime">'+fmt(r.total)+'</td><td>'+ (movement>0?'<span class="lime">↑ '+movement+'</span>':movement<0?'<span style="color:var(--orange)">↓ '+Math.abs(movement)+'</span>':'—')+'</td><td><button class="btn small" data-team="'+r.entry+'">View team ↗</button> <button class="btn small ghost" data-rival="'+r.entry+'">Compare</button></td></tr>';}).join('')+'</tbody></table>'+(rows.length?'':'<div class="empty">No participants on this page yet.</div>')+'</div>';
 const leagueBadge=$('leaguePanel').querySelector('.panel-head > .badge');if(leagueBadge){const holder=document.createElement('div');holder.className='league-panel-page';holder.id='leagueHeaderPage';leagueBadge.replaceWith(holder);}
 $('leaguePagination').innerHTML='<button class="btn small" id="leaguePrev"'+(page===1?' disabled':'')+'>← Previous</button><span>Page '+page+'</span><button class="btn small" id="leagueNext"'+(!data.standings.has_next?' disabled':'')+'>Next →</button>';
 if(typeof renderLeagueExtras==='function')renderLeagueExtras(data);
 $('leaguePrev').onclick=()=>loadLeague(id,page-1);$('leagueNext').onclick=()=>loadLeague(id,page+1);const headerPage=$('leagueHeaderPage'),legacyPage=$('leaguePagination');if(headerPage&&legacyPage){headerPage.replaceChildren(...legacyPage.childNodes);legacyPage.replaceChildren();}
 }catch(error){if(request===state.leagueRequest){$('leaguePanel').innerHTML='<div class="empty"><h3>League could not be opened yet.</h3>'+esc(error.message)+'</div>';alertMessage(error.message);}}}
async function compareTeams(rawA,rawB){const a=entryId(rawA),b=entryId(rawB);if(!a||!b){alertMessage('Both Entry IDs must be valid.');return;}if(a===b){alertMessage('Select two different teams to compare.');return;}if(!state.gw){alertMessage('Gameweek not yet available.');return;}clearAlert();const gw=state.gw;const button=$('compareForm').querySelector('button');button.disabled=true;$('compareResult').innerHTML='<div class="panel empty"><span class="loader"></span> Reading two teams…</div>';try{const [teamA,teamB]=await Promise.all([fetchTeam(a,gw),fetchTeam(b,gw)]);const c=comparePicks(teamA.picks.picks,teamB.picks.picks);const pa=teamA.picks.entry_history,pb=teamB.picks.entry_history;
 const teamBlock=(team,unique)=>{const cap=team.picks.picks.find(p=>p.is_captain);return '<section class="panel"><div class="panel-head"><div class="panel-heading"><h2>'+esc(team.entry.name)+'</h2><small>'+esc(team.entry.player_first_name+' '+team.entry.player_last_name)+' · GW '+gw+'</small></div><button class="btn small" data-team="'+team.entry.id+'">Open team ↗</button></div><div class="panel-body"><div class="notice ok">Captain: <strong>'+esc(state.players[cap?.element]?.web_name||'—')+'</strong> · Multiplier '+(cap?.multiplier??'—')+'×</div><div class="eyebrow" style="margin-bottom:10px">Differentiating players</div>'+unique.map(id=>{const p=state.players[id];const pick=team.picks.picks.find(x=>x.element===id);return '<div class="player-chip"><button class="btn small ghost" data-player="'+id+'">'+esc(p?.web_name||id)+'</button><span class="muted">'+(pick.position<=11?'Starter':'Bench')+' · '+(p?money(p.now_cost):'—')+'</span></div>';}).join('')+(unique.length?'':'<p class="muted">Identical squads.</p>')+'</div></section>';};
 $('compareResult').innerHTML='<section class="comparison-summary">'+stat('Same players',fmt(c.shared.length),'Out of 15 squad players')+stat('Team A points',fmt(pa.points),'GW '+gw)+stat('Team B points',fmt(pb.points),'Difference A − B: '+fmt(pa.points-pb.points))+'</section><div class="compare-grid">'+teamBlock(teamA,c.onlyA)+teamBlock(teamB,c.onlyB)+'</div><div class="help">The comparison uses public picks for GW '+gw+'. Points and autosubs follow the FPL update process.</div>';
 }catch(error){$('compareResult').innerHTML='<div class="panel empty">'+esc(error.message)+'</div>';alertMessage(error.message);}finally{button.disabled=false;}}
function renderScout(){if(!state.bootstrap)return;const query=$('scoutSearch').value.toLocaleLowerCase(),pos=$('scoutPosition').value,budget=Number($('scoutBudget').value)||20,sort=$('scoutSort').value;
 const list=Object.values(state.players).filter(p=>(!pos||String(p.element_type)===pos)&&p.now_cost<=budget*10&&(p.web_name+' '+p.first_name+' '+p.second_name+' '+state.teams[p.team]?.name).toLocaleLowerCase().includes(query));
 list.sort((a,b)=>sort==='xp'?((xp(b)??-Infinity)-(xp(a)??-Infinity)||Number(b.form)-Number(a.form)):Number(b[sort])-Number(a[sort]));const pages=Math.max(1,Math.ceil(list.length/10));state.scoutPage=Math.min(pages,state.scoutPage);const page=state.scoutPage;const subset=list.slice((page-1)*10,page*10);$('scoutCount').textContent=list.length+' players';
 $('scoutTable').innerHTML='<table><thead><tr><th>Player</th><th>Pos</th><th>Price</th><th>Form</th><th>Points</th><th>xGI</th><th>xP GW '+(state.next?.id||'—')+'</th><th>Ownership</th><th>Fixtures · FDR</th></tr></thead><tbody>'+subset.map(p=>'<tr><td class="team-name"><button class="btn small ghost" data-player="'+p.id+'">'+esc(p.web_name)+'</button><small>'+esc(state.teams[p.team]?.name)+(p.status!=='a'?' · ⚠ '+esc(p.status):'')+'</small></td><td>'+positions[p.element_type]+'</td><td>'+money(p.now_cost)+'</td><td>'+fmt(p.form,1)+'</td><td>'+fmt(p.total_points)+'</td><td>'+fmt(p.expected_goal_involvements,2)+'</td><td class="lime">'+fmt(xp(p),1)+'</td><td>'+fmt(p.selected_by_percent,1)+'%</td><td>'+fixturePills(p.team)+'</td></tr>').join('')+'</tbody></table>'+(subset.length?'':'<div class="empty">No matching players. Try changing the filters.</div>');
 $('scoutPagination').innerHTML='<button class="btn small" id="scoutPrev"'+(page===1?' disabled':'')+'>← Previous</button><span>'+page+' / '+pages+'</span><button class="btn small" id="scoutNext"'+(page>=pages?' disabled':'')+'>Next →</button>';$('scoutPrev').onclick=()=>{state.scoutPage--;renderScout();};$('scoutNext').onclick=()=>{state.scoutPage++;renderScout();};
}
function playerDetail(id){const p=state.players[id];if(!p)return;const m=modelPlayer(p),pred=xp(p);const metrics=[['Price',money(p.now_cost)],['Form',fmt(p.form,1)],['Total points',fmt(p.total_points)],['Season xG',fmt(p.expected_goals,2)],['Season xA',fmt(p.expected_assists,2)],['Minutes',fmt(p.minutes)]];
 $('playerDetail').innerHTML='<div class="dialog-head"><div><div class="eyebrow">'+esc(state.teams[p.team]?.name)+' · '+positions[p.element_type]+'</div><h2 style="margin-top:8px">'+esc(p.web_name)+'</h2><p class="muted" style="font-size:11px;margin-top:5px">'+esc(p.first_name+' '+p.second_name)+'</p></div><button class="btn small ghost" id="closePlayer" aria-label="Close player details">✕</button></div><div class="dialog-content">'+(p.news?'<div class="notice">'+esc(p.news)+'</div>':'')+'<div class="detail-grid">'+metrics.map(([label,v])=>'<div><small class="muted">'+label+'</small><strong>'+v+'</strong></div>').join('')+'</div><div class="section-top"><h3>Next gameweek</h3><span class="badge">'+(pred===null?'xP not yet available':fmt(pred,1)+' xP')+'</span></div>'+fixturePills(p.team,6)+(m?'<div class="model-meta">Model range: '+fmt(m.predicted_range_low,1)+'–'+fmt(m.predicted_range_high,1)+' points · not a guaranteed outcome.</div><h3 class="section-gap">Recent returns</h3><div class="chart">'+(m.pts_history||[]).slice(-7).map((v,i,arr)=>'<div class="chart-bar" style="height:'+Math.max(6,Math.max(0,v)/Math.max(1,...arr)*100)+'%" title="'+esc((m.gw_labels||[]).slice(-7)[i]||'GW')+': '+v+' points"><span>'+esc(v)+'</span></div>').join('')+'</div><p class="muted" style="font-size:9px">'+esc((m.gw_labels||[]).slice(-7).join(' · '))+'</p><h3 class="section-gap">Behind the prediction</h3><div class="model-meta">SHAP feature contribution to the model prediction, not a causal relationship.</div>'+(m.shap||[]).slice(0,5).map(s=>'<div class="player-chip"><span>'+esc(s.display)+'</span><span class="'+(s.impact>=0?'lime':'muted')+'">'+(s.impact>0?'+':'')+fmt(s.impact,2)+'</span></div>').join(''):'<div class="help">Predictions are only shown when the deadline, gameweek, player name and club match the FPL iphoenk snapshot.</div>')+'<div class="model-meta">Season stats: FPL API · Prediction: FPL iphoenk. Data may be delayed; check the latest news before the deadline.</div></div>';
 $('closePlayer').onclick=()=>$('playerDialog').close();$('playerDialog').showModal();
}
function renderPlanner(){const picks=state.picks?.picks;if(!picks){renderSaved();return;}const previous=$('transferOut').value;$('transferOut').innerHTML='<option value="">Select outgoing player</option>'+picks.map(pick=>{const p=state.players[pick.element];return '<option value="'+pick.element+'">'+esc(p?.web_name)+' · '+positions[p?.element_type]+' · '+money(p?.now_cost||0)+'</option>';}).join('');if(picks.some(p=>String(p.element)===previous))$('transferOut').value=previous;updateTransferIn();renderSaved();}
function updateTransferIn(){const out=state.players[$('transferOut').value],current=$('transferIn').value;const owned=new Set(state.picks?.picks.map(p=>p.element)||[]);const list=Object.values(state.players).filter(p=>out&&p.element_type===out.element_type&&!owned.has(p.id)).sort((a,b)=>(xp(b)??Number(b.form))-(xp(a)??Number(a.form)));$('transferIn').innerHTML='<option value="">Select incoming player</option>'+list.map(p=>'<option value="'+p.id+'">'+esc(p.web_name)+' · '+esc(state.teams[p.team]?.short_name)+' · '+money(p.now_cost)+(xp(p)!==null?' · '+fmt(xp(p),1)+' xP':'')+'</option>').join('');if(list.some(p=>String(p.id)===current))$('transferIn').value=current;$('transferResult').innerHTML='';}
function plansKey(){return 'dugout-plans-'+(state.entry?.id||'guest');}
function renderSaved(){const plans=safeRead(plansKey(),[]);$('savedPlans').innerHTML=Array.isArray(plans)&&plans.length?plans.map((p,i)=>'<div class="saved-plan"><div><strong>'+esc(p.outName)+' → '+esc(p.inName)+'</strong><small class="muted" style="display:block;margin-top:6px">GW '+esc(p.gw)+' · '+esc(p.note)+'</small></div><button class="btn small ghost" data-delete-plan="'+i+'" aria-label="Delete transfer plan">×</button></div>').join(''):'<div class="empty" style="padding:40px 0">No saved plans yet.<br>Start with one transfer idea.</div>';}
function simulateTransfer(event){event.preventDefault();if(!state.picks){alertMessage('Connect your team first to try the simulation.');return;}const outId=Number($('transferOut').value),inId=Number($('transferIn').value),bank=Number($('bankValue').value),selling=Number($('sellingPrice').value),hit=Number($('hitCost').value);const out=state.players[outId],incoming=state.players[inId];const error=validateTransfer(state.picks.picks,outId,inId,state.players,bank);if(error){$('transferResult').innerHTML='<div class="notice section-gap">'+esc(error)+'</div>';return;}
 if(!Number.isFinite(selling)||selling<0||bank<0||selling*10>out.now_cost){$('transferResult').innerHTML='<div class="notice section-gap">The sale price must be valid and cannot exceed the current market buy price. The bank balance cannot be negative.</div>';return;}
 const remaining=Math.round((bank+selling)*10)-incoming.now_cost;if(remaining<0){$('transferResult').innerHTML='<div class="notice section-gap">Budget short by '+money(-remaining)+'. Check the sale price and actual bank balance.</div>';return;}
 const from=xp(out),to=xp(incoming),delta=from!==null&&to!==null?to-from-hit:null;const note=delta===null?'xP not available':(delta>=0?'+':'')+fmt(delta,1)+' xP net';
 $('transferResult').innerHTML='<div class="planner-result"><strong>'+esc(out.web_name)+' → '+esc(incoming.web_name)+'</strong><br>Bank after transfer: <span class="lime">'+money(remaining)+'</span><br>Transfer cost: '+hit+' points<br>Prediction difference GW '+(state.next?.id||'—')+': <span class="lime">'+esc(note)+'</span><div style="margin-top:10px">'+fixturePills(incoming.team,6)+'</div><button class="btn small primary" id="saveTransfer" style="margin-top:12px">Save transfer idea</button></div>';
 $('saveTransfer').onclick=()=>{const stored=safeRead(plansKey(),[]),plans=Array.isArray(stored)?stored:[];plans.unshift({outId,inId,outName:out.web_name,inName:incoming.web_name,gw:state.next?.id||'—',note,created:new Date().toISOString()});safeWrite(plansKey(),plans.slice(0,20));renderSaved();$('saveTransfer').textContent='Saved ✓';$('saveTransfer').disabled=true;};
}
function renderFixtures(){if(!state.bootstrap)return;const teams=Object.values(state.teams);const weeks=Array.from({length:6},(_,i)=>(state.next?.id||39)+i).filter(v=>v<=38);$('fixtureTable').innerHTML=weeks.length?'<table><thead><tr><th>Club</th>'+weeks.map(w=>'<th>GW '+w+'</th>').join('')+'</tr></thead><tbody>'+teams.map(t=>'<tr><td class="team-name">'+esc(t.name)+'</td>'+weeks.map(w=>{const fs=state.fixtures.filter(f=>f.event===w&&(f.team_h===t.id||f.team_a===t.id));return '<td>'+(fs.length?fs.map(f=>{const home=f.team_h===t.id,d=home?f.team_h_difficulty:f.team_a_difficulty;return '<span class="fixture fdr'+d+'">'+esc(state.teams[home?f.team_a:f.team_h]?.short_name)+' '+(home?'H':'A')+' · '+d+'</span>';}).join(''):'<span class="muted">Blank / not yet scheduled</span>')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table>':'<div class="empty">Next gameweek schedule not yet available.</div>';}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.view)showView(button.dataset.view);if(button.dataset.goto)showView(button.dataset.goto);if(button.dataset.player)playerDetail(Number(button.dataset.player));if(button.dataset.team){showView('tim');state.homeEntryId=state.homeEntryId||safeRead('dugout-entry')||state.entry?.id;loadTeam(button.dataset.team,state.gw,{visit:String(button.dataset.team)!==String(state.homeEntryId)});}if(button.dataset.rival){$('compareB').value=button.dataset.rival;showView('banding');if($('compareA').value)compareTeams($('compareA').value,button.dataset.rival);}if(button.dataset.metric){state.metric=button.dataset.metric;document.querySelectorAll('[data-metric]').forEach(el=>el.classList.toggle('active',el===button));renderPitch();}if(button.dataset.deletePlan!==undefined){const plans=safeRead(plansKey(),[]);plans.splice(Number(button.dataset.deletePlan),1);safeWrite(plansKey(),plans);renderSaved();}});
$('entryForm').onsubmit=event=>{event.preventDefault();loadTeam($('entryInput').value);};$('helpButton').onclick=()=>$('helpBox').classList.toggle('hidden');$('closeAlert').onclick=clearAlert;$('focusEntry').onclick=()=>$('entryInput').focus();$('gwSelect').onchange=()=>{if(state.entry)loadTeam(state.entry.id,Number($('gwSelect').value),{explicitGw:true});else{state.gw=Number($('gwSelect').value);renderStats();renderFixtures();}};$('leagueSelect').onchange=()=>{if($('leagueSelect').value)loadLeague($('leagueSelect').value);};$('leagueForm').onsubmit=event=>{event.preventDefault();loadLeague($('leagueInput').value);};$('compareForm').onsubmit=event=>{event.preventDefault();compareTeams($('compareA').value,$('compareB').value);};
for(const id of ['scoutSearch','scoutPosition','scoutBudget','scoutSort'])$(id).addEventListener(id==='scoutSearch'?'input':'change',()=>{state.scoutPage=1;renderScout();});$('transferOut').onchange=()=>{updateTransferIn();$('sellingPrice').value='';};$('transferForm').onsubmit=simulateTransfer;$('playerDialog').addEventListener('click',event=>{if(event.target===$('playerDialog'))$('playerDialog').close();});window.addEventListener('hashchange',()=>showView(location.hash.slice(1)));
$('refreshButton').onclick=async()=>{const button=$('refreshButton');button.disabled=true;try{clearAlert();await loadBase();if(state.entry)await loadTeam(state.entry.id);if(state.league)await loadLeague(state.league.league.id,state.leaguePage);}catch(error){alertMessage(error.message);}finally{button.disabled=false;}};
function localKickoff(value){if(!value)return 'Kickoff TBC';const d=new Date(value);return Number.isNaN(d.getTime())?'Kickoff TBC':d.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});}
function fixturePrediction(f){const h=Number(f.team_h_difficulty),a=Number(f.team_a_difficulty);if(!h||!a)return 'Prediction unavailable';if(Math.abs(h-a)<1)return 'FDR lean: even';return h<a?'FDR lean: home':'FDR lean: away';}
function liveFixtureCards(){
 const gw=Number(state.gw),relevant=selectedGwFixtures(gw);
 if(!relevant.length)return '<div class="fixture-live-empty">No Official FPL fixtures published for selected GW '+esc(gw||'—')+'.</div>';
 return '<div class="fixture-live-grid">'+relevant.map(f=>{
  const home=state.teams[f.team_h],away=state.teams[f.team_a],phase=fixturePhase(f),live=phase==='live',finished=phase==='finished';
  const score=f.team_h_score!=null&&f.team_a_score!=null?fmt(f.team_h_score)+' – '+fmt(f.team_a_score):'–';
  const status=fixtureMatchStatus(f)||(f.kickoff_time?'Upcoming':'Kickoff TBC');
  const xg=projectedFixtureXg(f),prediction=xg?'Est. xG '+fmt(xg.home,2)+' – '+fmt(xg.away,2):null;
  return '<article class="fixture-live-card"><div class="fixture-live-meta"><span class="badge '+(live?'live':'')+'">'+esc(status)+'</span><time>'+esc(localKickoff(f.kickoff_time))+'</time></div><div class="fixture-live-teams"><strong>'+esc(home?.short_name||'Home')+'</strong><b>'+score+'</b><strong>'+esc(away?.short_name||'Away')+'</strong></div>'+(prediction?'<div class="fixture-live-prediction">'+esc(prediction)+' · Experimental, not live xG</div>':'')+'</article>';
 }).join('')+'</div><p class="fixture-live-note">Official FPL kickoff in device-local time. Estimated xG is experimental (season player xG and goalkeeper xGC), not live match xG.</p>';
}
function renderFixturesEnhanced(){if(!state.bootstrap)return;const teams=Object.values(state.teams);const weeks=Array.from({length:6},(_,i)=>(Number(state.gw)||state.next?.id||39)+i).filter(v=>v<=38);const table=weeks.length?'<table><thead><tr><th>Club</th>'+weeks.map(w=>'<th>GW '+w+'</th>').join('')+'</tr></thead><tbody>'+teams.map(t=>'<tr><td class="team-name">'+esc(t.name)+'</td>'+weeks.map(w=>{const fs=state.fixtures.filter(f=>f.event===w&&(f.team_h===t.id||f.team_a===t.id));return '<td>'+(fs.length?fs.map(f=>{const home=f.team_h===t.id,d=home?f.team_h_difficulty:f.team_a_difficulty;return '<span class="fixture fdr'+d+'">'+esc(state.teams[home?f.team_a:f.team_h]?.short_name)+' '+(home?'H':'A')+' · '+d+'</span>';}).join(''):'<span class="muted">Blank / not yet scheduled</span>')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table>':'<div class="empty">Next gameweek schedule not yet available.</div>';$('fixtureTable').innerHTML='<section class="fixture-live"><div class="fixture-live-head"><div><h3>GW '+esc(state.gw||'—')+' Fixtures</h3><p>Matches and scores for the selected gameweek only.</p></div></div>'+liveFixtureCards()+'</section><div class="fixture-outlook-table">'+table+'</div>';}
renderFixtures=renderFixturesEnhanced;
let fixtureRefreshRunning=false;
async function refreshCurrentFixtures(){
 if(fixtureRefreshRunning||!state.bootstrap||document.hidden||!state.entry)return;
 if(Date.now()-(state.fixturesFetchedAt||0)<120000)return;
 const current=selectedGwFixtures();
 const near=current.some(f=>{
  const kickoff=Date.parse(f.kickoff_time||'');
  return Number.isFinite(kickoff)&&Date.now()-kickoff>-12*60*60*1000&&Date.now()-kickoff<10*60*60*1000;
 });
 if(!near)return;
 fixtureRefreshRunning=true;
 try{
  const latest=await api('fixtures/');
  if(!Array.isArray(latest)||latest.length<100)return;
  state.fixtures=latest;state.fixturesFetchedAt=Date.now();
  renderFixtures();
  document.dispatchEvent(new Event('fpl-fixtures-updated'));
 }catch{/* Keep the last Official snapshot; phase guards stop stale LIVE labels. */}
 finally{fixtureRefreshRunning=false;}
}
setInterval(refreshCurrentFixtures,120000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCurrentFixtures();});
/*__EXTENSIONS__*/
renderStats();renderInsights();showView(requestedView||'dashboard');
const savedEntry=safeRead('dugout-entry');
if(savedEntry&&!state.manualEntryAttempt)$('entryInput').value=savedEntry;
try{await loadBase();if(savedEntry&&!state.manualEntryAttempt){$('entryInput').value=savedEntry;await loadTeam(savedEntry);}}catch(error){
 $('dataStatus').innerHTML='<span style="color:var(--orange)">●</span> Connection delayed';$('deadline').textContent='Not yet available';
 if(savedEntry&&!state.manualEntryAttempt)$('entryInput').value=savedEntry;
 const cachedBundle=safeRead('fpl-bootstrap-cache-v1'),cachedTeam=savedEntry?safeRead('fpl-team-cache-v1-'+savedEntry):null;
 if(cachedBundle?.bootstrap?.elements?.length&&Array.isArray(cachedBundle.fixtures)){
  const bootstrap=cachedBundle.bootstrap;state.bootstrap=bootstrap;state.players=Object.fromEntries(bootstrap.elements.map(p=>[p.id,p]));state.teams=Object.fromEntries(bootstrap.teams.map(t=>[t.id,t]));state.fixtures=cachedBundle.fixtures;state.next=bootstrap.events.find(e=>e.is_next)||bootstrap.events.find(e=>!e.finished&&!e.is_current);state.gw=defaultGameweek(bootstrap.events);
  if(cachedTeam?.entry?.id&&cachedTeam?.picks){state.entry=cachedTeam.entry;state.picks=cachedTeam.picks;state.gw=Number(cachedTeam.selectedGw)||state.gw;state.live=Object.fromEntries((cachedTeam.live?.elements||[]).map(p=>[p.id,p]));$('entryInput').value=String(cachedTeam.entry.id);renderStats();renderPitch();renderInsights();renderPlanner();renderLeagueOptions();document.body.classList.add('has-team');document.getElementById('connectionGate')?.classList.add('hidden');}
  renderStats();renderInsights();renderScout();renderFixtures();alertMessage('Official FPL is temporarily unavailable. Showing your last verified team snapshot. Press Reload when the source is back.');
 }else{alertMessage('Official FPL data is temporarily unavailable. Your saved Entry ID is still here. Use Reload to try again.');$('radar').innerHTML='<div class="empty">Official FPL data could not be reached. No stale team data is shown as current.</div>';}
}


