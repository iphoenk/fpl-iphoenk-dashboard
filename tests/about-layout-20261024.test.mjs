import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const about=readFileSync(new URL('../about-ui.js',import.meta.url),'utf8');
const style=readFileSync(new URL('../about.css',import.meta.url),'utf8');
const files=['scripts/build-vercel.mjs','scripts/build.mjs'];

function render(){
 const page={innerHTML:''},head={append(){}};
 const ctx=vm.createContext({
  document:{createElement:tag=>({tag}),head},
  state:{bootstrap:{events:[{deadline_time:'2026-08-21T12:00:00Z'}]}},
  $:id=>{assert.equal(id,'view-about');return page;},
  esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
 });
 vm.runInContext(about+'\nrenderAbout();',ctx);
 return page.innerHTML;
}

test('About renders compact editorial content with consistent headings and native accessible sections',()=>{
 const html=render();
 assert.match(html,/<div class="about-page">/);
 assert.match(html,/<header class="about-hero">/);
 assert.match(html,/<h2>Your team\. Your edge\.<\/h2>/);
 assert.match(html,/What you can explore/);
 assert.match(html,/Know the limits/);
 assert.match(html,/How the numbers work/);
 assert.match(html,/Sources & credits/);
 assert.match(html,/Privacy & independence/);
 assert.equal((html.match(/class="about-card(?:\s|")/g)||[]).length,6);
 assert.doesNotMatch(html,/<table|class="panel-head"|class="table-wrap"/);
 assert.doesNotMatch(about, /aboutStyle\.textContent|line-height:1\.75/);
});
test('About correctly attributes seven providers with safe links and English copy',()=>{
 const html=render();
 const names=['Official Fantasy Premier League','FPLens','FPL Insights','FPL Core Insights','The Guardian','FPL Jakarta','FPL iphoenk V6/V12 Engine'];
 for(const name of names)assert.ok(html.includes(name),'missing source '+name);
 assert.equal((html.match(/class="about-source"/g)||[]).length,7);
 assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,7);
 assert.equal((html.match(/target="_blank"/g)||[]).length,7);
 assert.match(html,/Official FPL/);
 assert.match(html,/private canonical V12/);
 assert.match(html,/does not run or publish private canonical V12/);
 assert.match(html,/Public team IDs do not prove account ownership/);
 assert.match(html,/Predictions are estimates, never guaranteed points/);
});
test('About technical notes stay available but collapse by default to save scrolling',()=>{
 const html=render();
 assert.match(html,/<details class="about-details"><summary>Technical methodology & uncertainty<\/summary>/);
 assert.doesNotMatch(html, /<details[^>]* open/);
 assert.match(html,/bounded deterministic search/);
 assert.match(html,/not recorded match xG/);
 assert.match(html,/without login|no account login/i);
 assert.match(html, /data-goto="accuracy"/);
 const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 assert.match(ui,/if\(button\.dataset\.goto\)showView\(button\.dataset\.goto\)/);
});
test('About typography, card spacing, source grid and responsive widths use one theme-aware style',()=>{
 assert.match(style,/#view-about \.about-page\{/);
 assert.match(style, /--about-space:12px/);
 assert.match(style, /gap:var\(--about-space\)/);
 assert.match(style, /#view-about \.about-card\{/);
 assert.match(style, /border:1px solid var\(--line\)/);
 assert.match(style, /background:var\(--panel\)/);
 assert.match(style, /color:var\(--text\)/);
 assert.match(style, /#view-about \.about-card h3\{[^}]*font-size:16px/s);
 assert.match(style, /#view-about \.about-intro-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
 assert.match(style, /#view-about \.about-source-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
 assert.match(style, /@media\(max-width:900px\)/);
 assert.match(style, /@media\(max-width:680px\)/);
 assert.match(style, /#view-about \.about-intro-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(style, /#view-about \.about-source-grid\{grid-template-columns:minmax\(0,1fr\)/);
 assert.doesNotMatch(style, /min-width:180px|font-size:9px|font-size:10px!important/);
});
test('About stylesheet loads in Vercel and Worker bundles',()=>{
 for(const file of files){
  const src=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(src,/'about-ui\.js'/);
  assert.match(src,/readFileSync\('about\.css','utf8'\)/);
 }
});

test('About includes verified FPL season, build revision and one unified Python engine card',()=>{
 const html=render();
 assert.match(html,/FPL season <strong>2026\/27<\/strong>/);
 assert.match(html,/Dashboard build <strong>__FPL_DASHBOARD_BUILD__<\/strong>/);
 assert.match(html,/class="about-card about-python"/);
 assert.equal((html.match(/Independent Python Engine/g)||[]).length,1);
 assert.match(html,/Python · experimental v0\.1\.1/);
 assert.match(html,/calculated offline from checked Official FPL data/);
 assert.match(html,/has not demonstrated superior predictive accuracy/);
 const pos=html.indexOf('class="about-card about-python"'),end=html.indexOf('class="about-card about-bottom"');
 assert.ok(pos>0&&end>pos,'Python card belongs in the same page and spacing as privacy');
 assert.ok(pos<html.lastIndexOf('</div>'),'Python is rendered within the editorial wrapper');
 const python=readFileSync(new URL('../own-model-ui.js',import.meta.url),'utf8');
 assert.doesNotMatch(python,/renderAbout=function|ownAboutBefore|panel\('Independent Python Engine'/);
 assert.match(style,/#view-about \.about-python\{display:grid;gap:8px\}/);
 assert.match(style,/#view-about \.about-release\{/);
});
test('both build pipelines replace the dashboard revision with a non-secret commit SHA',()=>{
 for(const file of files){
  const src=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(src,/\.replaceAll\('__FPL_DASHBOARD_BUILD__',\(process\.env\.VERCEL_GIT_COMMIT_SHA\|\|process\.env\.GITHUB_SHA\|\|'unpublished'\)\.slice\(0,8\)\)/);
 }
});
