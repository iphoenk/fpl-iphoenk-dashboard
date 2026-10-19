import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displayPickPoints} from '../domain.mjs';
test('pitch points follow official captain and triple captain multipliers',()=>{
 assert.equal(displayPickPoints(13,{multiplier:2,is_captain:true}),26);
 assert.equal(displayPickPoints(13,{multiplier:3,is_captain:true}),39);
 assert.equal(displayPickPoints(5,{multiplier:2,is_vice_captain:true}),10);
 assert.equal(displayPickPoints(5,{multiplier:1}),5);
 assert.equal(displayPickPoints(5,{multiplier:0,position:12}),5);
 assert.equal(displayPickPoints(0,{multiplier:3}),0);
 assert.equal(displayPickPoints(null,{multiplier:2}),null);
});
