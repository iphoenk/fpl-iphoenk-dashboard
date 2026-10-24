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
  state,Date,Number,String,Boolean,Math,esc:String,safeName:String,
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
 assert.match(html,/LIVE/);
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
 assert.match(overviewHtml,/>FT<\/small>/);
 assert.doesNotMatch(overviewHtml,/FT pending/);
 const fixturesHtml=c.cards();
 assert.match(fixturesHtml,/1 – 1/);
 assert.match(fixturesHtml,/>FT</);
 assert.doesNotMatch(fixturesHtml,/FT pending/);
 ipswich.team_a_score=null;
 assert.match(c.overview(),/FT pending/);
 assert.match(c.cards(),/FT pending/);
});
