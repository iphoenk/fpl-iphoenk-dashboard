import {test} from 'node:test';import assert from 'node:assert/strict';import {entryId,projection,comparePicks,validateTransfer,bestXI} from '../domain.mjs';import {sourceFor,handle} from '../server.mjs';
test('best XI respects formation and max three per club when one club dominates',()=>{
 const players=[];let id=1;for(const type of [1,2,3,4])for(let i=0;i<12;i++)players.push({id:id++,element_type:type,team:i<5?1:i-2,score:20-i});
 const result=bestXI(players,p=>p.score);assert.equal(result.players.length,11);assert.equal(result.players.filter(p=>p.element_type===1).length,1);const counts=result.players.reduce((acc,p)=>(acc[p.team]=(acc[p.team]||0)+1,acc),{});assert.ok(Object.values(counts).every(n=>n<=3));assert.equal(new Set(result.players.map(p=>p.id)).size,11);
});
test('best XI result is one of all eight legal FPL formations',()=>{
 const players=[];let id=1;
 for(const pos of [1,2,3,4])for(let i=0;i<(pos===1?2:pos===2?5:pos===3?5:3);i++)players.push({id:id++,element_type:pos,team:i+1,score:100-id});
 const result=bestXI(players,p=>p.score);
 assert.ok(result);
 assert.deepEqual(['3-4-3','3-5-2','4-3-3','4-4-2','4-5-1','5-2-3','5-3-2','5-4-1'].includes(result.formation),true);
});
test('entry IDs accept public team URLs and reject scripts and zero',()=>{assert.equal(entryId('https://fantasy.premierleague.com/entry/3385667/event/7/'),'3385667');assert.equal(entryId(' 123 '),'123');for(const v of ['0','-1','abc','<script>','1/../2'])assert.equal(entryId(v),null);});
test('upstream allowlist cannot become an open proxy',()=>{assert.equal(sourceFor('/api/https://example.com'),null);assert.equal(sourceFor('/api/entry/1/../2/'),null);assert.equal(sourceFor('/api/entry/22/event/7/picks/'),'https://fantasy.premierleague.com/api/entry/22/event/7/picks/');});
test('model data must match deadline, player name, and club',()=>{const e={id:8,deadline_time:'2026-10-23T17:30:00Z'},m={gameweek:8,deadline:e.deadline_time},p={id:1,web_name:'Player'},data={1:{web_name:'Player',team_name:'ARS',predicted_points:5}};assert.equal(projection(p,data,m,e,{short_name:'ARS'}),5);assert.equal(projection(p,data,m,{...e,deadline_time:'2025-10-23T17:30:00Z'},{short_name:'ARS'}),null);assert.equal(projection(p,data,m,e,{short_name:'MCI'}),null);});
test('comparison separates common players and differentials',()=>assert.deepEqual(comparePicks([{element:1},{element:2}],[{element:2},{element:3}]),{shared:[2],onlyA:[1],onlyB:[3]}));
test('transfer validates position and club rules',()=>{const players={1:{element_type:2,team:1},2:{element_type:2,team:2},3:{element_type:2,team:2},4:{element_type:2,team:2},5:{element_type:2,team:2},6:{element_type:3,team:3}};const picks=[1,2,3,4].map(element=>({element}));assert.match(validateTransfer(picks,1,5,players,10),/3 pemain/);assert.match(validateTransfer(picks,1,6,players,10),/Posisi/);});
test('invalid methods and paths fail without upstream requests',async()=>{assert.equal((await handle(new Request('https://local/api/no'),{},{},'')).status,404);assert.equal((await handle(new Request('https://local/api/bootstrap-static/',{method:'POST'}),{},{},'')).status,405);assert.equal((await handle(new Request('https://local/api/leagues-classic/1/standings/?page_standings=bad'),{},{},'')).status,400);});

test('dashboard HTML is not cached so clients do not retain an obsolete entry loader',async()=>{
 const r=await handle(new Request('https://local/'),{},{},'<html></html>');
 assert.equal(r.status,200);
 assert.equal(r.headers.get('Cache-Control'),'no-store, no-cache, must-revalidate, max-age=0');
 assert.equal(r.headers.get('Pragma'),'no-cache');
});
