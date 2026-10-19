import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keeperScoutRows} from '../domain.mjs';
test('GK scout rows use official keeper stats and club match counts',()=>{
 const players=[{id:1,element_type:1,web_name:'Keeper',team:7,now_cost:45,starts:2,minutes:180,saves_per_90:'3.5',clean_sheets:1,points_per_game:'5.5',bps:40},{id:2,element_type:2}];
 const r=keeperScoutRows(players,[{event:1,started:true,team_h:7,team_a:2},{event:2,started:true,team_h:2,team_a:7},{event:3,started:false,team_h:7,team_a:2}],{7:{short_name:'ABC'}});
 assert.equal(r.length,1);assert.equal(r[0].startRate,1);assert.equal(r[0].price,4.5);assert.equal(r[0].saves90,3.5);assert.equal(r[0].minutesPerStart,90);assert.equal(r[0].bps90,20);
 assert.equal(keeperScoutRows([players[0]],[],{})[0].startRate,null);
});
