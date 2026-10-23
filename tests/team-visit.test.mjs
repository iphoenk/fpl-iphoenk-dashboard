import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('visiting rival preserves saved home and league, including refresh and return',async()=>{
 const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function loadTeam('),source.indexOf('function renderLeagueOptions()'));
 const stored=[],nodes=new Map(),state={bootstrap:{},gw:8,teamRequest:0,entry:{id:10},homeEntryId:10,league:{league:{id:100}}};
 const c=vm.createContext({state,entryId:Number,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},alertMessage:()=>{},clearAlert:()=>{},fetchTeam:async id=>({entry:{id,leagues:{classic:[]}},picks:{}}),api:async()=>({elements:[]}),safeWrite:(key,id)=>stored.push(id),renderStats:()=>{},renderPitch:()=>{},renderInsights:()=>{},renderPlanner:()=>{},renderLeagueOptions:()=>{}});
 vm.runInContext(fn,c);
 await c.loadTeam(20,8,{visit:true});assert.equal(state.entry.id,20);assert.equal(state.visitingTeam,true);assert.deepEqual(stored,[]);assert.equal(state.league.league.id,100);
 await c.loadTeam(20,7);assert.deepEqual(stored,[]);assert.equal(state.visitingTeam,true);
 await c.loadTeam(10,8,{visit:false});assert.equal(state.visitingTeam,false);assert.equal(state.entry.id,10);assert.deepEqual(stored,[10]);assert.equal(state.league.league.id,100);
});
test('team loader rejects a response whose loaded ID differs from the requested ID',async()=>{
 const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function loadTeam('),source.indexOf('function renderLeagueOptions()'));
 const nodes=new Map(),messages=[],state={bootstrap:{},gw:8,teamRequest:0,entry:{id:10},homeEntryId:10};
 const c=vm.createContext({state,entryId:Number,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},alertMessage:m=>messages.push(m),clearAlert:()=>{},fetchTeam:async()=>({entry:{id:99},picks:{}}),api:async()=>({elements:[]}),safeWrite:()=>{},renderStats:()=>{},renderPitch:()=>{},renderInsights:()=>{},renderPlanner:()=>{},renderLeagueOptions:()=>{}});
 vm.runInContext(fn,c);
 await c.loadTeam(10,8,{visit:false});
 assert.match(messages.join(' '),/does not match the entered FPL ID/);
 assert.equal(state.entry.id,10);
});
