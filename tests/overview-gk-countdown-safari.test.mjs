import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {keeperScoutRows} from '../domain.mjs';
import {deadlineBrief} from '../dashboard-signals.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=read('dashboard-layout.js'),focus=read('dashboard-focus.js'),css=read('overview-gk-spacing.css');
const start=dashboard.indexOf('function dashboardPositionCards(){'),end=dashboard.indexOf('\nfunction dashboardFixtureRuns()',start);
assert.ok(start>=0&&end>start);
const positionScript=dashboard.slice(start,end)+'\nglobalThis.getCard=dashboardPositionCards;';
function fixture(pos='GK'){
 const keeper={id:7,element_type:1,web_name:'Verbruggen',team:1,minutes:450,starts:5,now_cost:45,saves_per_90:'3.6',clean_sheets:2,points_per_game:'5.2',expected_goals_conceded_per_90:'1.2',bps:120};
 const defender={id:8,element_type:2,web_name:'Defender',team:2,minutes:650};
 const players={7:keeper,8:defender},ctx=vm.createContext({
  ext:{dashboardPosition:pos,snapshot:null},
  state:{bootstrap:{events:[]},next:{id:8},players,fixtures:[{started:true,event:7,team_h:1,team_a:2}],teams:{1:{short_name:'BHA'},2:{short_name:'MCI'}}},
  allPlayers:()=>Object.values(players),snapshotIsCurrent:()=>false,keeperScoutRows,labPlayer:p=>Boolean(p),
  ownIds:()=>new Set([7]),fmt:(v,places)=>v==null?'—':Number(v).toFixed(places??0),esc:String,
  sourceNote:x=>'<p>'+x+'</p>',snapshotNotice:()=>'<p>Snapshot unavailable</p>',
  panel:(title,body)=>'<section><h2>'+title+'</h2>'+body+'</section>'
 });
 vm.runInContext(positionScript,ctx);
 return {ctx,html:ctx.getCard()};
}
test('Overview, not just Scout, provides GK alongside DEF MID FWD',()=>{
 const {html}=fixture('GK');
 for(const pos of ['GK','DEF','MID','FWD'])assert.match(html,new RegExp('data-dashboard-position="'+pos+'"'));
 assert.match(html,/data-dashboard-position="GK" aria-pressed="true" class="active"/);
 assert.match(html,/GK worth a look/);
 assert.match(html,/Verbruggen/);
 assert.match(html,/Save volume/);
 assert.match(html,/Clean sheets/);
 assert.match(html,/Concede the least/);
 assert.match(html,/3\.60/);
 assert.match(html,/Official FPL/);
 assert.doesNotMatch(html,/0\.00 xP/);
});
test('DEF remains available and is not misrepresented as official GK stats',()=>{
 const {html}=fixture('DEF');
 assert.match(html,/data-dashboard-position="DEF" aria-pressed="true"/);
 assert.match(html,/DEF worth a look/);
 assert.match(html,/Validated data not yet available/);
});
test('scouting click delegation continues to support new GK tab',()=>{
 assert.match(dashboard,/if\(b\.dataset\.dashboardPosition\)\{ext\.dashboardPosition=b\.dataset\.dashboardPosition;renderDashboardOverview\(\);\}/);
});
test('four dashboard tabs form a 2x2 phone grid and cards have visible gutters',()=>{
 assert.match(css,/#dashboardOverview > \.dashboard-pos-tabs\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/s);
 assert.match(css,/\.decision-deep-content \.focus-grid\s*\{[^}]*row-gap:18px!important/s);
 assert.match(css,/\.decision-deep-content \.focus-grid > \.focus-card\s*\{[^}]*margin:0!important/s);
 assert.match(css,/#dashboardOverview \.adv-card h3\s*\{/);
 assert.doesNotMatch(css,/\.approved-header\s*\{/);
});
test('deadline label updates without repainting the cards or fetching data every second',()=>{
 const begin=focus.indexOf('function tickDashboardDeadline(){'),end=focus.indexOf('setInterval(tickDashboardDeadline,1000)',begin);
 assert.ok(begin>0&&end>begin);
 const target={textContent:'Old countdown'},time=new Date(Date.now()+7200500).toISOString();
 const state={entry:{id:3462711},view:'dashboard',next:{deadline_time:time}};
 const context=vm.createContext({state,document:{hidden:false,getElementById:id=>id==='dashboardDeadlineCountdown'?target:null},deadlineBrief});
 vm.runInContext(focus.slice(begin,end)+'\nglobalThis.tick=tickDashboardDeadline;',context);
 context.tick();
 assert.match(target.textContent,/^2 jam 0 menit \d+ detik$/);
 assert.match(focus,/role="timer" aria-live="off"/);
 assert.match(focus,/setInterval\(tickDashboardDeadline,1000\)/);
 assert.doesNotMatch(focus.slice(begin,end),/api\(|renderDashboardBrief\(|renderDashboardNews\(/);
});
test('Vercel and Worker builds keep the Overview recovery stylesheet last',()=>{
 for(const file of ['scripts/build-vercel.mjs','scripts/build.mjs']){
  const source=read(file);
  assert.ok(source.indexOf("readFileSync('overview-gk-spacing.css','utf8')")>source.indexOf("readFileSync('mobile-more-dialog.css','utf8')"),file);
 }
});
