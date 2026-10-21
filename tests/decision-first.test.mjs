import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../decision-first.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
const shell=readFileSync(new URL('../desktop-shell.js',import.meta.url),'utf8');
const theme=readFileSync(new URL('../theme.js',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build-vercel.mjs',import.meta.url),'utf8');
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('bundle includes decision-first JS/CSS last without changing original logo',()=>{
 assert.match(build,/desktop-shell\.js','decision-first\.js/);
 assert.match(build,/readFileSync\('decision-first\.css','utf8'\)/);
 assert.match(build,/readFileSync\('assets\/fpl-iphoenk-logo\.png'\)/);
});
test('no shrinking zoom survives in JS or final dashboard CSS',()=>{
 assert.match(shell,/removeProperty\('zoom'\)/);
 assert.doesNotMatch(shell,/lay\.style\.zoom|Math\.max\(\.7/);
 assert.match(css,/zoom:1!important/);
});
test('official starting XI and four-player bench remain visible together',()=>{
 assert.match(js,/getElementById\('pitch'\)/);
 assert.match(js,/getElementById\('bench'\)/);
 assert.match(css,/\.decision-bench \.bench-row\{display:grid!important;grid-template-columns:repeat\(4/);
 assert.doesNotMatch(js,/data-view-bench/);
});
test('classic mini-league selector persists by FPL entry, validates membership and refreshes standings',()=>{
 assert.match(js,/decisionLeagueSelect/);
 assert.match(js,/fpl-iphoenk-league-/);
 assert.match(js,/leagueList\(\)\.some\(l=>Number\(l\.id\)===id\)/);
 assert.match(js,/loadLeague\(id\)/);
 assert.match(js,/active\?\.standings\?\.results/);
 assert.match(js,/Klasemen belum dimuat/);
});
test('next GW displays hold, one transfer and alternatives without invented points',()=>{
 assert.match(js,/A · Hold/);
 assert.match(js,/B · 1 Transfer/);
 assert.match(js,/C · Alternatif/);
 assert.match(js,/projected!==null/);
 assert.match(js,/Perlu simulasi dan validasi prediksi/);
 assert.match(js,/is_captain/);
 assert.match(js,/is_vice_captain/);
});
test('desktop and tablet are in one design family while mobile stacks',()=>{
 assert.match(css,/@media\(min-width:768px\) and \(max-width:1099px\)/);
 assert.match(css,/@media\(min-width:1100px\)/);
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/\.decision-primary\{display:grid/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.mobile-bottom-nav\{display:none!important\}/);
});
test('single theme toggle displays opposite mode and official calm color tokens',()=>{
 assert.match(theme,/themeToggle\.id='themeToggle'/);
 assert.match(theme,/dark\?'Light':'Dark'/);
 assert.match(css,/#f7f9fb/i);
 assert.match(css,/#00845e/i);
 assert.match(css,/var\(--panel\)/);
});
test('About remains a reachable original navigation route',()=>{
 assert.match(read('desktop-shell.js'),/about:'About'/);
 assert.match(read('ui.html'),/view-about/);
});
