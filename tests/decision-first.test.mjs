import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync(new URL('../decision-first.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
const shell=readFileSync(new URL('../desktop-shell.js',import.meta.url),'utf8');
const theme=readFileSync(new URL('../theme.js',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build-vercel.mjs',import.meta.url),'utf8');
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('bundle includes decision-first JS/CSS last without changing original logo',()=>{
 assert.match(build,/desktop-shell\.js','decision-first\.js/);
 assert.match(build,/readFileSync\('decision-first\.css','utf8'\)/);
 assert.match(build,/readFileSync\('assets\/fpl-iphoenk-logo\.png'\)/);
});
test('no shrinking zoom survives in JS or final dashboard CSS',()=>{
 assert.match(shell,/removeProperty\('zoom'\)/);
 assert.doesNotMatch(shell,/lay\.style\.zoom|Math\.max\(\.7/);
 assert.match(css,/zoom:1!important/);
});
test('official starting XI and four-player bench remain visible together',()=>{
 assert.match(js,/getElementById\('pitch'\)/);
 assert.match(js,/getElementById\('bench'\)/);
 assert.match(css,/\.decision-bench \.bench-row\{display:grid!important;grid-template-columns:repeat\(4/);
 assert.doesNotMatch(js,/data-view-bench/);
});
test('classic mini-league selector persists by FPL entry, validates membership and refreshes standings',()=>{
 assert.match(js,/decisionLeagueSelect/);
 assert.match(js,/fpl-iphoenk-league-/);
 assert.match(js,/leagueList\(\)\.some\(l=>Number\(l\.id\)===id\)/);
 assert.match(js,/refreshLeagueSnapshot\(id\)/);
 assert.match(js,/local\.standings\.results/);
 assert.match(js,/Standings not loaded/);
});
test('next GW displays hold, one transfer and alternatives without invented points',()=>{
 assert.match(js,/A · Hold/);
 assert.match(js,/B · 1 Transfer/);
 assert.match(js,/C · 2 Transfers/);
 assert.match(js,/PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1/);
 assert.match(js,/No legal transfer package/);
 assert.match(js,/publicPlan/);
 assert.match(js,/vice_captain/);
});
test('desktop and tablet are in one design family while mobile stacks',()=>{
 assert.match(css,/@media\(min-width:768px\) and \(max-width:1099px\)/);
 assert.match(css,/@media\(min-width:1100px\)/);
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/\.decision-primary\{display:grid/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.mobile-bottom-nav\{display:none!important\}/);
});
test('single theme toggle displays opposite mode and official calm color tokens',()=>{
 assert.match(theme,/themeToggle\.id='themeToggle'/);
 assert.match(theme,/dark\?'Light':'Dark'/);
 assert.match(css,/#f7f9fb/i);
 assert.match(css,/#00845e/i);
 assert.match(css,/var\(--panel\)/);
});
test('About remains a reachable original navigation route',()=>{
 assert.match(read('desktop-shell.js'),/about:'About'/);
 assert.match(read('about-ui.js'),/view-about/);
});

test('Worker and Vercel build pipelines both include decision-first JS and CSS',()=>{
 const worker=read('scripts/build.mjs');
 assert.ok(worker.includes("'decision-first.js'"));
 assert.ok(worker.includes("readFileSync('decision-first.css'"));
});


test('Overview defaults to one GW and marks price-proxy transfer economics',()=>{
 assert.match(js,/horizon:1,loading:false,report:null/);
 assert.match(js,/\[1,3,5\]/);
 assert.match(js,/PUBLIC_CURRENT_PRICE_PROXY_INDICATIVE/);
 assert.match(js,/This may not be affordable in your account/);
 assert.match(js,/Gross difference vs Hold/);
});
test('decision response must match the active canonical squad before rendering',()=>{
 assert.match(js,/function sameSquad\(a,b\)/);
 assert.match(js,/function decisionMatchesActiveTeam\(report,id,gw\)/);
 assert.match(js,/!decisionMatchesActiveTeam\(report,id,gw\)/);
 assert.match(js,/sameSquad\(team\.squad,state\.picks\?\.picks\)/);
});

test('Current Team shows C/VC only on pitch, not in a duplicate bottom footer',()=>{
 const start=js.indexOf('  function pitchCard(){');
 const end=js.indexOf('\n  function leagueCard(){',start);
 assert.ok(start>=0&&end>start);
 const state={
  gw:8,
  picks:{picks:[
   {position:1,element:1,is_captain:true},
   {position:2,element:2,is_vice_captain:true}
  ]},
  players:{
   1:{element_type:1,web_name:'Haaland',status:'a'},
   2:{element_type:2,web_name:'Groß',status:'a'}
  }
 };
 const pitch='<span class="cap cap-captain">C</span><span class="cap cap-vice">VC</span>';
 const context=vm.createContext({
  state,safeName:String,
  document:{getElementById:id=>({innerHTML:id==='pitch'?pitch:'Four bench player tiles'})}
 });
 vm.runInContext(js.slice(start,end)+'\nglobalThis.renderCard=pitchCard;',context);
 const result=context.renderCard();
 assert.match(result,/Current Team/);
 assert.match(result,/cap-captain/);
 assert.match(result,/cap-vice/);
 assert.match(result,/Bench/);
 assert.doesNotMatch(result,/Captain:|Vice:/);
 assert.doesNotMatch(result,/Haaland|Groß/);
 assert.doesNotMatch(result,/decision-foot/);
 assert.doesNotMatch(result,/fitness flag/);
 state.players[2].status='d';
 const flagged=context.renderCard();
 assert.doesNotMatch(flagged,/fitness flag/);
 assert.doesNotMatch(flagged,/decision-foot/);
});

test('Next GW Plan footer shows V6 status with a distinct glyph per state, NOT REPORTED when absent, never V12 readiness',()=>{
 const start=js.indexOf('  const V6_STATES=');
 const end=js.indexOf('\n  let fixturePageGw=null',start);
 assert.ok(start>=0&&end>start);
 const baseReport={contract:'PUBLIC_FPL_MULTIGW_ADVISORY_V2',horizon:1,status:'ready',scenarios:{},team_state:{free_transfers:1,bank:0},economics_status:null};
 function render(v6,withSource=true){
  const report=withSource?{...baseReport,source:{provider:'Official FPL',...(v6===undefined?{}:{v6})}}:baseReport;
  const state={next:{id:8},entry:{id:42},players:{}},publicPlan={entryId:42,gw:8,horizon:1,loading:false,error:null,report};
  const context=vm.createContext({safeName:String,number:n=>String(n),money:n=>'£'+n,fmt:(n,d)=>Number(n).toFixed(d),
   deviceDateTime:x=>Number.isFinite(new Date(x).getTime())?'OBS<'+x+'>':'Tanggal belum tersedia',publicFormationEvidence:()=>'',state,publicPlan});
  vm.runInContext(js.slice(start,end)+'\nglobalThis.renderCard=planCard;',context);
  return context.renderCard();
 }
 const glyphs={};
 for(const [status,label] of [['VERIFIED','Verified'],['STALE','Stale'],['UNVERIFIED','Unverified'],['UNAVAILABLE','Unavailable']]){
  const out=render({status,observed_at:'2026-10-25T05:13:00.858Z'});
  assert.match(out,new RegExp('data-v6-status="'+status+'"'),status);
  assert.match(out,new RegExp('<b>'+label+'</b>'),status);
  assert.match(out,/<footer class="decision-foot">.*decision-v6/s,'chip is inside the plan footer');
  assert.match(out,/OBS<2026-10-25T05:13:00.858Z>/,'observed_at shown when valid');
  glyphs[status]=out.match(/<i aria-hidden="true">([^<]+)<\/i>/)[1];
  assert.doesNotMatch(out,/V12 (is |source )?(ready|verified|READY)/i);
  assert.match(out,/independent of V12 readiness/);
 }
 assert.equal(new Set(Object.values(glyphs)).size,4,'each status has its own glyph');
 // Missing or unknown status: explicit NOT REPORTED, never a fabricated or silent state.
 for(const v6 of [undefined,null,{},{status:'OK'},{status:'verified'},{status:'__proto__'},{status:'toString'},{status:'NOT_REPORTED'}]){
  const out=render(v6);
  assert.match(out,/data-v6-status="NOT_REPORTED"/,JSON.stringify(v6));
  assert.match(out,/<b>Not reported<\/b>/);
  assert.doesNotMatch(out,/Verified/);
  assert.doesNotMatch(out,/OBS</);
 }
 assert.ok(!Object.values(glyphs).includes('\u2013'),'NOT REPORTED glyph differs from every reported status');
 // observed_at: never invented, never shown for an invalid value or a status the backend did not report.
 assert.doesNotMatch(render({status:'VERIFIED'}),/OBS<|Tanggal belum/);
 assert.doesNotMatch(render({status:'VERIFIED',observed_at:'not-a-date'}),/OBS<|Tanggal belum/);
 assert.doesNotMatch(render({observed_at:'2026-10-25T05:13:00Z'}),/OBS</);
 // No chip when the report carries no source object at all (loading/unavailable report).
 assert.doesNotMatch(render(undefined,false),/decision-v6/);
 // Server strings are never echoed into markup.
 const evil=render({status:'<img src=x onerror=alert(1)>',observed_at:'2026-10-25T05:13:00Z'});
 assert.doesNotMatch(evil,/<img|onerror/);
 assert.match(evil,/NOT_REPORTED/);
});
