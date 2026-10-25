import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {officialPhotoSources} from '../domain.mjs';

const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const decision=readFileSync(new URL('../decision-first.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
const section=(s,start,end)=>{
 const a=s.indexOf(start),b=s.indexOf(end,a);
 assert.ok(a>=0&&b>a,'expected function '+start);
 return s.slice(a,b);
};
test('Official player status is shown by card shading and tooltip, with no "!" badge',()=>{
 assert.doesNotMatch(ui,/class="player-fitness/);
 assert.doesNotMatch(css,/\.player-fitness/);
 const card=section(decision,'  function pitchCard(){','\n  function leagueCard(){');
 assert.doesNotMatch(card,/fitness flag|Captain:|Vice:/);
});
test('Konsa photo rotates through trusted official assets and falls back to shirt',()=>{
 const p={id:31,code:199798,photo:'199798.jpg',has_temporary_code:true,web_name:'Konsa'},sources=officialPhotoSources(p);
 assert.equal(sources.length,7);
 assert.match(sources[0],/static\.sky\.it/);
 assert.match(sources[1],/premierleague25\/photos\/players\/110x140/);
 assert.match(sources[2],/premierleague\/photos\/players\/110x140/);
 assert.match(sources[3],/250x250/);
 assert.match(sources[4],/40x40/);
 let callback;
 const c=vm.createContext({
  state:{players:{31:p}},Number,String,officialPhotoSources,
  document:{addEventListener:(name,fn,capture)=>{assert.equal(name,'error');assert.equal(capture,true);callback=fn;}}
 });
 vm.runInContext(section(ui,"document.addEventListener('error',",'\nfunction fixturePhase('),c);
 const classes=new Set();
 const img={
  tagName:'IMG',dataset:{playerPhoto:'31',photoStage:'0'},src:sources[0],
  hasAttribute:n=>n==='data-player-photo',
  classList:{remove:n=>classes.delete(n)},
  parentElement:{classList:{add:n=>classes.add(n)}}
 };
 for(let i=1;i<sources.length;i++){
  callback({target:img});
  assert.equal(img.src,sources[i]);assert.equal(img.dataset.photoStage,String(i));
 }
 callback({target:img});
 assert.equal(classes.has('failed'),true);
});
test('Expired kickoff is not incorrectly LIVE; final and provisional status stay authoritative',()=>{
 const src=section(ui,'function fixturePhase(', '\nfunction projectedFixtureXg(');
 const c=vm.createContext({Date,Number});
 vm.runInContext(src+'\nglobalThis.phase=fixturePhase;',c);
 const past=new Date(Date.now()-6*3600000).toISOString(),recent=new Date(Date.now()-30*60000).toISOString();
 assert.equal(c.phase({started:true,finished:true,kickoff_time:past}),'finished');
 assert.equal(c.phase({started:true,finished:false,finished_provisional:true,kickoff_time:past}),'provisional');
 assert.equal(c.phase({started:true,finished:false,kickoff_time:past}),'awaiting');
 assert.equal(c.phase({started:true,finished:false,kickoff_time:recent}),'live');
});
test('Estimated xG is derived from player xG and keeper xGC, suppressed without evidence or after kickoff',()=>{
 const src=section(ui,'function fixturePhase(', '\nfunction showView(');
 const future=new Date(Date.now()+24*3600000).toISOString();
 const fixture={event:8,team_h:1,team_a:2,started:false,finished:false,kickoff_time:future};
 const fixtures=Array.from({length:3},(_,i)=>[{team_h:1,team_a:3,finished:true},{team_h:2,team_a:4,finished:true}]).flat();
 const players={};
 for(const team of [1,2]){
  for(let i=0;i<9;i++)players[team*100+i]={id:team*100+i,team,element_type:i===0?1:3,expected_goals:i===0?'0.00':'0.60',...(i===0?{expected_goals_conceded:team===1?'3.00':'3.60'}:{})};
 }
 const state={fixtures,players};
 const c=vm.createContext({state,Date,Number,String,Object,Math});
 vm.runInContext(src+'\nglobalThis.project=projectedFixtureXg;',c);
 const x=c.project(fixture);
 assert.ok(x&&x.home>0&&x.away>0);
 assert.ok(Number.isFinite(x.home)&&Number.isFinite(x.away));
 assert.match(x.source,/Official FPL/);
 assert.equal(c.project({...fixture,finished:true}),null);
 assert.equal(c.project({...fixture,started:true}),null);
 state.fixtures=[];
 assert.equal(c.project(fixture),null);
});
test('Fixture navigation is bounded and independent of published squad selection',()=>{
 assert.match(decision,/let fixturePageGw=null,fixtureTeamGw=null/);
 assert.match(decision,/data-fixture-step="-1"/);
 assert.match(decision,/data-fixture-step="1"/);
 assert.match(decision,/fixturePageGw=target;renderDecision\(\)/);
 assert.doesNotMatch(section(decision,'  function decisionFixtureTicker(){','\n  function renderDecision(){'),/<small>GW '\+safeName\(gw\)/);
 assert.match(ui,/setInterval\(refreshCurrentFixtures,120000\)/);
 assert.match(decision,/fpl-fixtures-updated/);
});

test('provisional final score 1–1 displays FT; absent score remains explicitly pending',()=>{
 const src=section(ui,'function fixturePhase(', '\nfunction projectedFixtureXg(');
 const scope=vm.createContext({Date,Number});
 vm.runInContext(src+'\nglobalThis.status=fixtureMatchStatus;',scope);
 const ended={started:true,finished:false,finished_provisional:true,team_h_score:1,team_a_score:1,kickoff_time:'2026-10-23T19:00:00Z'};
 assert.equal(scope.status(ended),'FT');
 assert.equal(scope.status({...ended,team_h_score:0,team_a_score:0}),'FT');
 assert.equal(scope.status({...ended,team_a_score:null}),'FT pending');
 assert.equal(scope.status({...ended,finished:true,team_a_score:null}),'FT');
 assert.equal(scope.status({...ended,started:true,finished:false,finished_provisional:false},Date.parse('2026-10-24T07:00:00Z')),'Final pending');
 assert.match(section(decision,'  function decisionFixtureTicker(){','\n  function renderDecision(){'),/fixtureMatchStatus\(f\)/);
 assert.match(section(ui,'function liveFixtureCards(){','\nfunction renderFixturesEnhanced()'),/fixtureMatchStatus\(f\)/);
});
