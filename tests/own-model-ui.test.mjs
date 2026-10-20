import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {ownFixture} from './own-model-fixture.mjs';
function setup(){const {doc,bs,now}=ownFixture();let requests=0,expiry,removed=0;const handlers={};const c=vm.createContext({state:{view:'dashboard',bootstrap:bs,next:bs.events[1],players:Object.fromEntries(bs.elements.map(p=>[p.id,p]))},overviewMode:'this',currentSquad:()=>bs.elements,$:()=>null,document:{querySelectorAll:()=>[{remove:()=>removed++}],addEventListener:(name,fn)=>handlers[name]=fn},renderAdvanced:async()=>{},renderPlanning:()=>{},renderDashboardOverview:()=>{},applyOverviewMode:()=>{},playerDetail:()=>{},renderAbout:()=>{},api:async path=>{assert.equal(path,'own-model?ids=1,2,3,4');requests++;return doc;},Date:{now:()=>now,parse:Date.parse},setTimeout:fn=>{expiry=fn;return 1;},clearTimeout:()=>{}});vm.runInContext(readFileSync(new URL('../own-model-ui.js',import.meta.url),'utf8'),c);return {c,doc,bs,requests:()=>requests,removed:()=>removed,expire:()=>expiry?.()};}
test('optional Python model adds no startup or navigation fetch and only loads on explicit action',async()=>{
 const {c,requests}=setup();await c.renderAdvanced('dashboard');c.renderDashboardOverview();c.renderPlanning();assert.equal(requests(),0);
 await c.loadOwnModel();assert.equal(requests(),1);assert.equal(c.currentOwnPrediction(c.state.players[1]).xp,5);
});
test('missing or expired own-model does not become zero and expiry never triggers background fetch',async()=>{
 const {c,requests,expire}=setup();assert.equal(c.currentOwnPrediction(c.state.players[1]),null);await c.loadOwnModel();c.state.players[1].status='d';assert.equal(c.currentOwnPrediction(c.state.players[1]),null);expire();assert.equal(c.currentOwnPrediction(c.state.players[2]),null);assert.equal(requests(),1);
});

test('expiry removes an already open player component comparison',async()=>{const {c,expire,removed}=setup();await c.loadOwnModel();const before=removed();expire();assert.ok(removed()>before);});
