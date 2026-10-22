import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('refined-layout.js');
const css=read('mobile-more-dialog.css');
const fixtureStart=js.indexOf('let leagueFirstOpenPending=null;');
const fixtureEnd=js.indexOf('const connectedShowView=showView;',fixtureStart);
assert.ok(fixtureStart>0&&fixtureEnd>fixtureStart,'production league initializer exists');
const leagueCode=js.slice(fixtureStart,fixtureEnd);
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function leagueFixture({saved=null,view='liga',already=null,leagues=[9477,1122]}={}){
 const select={value:'',options:leagues.map(id=>({value:String(id)}))},calls=[],keys=[];
 const state={entry:{id:3462711,leagues:{classic:leagues.map(id=>({id}))}},view,league:already?{league:{id:already}}:null,visitingTeam:false};
 const context=vm.createContext({state,$:id=>id==='leagueSelect'?select:null,
  safeRead:(key)=>{keys.push(key);return saved;},
  renderLeagueOptions:()=>{},closeConnection:()=>{},renderDashboardOverview:()=>{},
  loadLeague:async(id,page)=>{calls.push([id,page]);},
  alertMessage:()=>{},Promise,Number
 });
 vm.runInContext(leagueCode+'\nglobalThis.ensure=ensureLeagueOnEntry;globalThis.preferred=preferredTeamLeague;',context);
 return {context,select,calls,keys,state};
}
test('on first entry connection, League loads default classic standings automatically',async()=>{
 const f=leagueFixture();
 vm.runInContext('renderLeagueOptions()',f.context);
 await flush();
 assert.equal(f.select.value,'9477');
 assert.deepEqual(f.calls,[[9477,1]]);
 assert.equal(f.keys[0],'fpl-iphoenk-league-3462711');
});
test('previously selected league is preferred and no selection switch needed',async()=>{
 const f=leagueFixture({saved:1122});
 vm.runInContext('renderLeagueOptions()',f.context);
 await flush();
 assert.equal(f.select.value,'1122');
 assert.deepEqual(f.calls,[[1122,1]]);
});
test('loading starts on first League view, not on Overview, and avoids duplicate requests',async()=>{
 const f=leagueFixture({view:'dashboard'});
 vm.runInContext('renderLeagueOptions()',f.context);await flush();
 assert.equal(f.calls.length,0);
 f.state.view='liga';
 f.context.ensure();f.context.ensure();await flush();
 assert.deepEqual(f.calls,[[9477,1]]);
});
test('already loaded chosen standings are reused rather than re-requested',async()=>{
 const f=leagueFixture({already:9477});
 vm.runInContext('renderLeagueOptions()',f.context);await flush();
 assert.equal(f.select.value,'9477');assert.equal(f.calls.length,0);
});
test('no membership does not issue unsupported league API calls',async()=>{
 const f=leagueFixture({leagues:[]});
 vm.runInContext('renderLeagueOptions()',f.context);await flush();
 assert.equal(f.calls.length,0);
});
function mockNode(initial=['hidden']){
 const classes=new Set(initial),attributes={};
 return {classes,attributes,classList:{
  toggle:(key,force)=>{if(force===undefined){if(classes.has(key))classes.delete(key);else classes.add(key);}else if(force)classes.add(key);else classes.delete(key);},
  contains:key=>classes.has(key)
 },setAttribute:(k,v)=>{attributes[k]=v;},focus(){this.focused=true},contains:()=>false};
}
test('More sheet opens as accessible dialog, activates scrim and returns to closed state',()=>{
 const moreSheet=mockNode(),moreBackdrop=mockNode(),trigger=mockNode([]);
 const bottomNav={querySelector:key=>key.includes('more')?trigger:null},body=mockNode([]);
 const closeButton=mockNode([]);
 const ctx=vm.createContext({state:{entry:{id:3462711}},moreSheet,moreBackdrop,bottomNav,
  document:{body,activeElement:null},$:()=>closeButton});
 const begin=js.indexOf('function setMoreOpen(open){'),end=js.indexOf("$('closeMore').onclick",begin);
 assert.ok(begin>0&&end>begin);
 vm.runInContext(js.slice(begin,end)+'\nglobalThis.openMore=setMoreOpen',ctx);
 ctx.openMore(true);
 assert.equal(moreSheet.classList.contains('hidden'),false);
 assert.equal(moreBackdrop.classList.contains('hidden'),false);
 assert.equal(moreSheet.attributes['aria-hidden'],'false');
 assert.equal(trigger.attributes['aria-expanded'],'true');
 assert.equal(body.classList.contains('more-sheet-open'),true);
 assert.equal(closeButton.focused,true);
 ctx.openMore(false);
 assert.equal(moreSheet.classList.contains('hidden'),true);
 assert.equal(moreBackdrop.classList.contains('hidden'),true);
 assert.equal(trigger.attributes['aria-expanded'],'false');
});
test('mobile drawer has FPL colors, capped height and never hides bottom navigation',()=>{
 assert.match(css,/\.mobile-more-backdrop:not\(\.hidden\)/);
 assert.match(css,/max-height:min\(63dvh,/);
 assert.match(css,/bottom:calc\(95px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/z-index:85!important/);
 assert.match(css,/button\[data-mobile-view="more"\]/);
 assert.match(css,/html\[data-theme="dark"\]/);
 assert.doesNotMatch(css,/\.approved-header\s*\{/);
});
test('both build targets load More CSS after current mobile rules',()=>{
 for(const path of ['scripts/build.mjs','scripts/build-vercel.mjs']){
  const code=read(path);
  assert.ok(code.indexOf("readFileSync('mobile-more-dialog.css','utf8')")>code.indexOf("readFileSync('mobile-scout-recovery.css','utf8')"));
 }
});
