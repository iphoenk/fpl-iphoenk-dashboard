import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {valueMetricOptions,valueMetricNumber} from '../domain.mjs';

test('value scatter includes GK in all players and filters GK independently',()=>{
 const source=readFileSync(new URL('../advanced-planning.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('function valueScatter()'),source.indexOf('function renderMarket()'));
 const players=[1,2,3,4].map(type=>({id:type,element_type:type,minutes:90,web_name:'Player '+type,now_cost:50,total_points:20,points_per_game:4,expected_goal_involvements_per_90:0}));
 players.push({...players[0],id:5,minutes:59});
 let plotted;
 const context=vm.createContext({ext:{},valueMetricOptions,valueMetricNumber,esc:String,ownIds:()=>new Set([1]),allPlayers:()=>players,positions:{1:'GK',2:'DEF',3:'MID',4:'FWD'},scatter:points=>{plotted=points;return '';},projectedAt:()=>4});
 vm.runInContext(fn,context);
 const html=vm.runInContext('valueScatter()',context);
 assert.match(html,/>All players</);assert.match(html,/value="1">GK</);
 assert.deepEqual(Array.from(plotted,p=>p.id),[1,2,3,4]);
 context.ext.valuePos='1';context.ext.valueY='points';
 vm.runInContext('valueScatter()',context);
 assert.deepEqual(Array.from(plotted,p=>p.id),[1]);assert.equal(plotted[0].mine,true);assert.equal(plotted[0].y,20);
 context.ext.valuePos='2';vm.runInContext('valueScatter()',context);
 assert.deepEqual(Array.from(plotted,p=>p.id),[2]);
});

test('value metrics differ by football role and preserve missing values',()=>{
 const gk=valueMetricOptions('1');assert.equal(gk[0].key,'saves90');assert.ok(gk.some(m=>m.key==='cs90'));assert.ok(!gk.some(m=>m.key==='xgi90'));
 const def=valueMetricOptions('2');assert.equal(def[0].key,'cs90');assert.ok(def.some(m=>m.key==='defcon90'));assert.ok(def.find(m=>m.key==='xgc90').lower);
 assert.equal(valueMetricOptions('3')[0].key,'xa90');assert.equal(valueMetricOptions('4')[0].key,'xg90');
 assert.equal(valueMetricNumber({goals_scored:3,minutes:180},valueMetricOptions(4).find(m=>m.key==='goals90')),1.5);
 assert.equal(valueMetricNumber({},gk[0]),null);assert.equal(valueMetricNumber({saves_per_90:'0'},gk[0]),0);
 assert.equal(valueMetricNumber({},gk.find(m=>m.key==='xp'),null),null);
});
