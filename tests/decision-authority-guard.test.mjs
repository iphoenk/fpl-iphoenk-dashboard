import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Overview decision previews never invoke legacy transferSuggestions',()=>{
 const source=read('phase-two-ui.js');
 const body=source.split('function renderOverviewDecisionPreviews(){')[1].split('const phaseTwoOverviewBefore=')[0];
 assert.doesNotMatch(body,/transferSuggestions\s*\(/);
 assert.match(body,/ext\.publicDecision/);
 assert.match(body,/report\.scenarios\?\.B/);
 assert.match(body,/report\.scenarios\?\.C/);
 assert.match(body,/report\.planning_gw/);
 assert.match(body,/report\.entry_id/);
});

test('one server decision endpoint owns public scenarios',()=>{
 const server=read('multiuser-decision-server.mjs');
 const adapter=read('api/index.js');
 assert.match(server,/enhanced\|\|publicDecision/);
 assert.match(adapter,/publicDecisionResponse\(request\)/);
 assert.doesNotMatch(adapter,/\bselectPublicXI\s*\(/);
});

test('transfer radar consumes server decision without local ranking',()=>{
 const source=read('dashboard-focus.js');
 const body=source.split('function updateDashboardFocus')[1]||source;
 assert.match(source,/ext\.publicDecision/);
 assert.match(source,/pd\.scenarios\?\.B/);
});
