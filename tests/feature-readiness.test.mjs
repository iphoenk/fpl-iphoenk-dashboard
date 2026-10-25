import {test} from 'node:test';
import assert from 'node:assert/strict';
import {featureReadiness,READINESS} from '../feature-readiness.mjs';
const ok=(extra={})=>({http_status:200,valid:true,source_as_of:'2026-10-25T10:00:00Z',checked_at:'2026-10-25T10:05:00Z',...extra});

test('test_http200_optimizer_invalid_not_ready',()=>{
  const r=featureReadiness({optimizer:{http_status:200,valid:false}});
  assert.equal(r.optimizer.status,READINESS.UNAVAILABLE);
  assert.match(r.optimizer.reason,/validation/);
});
test('non-2xx is unavailable even when marked valid',()=>{
  assert.equal(featureReadiness({league:{http_status:503,valid:true}}).league.status,READINESS.UNAVAILABLE);
});
test('publication time unknown stays null, never invented or undefined',()=>{
  const r=featureReadiness({news:{http_status:200,valid:true,checked_at:'2026-10-25T10:05:00Z'}});
  assert.equal(r.news.status,READINESS.READY);
  assert.equal(r.news.source_as_of,null);
  assert.equal(r.news.checked_at,'2026-10-25T10:05:00Z');
  assert.equal(featureReadiness({news:ok({source_as_of:'not a date'})}).news.source_as_of,null);
});
test('model null is explicit null fields, not undefined',()=>{
  const m=featureReadiness({projection:null}).model;
  assert.equal(m.status,READINESS.UNAVAILABLE);
  for(const k of ['source_as_of','checked_at'])assert.equal(m[k],null);
  assert.deepEqual(m.coverage,{loaded:null,total:null});
  assert.ok(Object.values(m).every(v=>v!==undefined));
});
test('finished but not data_checked is evaluation pending',()=>{
  const r=featureReadiness({live:ok({finished:true,data_checked:false})});
  assert.equal(r.live.status,READINESS.PENDING);
  assert.match(r.live.reason,/pending/);
  assert.equal(featureReadiness({live:ok({finished:true,data_checked:true})}).live.status,READINESS.READY);
});
test('missing cohort is reported, not rounded into ready',()=>{
  const r=featureReadiness({league:ok({coverage:{loaded:20,total:58}})}).league;
  assert.equal(r.status,READINESS.PARTIAL);
  assert.match(r.reason,/20 of 58; 38 missing/);
  assert.deepEqual(r.coverage,{loaded:20,total:58});
});
test('unknown coverage counts stay null, not 0',()=>{
  const r=featureReadiness({league:ok({coverage:{loaded:'x'}})}).league;
  assert.deepEqual(r.coverage,{loaded:null,total:null});
  assert.equal(r.status,READINESS.READY);
});
test('MC shadow ready never changes the A/B/C features',()=>{
  const base={facts:ok(),live:ok(),projection:ok(),optimizer:ok(),league:ok({coverage:{loaded:58,total:58}}),news:ok()};
  const without=featureReadiness(base),withMc=featureReadiness({...base,mc:ok()});
  for(const f of ['facts','live','model','optimizer','league','news'])assert.deepEqual(withMc[f],without[f]);
  assert.equal(withMc.mc.status,READINESS.SHADOW);
  assert.equal(without.mc.status,READINESS.UNAVAILABLE);
  // A broken optimizer stays unavailable whatever MC says.
  assert.equal(featureReadiness({...base,optimizer:{http_status:200,valid:false},mc:ok()}).optimizer.status,READINESS.UNAVAILABLE);
});
test('empty call returns every feature as unavailable',()=>{
  const r=featureReadiness();
  assert.deepEqual(Object.keys(r),['facts','live','model','optimizer','league','news','mc']);
  assert.ok(Object.values(r).every(v=>v.status===READINESS.UNAVAILABLE));
});
