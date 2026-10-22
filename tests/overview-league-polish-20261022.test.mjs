import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('decision-first.js');
const css=read('decision-first.css');
const ref=read('refined-layout.js');
const adv=read('advanced.js');
const news=read('dashboard-focus.js');

test('single current-team pitch, secondary Overview is analytics not a duplicate Starting XI',()=>{
 assert.match(ui,/function pitchCard\(\)/);
 assert.match(ui,/getElementById\('pitch'\)/);
 assert.match(ref,/dashboardPositionCards\(\)/);
 assert.match(ref,/dashboardFixtureRuns\(\)/);
 assert.doesNotMatch(ref,/panel\('Starting XI'/);
});
test('mini league footer contains page text before arrows, without redundant Tim 1–10 bar',()=>{
 assert.doesNotMatch(ui,/decision-league-toolbar/);
 const footer=ui.indexOf('decision-league-foot-right');
 assert.ok(footer>0);
 assert.ok(ui.indexOf('decision-league-status',footer)>footer);
 assert.ok(ui.indexOf('decision-league-arrows',footer)>ui.indexOf('decision-league-status',footer));
 assert.match(ui,/GW bruto/);
 assert.match(ui,/event_transfers_cost/);
 assert.match(css,/decision-league-foot-right/);
});
test('explore pool maintains rank and name while swiping, with localized labels',()=>{
 assert.match(css,/#dashboardPredictions \.table-wrap table :is\(th,td\):nth-child\(2\)/);
 assert.match(css,/position:sticky;left:35px/);
 assert.match(adv,/sortHead\('player','Pemain'\)/);
 assert.match(adv,/Status FPL/);
});
test('advisory reports errors, unavailable and actual 1-GW fallback honestly',()=>{
 assert.match(ui,/publicPlan\.error=error\?\.message/);
 assert.match(ui,/report\?\.status==='unavailable'/);
 assert.match(ui,/actualHorizon=modelReady\?Number\(report.horizon\):1/);
 assert.match(ui,/Tidak ada nilai proyeksi yang dibuat-buat/);
 assert.match(ui,/FT\/hit belum terverifikasi/);
});
test('transfers show skeleton before async data, official fitness and radar model are separated',()=>{
 assert.match(adv,/advancedLoadingSkeleton\(view\);renderAdvanced\(view\)/);
 assert.match(css,/\.advanced-skeleton-row/);
 assert.match(news,/0 flag resmi FPL/);
 assert.match(news,/TRANSFER RADAR · MODEL 3 GW/);
});
