import {test} from 'node:test';import assert from 'node:assert/strict';
import {ownFixture,hash} from './own-model-fixture.mjs';
import {validateOwnModel,ownForecast,ownRecord,readOwnRecord} from '../own-model.mjs';
import {evaluateForecast} from '../phase-one.mjs';
test('own model validates current complete identity and component sum without inventing ranges',()=>{
 const {doc,bs,fixtures,now}=ownFixture();let r=validateOwnModel(doc,{bootstrap:bs,fixtures,now});assert.equal(r.ok,true);assert.equal(r.players['1'].xp,5);
 const saved=ownRecord(doc);assert.deepEqual(readOwnRecord(saved),doc);saved.snapshot.players['1'].xp=99;assert.equal(readOwnRecord(saved),null);
 doc.players['1'].xp=NaN;assert.equal(validateOwnModel(doc,{bootstrap:bs,fixtures,now}).ok,false);
});
test('wrong GW season rules fixture and expired data fail closed',()=>{
 for(const mutate of [d=>d.target_gw++,d=>d.season='2025',d=>d.scoring_hash='bad',d=>d.fixture_hash='bad',d=>d.model_id='fplens',d=>d.players['1'].name='Another',d=>d.players['1'].components.goals=null,d=>d.acquisition_finished_at_utc='2026-10-20T01:00:00Z']){
  const {doc,bs,fixtures,now}=ownFixture();mutate(doc);assert.equal(validateOwnModel(doc,{bootstrap:bs,fixtures,now}).ok,false);
 }
 const {doc,bs,fixtures,now}=ownFixture();assert.equal(validateOwnModel(doc,{bootstrap:bs,fixtures,now:now+21600000}).ok,false);
});
test('changed availability suppresses affected row while official facts remain independent',()=>{
 const {doc,bs,fixtures,now}=ownFixture();bs.elements[0].status='d';bs.elements[0].chance_of_playing_next_round=75;
 const r=validateOwnModel(doc,{bootstrap:bs,fixtures,now});assert.equal(r.ok,true);assert.equal(r.players['1'].status,'unavailable');assert.equal(r.players['1'].xp,null);assert.equal(r.players['2'].xp,5);
 const forecast=ownForecast({...doc,players:r.players},bs,now);assert.equal(forecast.source,'fpl-iphoenk-python-v1');assert.equal(forecast.players.length,3);assert.equal(forecast.players[0].position,2);
});
test('a self-consistent total still cannot omit a mandatory scoring component',()=>{
 const {doc,bs,fixtures,now}=ownFixture();delete doc.players['1'].components.cards;
 assert.equal(validateOwnModel(doc,{bootstrap:bs,fixtures,now}).ok,false);
});
test('own forecast evaluation preserves per-position matched coverage',()=>{
 const {doc,bs,now}=ownFixture(),snapshot=ownForecast(doc,bs,now),live={elements:bs.elements.map(p=>({id:p.id,stats:{total_points:3,minutes:90}}))};
 const result=evaluateForecast(snapshot,live,true);assert.equal(result.by_position['1'].count,1);assert.equal(result.by_position['1'].mae,2);
});
