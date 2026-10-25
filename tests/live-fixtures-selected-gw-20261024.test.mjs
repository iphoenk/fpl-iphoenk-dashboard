import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const decision=readFileSync(new URL('../decision-first.js',import.meta.url),'utf8');
const isolate=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,'fixture function extraction must succeed');return source.slice(a,b);};
const helper=isolate(ui,'function selectedGwFixtures(', '\nfunction currentFixture(');
const compact=isolate(ui,'function liveFixtureCards(', '\nfunction renderFixturesEnhanced(');
const overview=isolate(decision,'  let fixturePageGw=null','\n  function renderDecision(){');
const phases=isolate(ui,'function fixturePhase(', '\nfunction showView(');

// Pin the clock: live/pending states depend on Date.now(); fixtures kick off 2026-10-24T17:00Z.
const PINNED_NOW=Date.parse('2026-10-24T18:00:00Z');
class PinnedDate extends Date{constructor(...a){a.length?super(...a):super(PINNED_NOW)}static now(){return PINNED_NOW}}
function setup(gw=8){
 const fixtures=[{id:70,event:7,team_h:41,team_a:42,kickoff_time:'2026-10-17T17:00:00Z',started:true,finished:true,team_h_score:4,team_a_score:1}];
 const teams={41:{name:'PREVIOUS GW ONLY',short_name:'OLD'},42:{name:'Previous Away',short_name:'PA'}};
 for(let n=1;n<=10;n++){
  const h=n*2-1,a=n*2;
  teams[h]={name:'GW8 Home '+n,short_name:'H'+n};
  teams[a]={name:'GW8 Away '+n,short_name:'A'+n};
  fixtures.push({
   id:80+n,event:8,team_h:h,team_a:a,
   kickoff_time:n===10?null:'2026-10-24T17:00:00Z',
   started:n<=2,finished:n===1,
   team_h_score:n===1?2:null,team_a_score:n===1?1:null,
   team_h_difficulty:3,team_a_difficulty:4
  });
 }
 teams[43]={name:'NEXT GW ONLY',short_name:'NEW'};teams[44]={name:'Next Away',short_name:'NA'};
 fixtures.push({id:90,event:9,team_h:43,team_a:44,kickoff_time:'2026-10-31T17:00:00Z',started:false,finished:false});
 const state={gw,fixtures,teams},scope=vm.createContext({
  state,Date:PinnedDate,Number,String,Boolean,Math,esc:String,safeName:String,
  fmt:value=>String(value),localKickoff:value=>value||'Kickoff TBC',
  fixturePrediction:()=> 'FDR lean: home'
 });
 vm.runInContext(helper+'\n'+phases+'\n'+compact+'\n'+overview+'\nglobalThis.select=selectedGwFixtures;globalThis.cards=liveFixtureCards;globalThis.overview=decisionFixtureTicker;',scope);
 return scope;
}
test('selected GW is sole source for fixtures; all ten included with TBC and double-GW support',()=>{
 const c=setup();
 assert.equal(c.select().length,10);
 assert.equal(c.select()[0].id,81);
 assert.equal(c.select().at(-1).id,90);
 assert.equal(c.select().some(f=>f.event!==8),false);
 c.state.gw=7;assert.equal(c.select().length,1);
 c.state.gw=99;assert.equal(c.select().length,0);
});
test('Overview fixture card shows GW8 only, all matches, including 10th and live/FT, not stale GW7/9',()=>{
 const c=setup(),html=c.overview();
 assert.match(html,/Fixtures & results/);assert.match(html,/GW 8/);
 assert.match(html,/GW8 Home 10/);
 assert.match(html,/GW8 Home 1/);
 assert.match(html,/10 matches · GW 8/);
 assert.match(html,/Kickoff TBC/);
 assert.match(html,/class="decision-fixture-status live"/);
 assert.match(html,/aria-label="Live match score/);
 assert.match(html,/2 – 1/);
 assert.doesNotMatch(html,/PREVIOUS GW ONLY|NEXT GW ONLY/);
 assert.doesNotMatch(html,/GW 7|GW 9/);
 c.state.gw=7;const prev=c.overview();
 assert.match(prev,/GW 7/);
 assert.match(prev,/PREVIOUS GW ONLY/);
 assert.doesNotMatch(prev,/GW8 Home/);
});
test('Fixtures page live cards use selected GW and honor completed/live/upcoming statuses',()=>{
 const c=setup(),html=c.cards();
 assert.match(html,/GW8 Home 10|>H10</);
 assert.doesNotMatch(html,/<span>GW 8<\/span>/);
 assert.match(html,/FT/);
 assert.match(html,/LIVE/);
 assert.match(html,/Upcoming/);
 assert.match(html,/Kickoff TBC/);
 assert.doesNotMatch(html,/OLD|NEW/);
 c.state.gw=9;assert.match(c.cards(),/>NEW</);
 assert.doesNotMatch(c.cards(),/>H10</);
});
test('gameweek changes refresh fixtures and six-week outlook starts from selected GW',()=>{
 assert.match(ui,/renderStats\(\);renderPitch\(\);renderInsights\(\);renderPlanner\(\);renderLeagueOptions\(\);renderFixtures\(\)/);
 assert.match(ui,/else\{state\.gw=Number\(\$\('gwSelect'\)\.value\);renderStats\(\);renderFixtures\(\);\}/);
 assert.match(ui,/const weeks=Array\.from\(\{length:6\},\(_,i\)=>\(Number\(state\.gw\)\|\|state\.next\?\.id\|\|39\)\+i\)/);
});

test('1–1 scored Official FPL provisional full-time appears FT on Overview and fixtures',()=>{
 const c=setup(),ipswich=c.state.fixtures.find(f=>f.id===81);
 ipswich.finished=false;
 ipswich.finished_provisional=true;
 ipswich.started=true;
 ipswich.team_h_score=1;
 ipswich.team_a_score=1;
 const overviewHtml=c.overview();
 assert.match(overviewHtml,/>1 – 1</);
 assert.match(overviewHtml,/class="decision-fixture-status finished"/);
 assert.match(overviewHtml,/aria-label="Full time score 1 – 1"/);
 assert.doesNotMatch(overviewHtml,/>FT<\/small>/);
 assert.doesNotMatch(overviewHtml,/FT pending/);
 const fixturesHtml=c.cards();
 assert.match(fixturesHtml,/1 – 1/);
 assert.match(fixturesHtml,/>FT</);
 assert.doesNotMatch(fixturesHtml,/FT pending/);
 ipswich.team_a_score=null;
 assert.match(c.overview(),/FT pending/);
 assert.match(c.cards(),/FT pending/);
});

test('compact Overview shows every fixture without All link and always formats kickoff 24-hour',()=>{
 const c=setup(),html=c.overview();
 assert.equal((html.match(/class="decision-fixture-row"/g)||[]).length,10,'all ten fixtures must appear inline');
 assert.doesNotMatch(html,/data-goto="fixtures"|All ↗/);
 assert.match(html,/local time \(24h\)/);
 assert.doesNotMatch(html,/\b(?:AM|PM)\b/);
 assert.match(decision,/toLocaleTimeString\('en-GB',\{hour:'2-digit',minute:'2-digit',hour12:false\}\)/);
 assert.doesNotMatch(html,/Est\. xG [0-9.]+ – [0-9.]+/);
});
test('pre-match experimental xG is inline beside each team, not under kickoff',()=>{
 const c=setup(),gw8=c.state.fixtures.find(f=>f.id===86);
 gw8.started=false;gw8.finished=false;
 c.projectedFixtureXg=f=>f.id===86?{home:1.23,away:0.87}:null;
 const html=c.overview();
 const target=html.split('<div class="decision-fixture-row">').find(fragment=>fragment.includes('GW8 Home 6'));
 assert.ok(target,'the selected fixture must exist');
 const home=target.indexOf('class="decision-fixture-team home"'),firstXg=target.indexOf('xG <b>1.23</b>');
 const center=target.indexOf('class="decision-fixture-center"'),secondXg=target.indexOf('xG <b>0.87</b>');
 const away=target.indexOf('class="decision-fixture-team away"');
 assert.ok(home>=0&&firstXg>home&&center>firstXg&&away>center&&secondXg>away);
 const centerOnly=target.slice(center,away);
 assert.doesNotMatch(centerOnly,/xG|Est\./,'no combined xG line under the kickoff');
 assert.equal((html.match(/decision-fixture-xg/g)||[]).length,2,'only sides with evidence show xG');
 assert.match(html,/Est\. xG <b>1\.23<\/b>/);
 assert.match(html,/Est\. xG <b>0\.87<\/b>/);
 assert.match(html,/xG: experimental pre-match estimate/);
});

test('the fixtures page also uses the device-local 24-hour HH:mm clock',()=>{
 const fn=isolate(ui,'function localKickoff(', '\nfunction fixturePrediction(');
 const c=vm.createContext({Date,Number});
 vm.runInContext(fn+'\nglobalThis.format=localKickoff;',c);
 const formatted=c.format('2026-10-24T17:25:00Z');
 assert.match(formatted,/\b\d{2}:\d{2}\b/);
 assert.doesNotMatch(formatted,/AM|PM/i);
 assert.match(ui,/toLocaleString\('en-GB',\{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false\}\)/);
});
test('compact all-fixture CSS fits team-side xG, status and GW navigation on mobile',()=>{
 const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
 const start=css.indexOf('/* Issue #157: compact fully visible fixtures');
 const end=css.indexOf('/* Issue #67: one genuinely slim',start);
 assert.ok(start>0&&end>start);
 const rules=css.slice(start,end);
 assert.match(rules,/\.decision-fixture-list\{[^}]*max-height:none!important/s);
 assert.match(rules,/\.decision-fixture-row\{[^}]*grid-template-columns:minmax\(0,1fr\) 70px minmax\(0,1fr\)!important/s);
 assert.match(rules,/\.decision-fixture-team-name\{/);
 assert.match(rules,/\.decision-fixture-xg\{/);
 assert.match(rules,/@media\(max-width:1099px\)/);
 assert.match(rules,/@media\(max-width:767px\)/);
 assert.match(rules,/grid-template-columns:minmax\(0,1fr\) 60px minmax\(0,1fr\)!important/);
 assert.match(rules,/padding:4px 5px!important/);
});

test('Overview score states are color-only for finished and live, retaining accessible text',()=>{
 const c=setup(),html=c.overview();
 const finish=html.split('<div class="decision-fixture-row">').find(r=>r.includes('GW8 Home 1'));
 const playing=html.split('<div class="decision-fixture-row">').find(r=>r.includes('GW8 Home 2'));
 assert.ok(finish&&playing);
 assert.match(finish,/class="decision-fixture-status finished"/);
 assert.match(finish,/aria-label="Full time score 2 – 1"/);
 assert.doesNotMatch(finish,/<small[^>]*>FT<\/small>/);
 assert.match(playing,/class="decision-fixture-status live"/);
 assert.match(playing,/aria-label="Live match score/);
 assert.doesNotMatch(playing,/<small[^>]*>LIVE<\/small>/);
 c.state.fixtures.find(f=>f.id===81).team_h_score=null;
 const incomplete=c.overview();
 assert.match(incomplete,/<small title="Official FPL result not yet confirmed">FT<\/small>/);
});
test('larger club labels and plain-text experimental xG remain readable on mobile and desktop',()=>{
 const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
 const start=css.indexOf('/* Issue #157: compact fully visible fixtures');
 const end=css.indexOf('/* Issue #67: one genuinely slim',start);
 assert.ok(start>=0&&end>start);
 const style=css.slice(start,end);
 assert.match(style,/\.decision-fixture-team \.decision-fixture-team-name span\{[^}]*font-size:14px!important/s);
 assert.match(style,/@media\(max-width:767px\)[^]*font-size:13px!important/);
 assert.match(style,/\.decision-fixture-xg\{[^}]*border:0;border-radius:0;background:transparent/s);
 assert.match(style,/\.decision-fixture-status\.finished\{[^}]*#e0f3e9!important[^}]*#096341!important/s);
 assert.match(style,/\.decision-fixture-status\.live\{[^}]*#ffe3e8!important[^}]*#a7193a!important/s);
 assert.match(style,/\.decision-fixture-status\.pending\{/);
});

test('xG figures use regular weight without altering fixture layout or text size',()=>{
 const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
 const start=css.indexOf('body.has-team[data-view=dashboard] .decision-fixture-xg b{',css.indexOf('/* Issue #157: compact fully visible fixtures'));
 const end=css.indexOf('}',start);
 assert.ok(start>=0&&end>start);
 const rule=css.slice(start,end+1);
 assert.match(rule,/font-size:11px;font-weight:400/);
 assert.doesNotMatch(rule,/font-weight:(?:600|700|800|900)/);
 assert.match(css,/body\.has-team\[data-view=dashboard\] \.decision-fixture-xg\{/);
});
