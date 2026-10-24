import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultGameweek,entryId} from '../domain.mjs';
test('default team gameweek prefers the active GW and falls back only when absent',()=>{
 assert.equal(defaultGameweek([{id:8,finished:true,is_current:false},{id:9,finished:false,is_current:true}]),9);
});
test('visiting rival preserves saved home and league, including refresh and return',async()=>{
 const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function loadTeam('),source.indexOf('function renderLeagueOptions()'));
 const stored=[],nodes=new Map(),state={bootstrap:{},gw:8,teamRequest:0,entry:{id:10},homeEntryId:10,league:{league:{id:100}}};
 const c=vm.createContext({state,entryId:value=>String(value),$:(id)=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},alertMessage:()=>{},clearAlert:()=>{},fetchTeam:async id=>({entry:{id,leagues:{classic:[]}},picks:{}}),api:async()=>({elements:[]}),safeWrite:(key,id)=>stored.push(id),renderStats:()=>{},renderPitch:()=>{},renderInsights:()=>{},renderPlanner:()=>{},renderLeagueOptions:()=>{}});
 vm.runInContext(fn,c);
 await c.loadTeam(20,8,{visit:true});assert.equal(state.entry.id,20);assert.equal(state.visitingTeam,true);assert.deepEqual(stored,[]);assert.equal(state.league.league.id,100);
 await c.loadTeam(20,7);assert.deepEqual(stored,[]);assert.equal(state.visitingTeam,true);
 await c.loadTeam(10,8,{visit:false});assert.equal(state.visitingTeam,false);assert.equal(state.entry.id,10);assert.deepEqual(stored,[10]);assert.equal(state.league.league.id,100);
});
test('team loader rejects a response whose loaded ID differs from the requested ID',async()=>{
 const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function loadTeam('),source.indexOf('function renderLeagueOptions()'));
 const nodes=new Map(),messages=[],state={bootstrap:{},gw:8,teamRequest:0,entry:{id:10},homeEntryId:10};
 const c=vm.createContext({state,entryId:value=>String(value),$:(id)=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},alertMessage:m=>messages.push(m),clearAlert:()=>{},fetchTeam:async()=>({entry:{id:99},picks:{}}),api:async()=>({elements:[]}),safeWrite:()=>{},renderStats:()=>{},renderPitch:()=>{},renderInsights:()=>{},renderPlanner:()=>{},renderLeagueOptions:()=>{}});
 vm.runInContext(fn,c);
 await c.loadTeam(10,8,{visit:false});
 assert.match(messages.join(' '),/does not match the entered FPL ID/);
 assert.equal(state.entry.id,10);
});
test('team loader accepts a matching ID even when entryId() yields a string and the API returns a numeric id (regression for 80a07c1 type-coercion bug)',async()=>{
 const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function loadTeam('),source.indexOf('function renderLeagueOptions()'));
 const nodes=new Map(),messages=[],state={bootstrap:{},gw:8,teamRequest:0,entry:null,homeEntryId:null};
 // entryId() is the REAL domain.mjs implementation here, not a Number-casting mock: it always
 // returns a string. fetchTeam below mimics the real Official FPL API, whose entry.id is a number.
 const c=vm.createContext({state,entryId,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},alertMessage:m=>messages.push(m),clearAlert:()=>{},fetchTeam:async id=>({entry:{id:Number(id),leagues:{classic:[]}},picks:{}}),api:async()=>({elements:[]}),safeWrite:()=>{},renderStats:()=>{},renderPitch:()=>{},renderInsights:()=>{},renderPlanner:()=>{},renderLeagueOptions:()=>{}});
 vm.runInContext(fn,c);
 await c.loadTeam('3462711',8,{visit:false});
 assert.deepEqual(messages,[]);
 assert.equal(state.entry.id,3462711);
});
test('fetchTeam() itself accepts a matching numeric API id against a string requested id (regression for 80a07c1 type-coercion bug)',async()=>{
 const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function fetchTeam('),source.indexOf('async function loadTeam('));
 const calls=[];
 const c=vm.createContext({api:async path=>{calls.push(path);return path.startsWith('entry/')&&path.includes('/event/')?{picks:[]}:{id:3462711};}});
 vm.runInContext(fn,c);
 const result=await c.fetchTeam('3462711',8);
 assert.equal(result.entry.id,3462711);
 assert.equal(calls.some(p=>p.includes('identity_retry')),false);
});
