import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freeTransfersFromHistory,freeTransferEvidence} from '../free-transfers.mjs';

const history={
 current:[
  {event:1,event_transfers:0},
  {event:2,event_transfers:0},
  {event:3,event_transfers:2},
  {event:4,event_transfers:2},
  {event:5,event_transfers:2},
  {event:6,event_transfers:1},
  {event:7,event_transfers:3},
  {event:8,event_transfers:0}
 ],
 chips:[
  {event:1,name:'bboost'},
  {event:2,name:'wildcard'},
  {event:3,name:'3xc'}
 ]
};

test('reconstructs 2 free transfers for GW9 from official history',()=>{
 assert.equal(freeTransfersFromHistory(history,9),2);
 assert.deepEqual(freeTransferEvidence(history,9),{
  value:2,as_of_gameweek:8,next_gameweek:9,
  source:'Official FPL entry history',
  method:'Deterministic reconstruction from event_transfers and chip ledger',
  max_bank:5,verified:true
 });
});

test('prefers the Official FPL extra_free_transfers field when present',()=>{
 assert.deepEqual(freeTransferEvidence({current:[]},9,{extra_free_transfers:1}),{
  value:2,as_of_gameweek:8,next_gameweek:9,
  source:'Official FPL entry',
  method:'Official extra_free_transfers field plus one standard FT',
  max_bank:5,verified:true
 });
});

test('carries unused transfers and caps at five',()=>{
 assert.equal(freeTransfersFromHistory({current:[{event:1,event_transfers:0}]},2),2);
 assert.equal(freeTransfersFromHistory({current:[
  {event:1,event_transfers:0},{event:2,event_transfers:0},
  {event:3,event_transfers:0},{event:4,event_transfers:0},
  {event:5,event_transfers:0},{event:6,event_transfers:0}
 ]},7),5);
});

test('wildcard and free hit protect the accumulated FT balance',()=>{
 const h={current:[
  {event:1,event_transfers:0},{event:2,event_transfers:4},
  {event:3,event_transfers:0}
 ],chips:[{event:2,name:'wildcard'}]};
 assert.equal(freeTransfersFromHistory(h,4),4);
});

test('fails closed when a published gameweek is missing',()=>{
 assert.equal(freeTransfersFromHistory({current:[{event:1,event_transfers:0},{event:3,event_transfers:0}]},4),null);
 assert.equal(freeTransfersFromHistory({},2),null);
});
