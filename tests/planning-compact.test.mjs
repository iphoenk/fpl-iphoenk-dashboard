import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../planning-compact.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../planning-compact.css',import.meta.url),'utf8');
function harness(report){
  const view={classList:{add(){}},innerHTML:''},listeners={};
  const context={
    document:{getElementById:()=>view,addEventListener:(name,fn)=>listeners[name]=fn},
    state:{view:'planning',entry:{id:3462711},next:{id:8},players:{
      1:{id:1,web_name:'Old',team:5,now_cost:67,form:'5.0',status:'a'},
      2:{id:2,web_name:'New',team:6,now_cost:70,form:'6.0',status:'a'}},teams:{5:{short_name:'AAA'},6:{short_name:'BBB'}}},
    ext:{publicDecision:{entryId:3462711,gw:8,report}},
    esc:s=>String(s).replaceAll('<','&lt;'),fmt:(n,d=0)=>Number(n).toFixed(d),
    money:n=>'£'+Number(n/10).toFixed(1)+'m',
    fixtureHeatmap:()=>'<div>Official fixtures</div>',
    transferSuggestions:()=>{throw Error('Legacy engine must not run');},
    projectedAt:()=>{throw Error('Local projections must not run');},
    renderPlanning:()=>{throw Error('Legacy render must not run');}
  };
  vm.runInNewContext(code,context);
  return {context,view,listeners};
}
const report={status:'ready',contract:'PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1',canonical_v12:false,monte_carlo:false,horizon:1,scenarios:{
  A:{expected_points:43,changes:[]},
  B:{expected_points:47,gross_gain_vs_hold:4,changes:[{out:{id:1,web_name:'Old'},in:{id:2,web_name:'New'}}]},
  C:null
}};
test('Planning uses the same canonical public A/B/C response and opens a real one-transfer simulation',()=>{
  const h=harness(report);h.context.renderPlanning();
  assert.match(h.view.innerHTML,/Hold · A/);
  assert.match(h.view.innerHTML,/43\.0 xP/);
  assert.match(h.view.innerHTML,/47\.0 xP/);
  assert.match(h.view.innerHTML,/data-plan-transfer="1:2"/);
  assert.match(h.view.innerHTML,/Confidence/);
  assert.match(h.view.innerHTML,/Not scored/);
  assert.match(h.view.innerHTML,/<details class="planning-player-details">/);
  assert.doesNotMatch(h.view.innerHTML,/transferSuggestions|market exploration|FPLens/);
});
test('No fake recommendations when decision context is stale or unavailable',()=>{
  const h=harness(report);h.context.ext.publicDecision.gw=7;h.context.renderPlanning();
  assert.doesNotMatch(h.view.innerHTML,/data-plan-transfer/);
  assert.match(h.view.innerHTML,/Preparing the same A\/B\/C decision/);
  h.context.ext.publicDecision.gw=8;
  h.context.ext.publicDecision.report={status:'unavailable'};
  h.listeners['fpl:decision-updated']();
  assert.match(h.view.innerHTML,/currently unavailable/);
  assert.doesNotMatch(h.view.innerHTML,/data-plan-transfer/);
});
test('Planning stylesheet has responsive tablet/desktop layout and is page-scoped',()=>{
  assert.match(css,/#view-planning\.planning-compact-view/);
  assert.match(css,/@media\(min-width:768px\)/);
  assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/repeat\(4,minmax\(0,1fr\)\)/);
});
test('Both production builds include the view and stylesheet after the decision source',()=>{
  for(const path of ['build.mjs','build-vercel.mjs']){
    const build=readFileSync(new URL('../scripts/'+path,import.meta.url),'utf8');
    assert.ok(build.indexOf("'planning-compact.js'")>build.indexOf("'decision-first.js'"));
    assert.ok(build.indexOf("'planning-compact.css'")<build.indexOf("'layout-rhythm.css'"));
  }
});