import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {keeperScoutRows} from '../domain.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('dashboard-layout.js'),style=read('layout-rhythm.css');
const start=js.indexOf('function dashboardPositionCards(){'),end=js.indexOf('\nfunction dashboardFixtureRuns()',start);
assert.ok(start>=0&&end>start);

function render(pos='GK'){
 const players={
  1:{id:1,web_name:'Verbruggen',team:1,element_type:1,minutes:720,starts:8,now_cost:45,
     saves_per_90:'3.75',clean_sheets:3,expected_goals_conceded_per_90:'1.2',bps:123},
  2:{id:2,web_name:'Tzolakis',team:2,element_type:1,minutes:540,starts:6,now_cost:40,
     saves_per_90:'2.8',clean_sheets:2,expected_goals_conceded_per_90:'1.8',bps:100},
  3:{id:3,web_name:'LessThan180',team:2,element_type:1,minutes:85,starts:1,now_cost:40,saves_per_90:'8.6'},
 };
 const ctx=vm.createContext({ext:{dashboardPosition:pos,snapshot:null},state:{bootstrap:{events:[]},next:{id:8},players,teams:{1:{short_name:'BHA'},2:{short_name:'OLY'}},fixtures:[{started:true,event:7,team_h:1,team_a:2}]},
  keeperScoutRows,allPlayers:()=>Object.values(players),candidatePlayers:()=>Object.values(players),isInactivePlayer:()=>false,inactiveToggle:()=>"",labPlayer:()=>null,snapshotIsCurrent:()=>false,
  ownIds:()=>new Set([1]),fmt:(v,p)=>v==null?'—':Number(v).toFixed(p??0),esc:String,
  sourceNote:text=>'<p>'+text+'</p>',snapshotNotice:()=>'<p>Provenance note</p>',
  panel:(title,body)=>'<section>'+title+body+'</section>'});
 vm.runInContext(js.slice(start,end)+'\nglobalThis.render=dashboardPositionCards',ctx);
 return ctx.render();
}
test('Overview GK renders Official FPL keeper records WITHOUT relying on outfield snapshot',()=>{
 const html=render('GK');
 assert.match(html,/data-dashboard-position="GK" aria-pressed="true"/);
 assert.match(html,/Verbruggen/);
 assert.match(html,/Tzolakis/);
 assert.match(html,/Save volume/);
 assert.match(html,/Clean sheets/);
 assert.match(html,/3\.75/);
 assert.doesNotMatch(html,/LessThan180/);
 assert.match(html,/data-dashboard-position="GK"[^>]*>[^]*?<small>2<\/small>/);
});
test('missing outfield snapshot never silently invents model scores or errors in GK',()=>{
 const html=render('GK');
 assert.match(html,/GK worth a look/);
 assert.doesNotMatch(html,/Snapshot unavailable/);
 assert.doesNotMatch(html,/NaN/);
});
test('model methodology stays accessible in a collapsed details with an explanatory summary',()=>{
 for(const pos of ['GK','DEF']){
  const html=render(pos);
  assert.match(html,/<details class="overview-methodology"><summary>Source & methodology<\/summary>/);
  assert.match(html,/<\/details>/);
 }
});
test('mobile Overview becomes true vertical hierarchy rather than legacy display:contents',()=>{
 assert.match(style,/@media\(max-width:767px\)/);
 assert.match(style,/\.decision-deep-content > \.dashboard-columns\s*\{[^}]*display:flex!important/s);
 assert.match(style,/\.decision-deep-content \.dashboard-main\s*\{[^}]*display:block!important/s);
 assert.match(style,/\.decision-deep-content #dashboardOverview\s*\{[^}]*display:block!important/s);
 assert.match(style,/\.decision-deep-content \.dashboard-brief \.focus-grid\s*\{[^}]*display:flex!important/s);
 assert.match(style,/\.focus-grid > \.focus-card \+ \.focus-card\s*\{[^}]*margin-top:var\(--rhythm-3\)!important/s);
 assert.match(style,/order:0!important/);
 assert.match(style,/#dashboardOverview > \.dashboard-pos-tabs\s*\{[^}]*margin:0 0 var\(--rhythm-3\)!important/s);
});
test('all primary pages share one small-screen spacing baseline',()=>{
 for(const marker of ['.page-view:not(.hidden)',' .panel','.adv-section','.adv-grid','.toolbar','.filters','.pagination','.table-wrap','.adv-card']){
  assert.ok(style.includes(marker),marker);
 }
 for(const id of ['view-tim','view-liga','view-transfers','view-planning','view-labs','view-fixtures','view-watchlist','view-news'])
  assert.ok(style.includes(id),id);
 assert.match(style,/@media\(min-width:768px\) and \(max-width:1099px\)/);
 assert.match(style,/@media\(min-width:1100px\)/);
 assert.doesNotMatch(style,/\.approved-header\s*\{/);
 assert.doesNotMatch(style,/\.approved-brand\s*\{/);
 assert.doesNotMatch(style,/\.mobile-bottom-nav\s*\{/);
});
test('mobile metadata uses an accessible disclosure, safe scroll and theme tokens',()=>{
 assert.match(style,/\.overview-methodology > summary::after/);
 assert.match(style,/\.overview-methodology\[open\] > summary::after/);
 assert.match(style,/safe-area-inset-bottom/);
 assert.match(style,/padding-bottom:calc\(155px/);
 assert.match(style,/background:var\(--panel\)/);
 assert.match(style,/color:var\(--text\)/);
});
test('Vercel and Worker CSS bundles end in the same responsive visual layer',()=>{
 for(const path of ['scripts/build-vercel.mjs','scripts/build.mjs']){
  const source=read(path);
  const last=source.indexOf("readFileSync('layout-rhythm.css','utf8')");
  assert.ok(last>source.indexOf("readFileSync('overview-gk-spacing.css','utf8')"),path);
 }
});
