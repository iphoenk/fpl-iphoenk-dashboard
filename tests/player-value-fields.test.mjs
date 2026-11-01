import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Definition check against the frozen Official bootstrap-static snapshot (captured 2026-10-25, GW8).
// It proves the arithmetic relation on that snapshot only; it cannot detect a later upstream redefinition.
const data=JSON.parse(readFileSync(new URL('./browser/fixtures/bootstrap-static.json',import.meta.url),'utf8'));
const elements=data.elements.filter(p=>p.value_season!==undefined&&p.value_form!==undefined);

test('snapshot exposes value_season and value_form as one-decimal strings (negative values possible) for every player',()=>{
 assert.ok(elements.length>=600,'players with both fields: '+elements.length);
 for(const p of elements){
  assert.equal(typeof p.value_season,'string');assert.equal(typeof p.value_form,'string');
  assert.match(p.value_season,/^-?\d+\.\d$/);assert.match(p.value_form,/^-?\d+\.\d$/);
 }
});

test('value_season equals total_points divided by price in £m (season points per £m)',()=>{
 for(const p of elements){
  const expected=p.total_points/(p.now_cost/10);
  assert.ok(Math.abs(expected-Number(p.value_season))<=0.051,p.web_name+' '+p.value_season+' vs '+expected.toFixed(3));
 }
});

test('value_form equals form divided by price in £m, so it differs from value_season by construction',()=>{
 let differs=0;
 for(const p of elements){
  const expected=Number(p.form)/(p.now_cost/10);
  assert.ok(Math.abs(expected-Number(p.value_form))<=0.051,p.web_name+' '+p.value_form+' vs '+expected.toFixed(3));
  if(p.value_form!==p.value_season)differs++;
 }
 assert.ok(differs>elements.length/2);
});

test('snapshot contains negative values, so display and ranking must not assume non-negative',()=>{
 assert.ok(elements.some(p=>Number(p.value_season)<0||Number(p.value_form)<0));
});
