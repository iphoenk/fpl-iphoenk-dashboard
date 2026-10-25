import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const about=readFileSync(new URL('../about-ui.js',import.meta.url),'utf8');
const style=readFileSync(new URL('../about.css',import.meta.url),'utf8');
const files=['scripts/build-vercel.mjs','scripts/build.mjs'];
const credits=JSON.parse(readFileSync(new URL('../credits.json',import.meta.url),'utf8'));

function render(){
 const page={innerHTML:''},head={append(){}};
 const ctx=vm.createContext({
  document:{createElement:tag=>({tag}),head},
  FPL_CREDITS:credits,
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
test('About attributes providers and every registry credit with safe links and English copy',()=>{
 const html=render();
 const providers=['Official Fantasy Premier League','FPLens','FPL Core Insights','The Guardian','FPL Jakarta','FPL iphoenk V6/V12/MC Engine'];
 for(const name of providers)assert.ok(html.includes(name),'missing source '+name);
 for(const entry of credits.entries)assert.ok(html.includes('data-credit="'+entry.id+'"'),'missing credit '+entry.id);
 const total=providers.length+credits.entries.length;
 assert.equal((html.match(/class="about-source(?: about-credit)?"/g)||[]).length,total);
 assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,total);
 assert.equal((html.match(/target="_blank"/g)||[]).length,total);
 assert.match(html,/Official FPL/);
 assert.match(html,/Public team IDs do not prove account ownership/);
 assert.match(html,/Predictions are estimates, never guaranteed points/);
});
test('credits registry is valid, license-honest and safe to embed',()=>{
 assert.equal(credits.schemaVersion,1);
 assert.equal(credits.entries.length,12);
 const ids=new Set();
 for(const e of credits.entries){
  assert.ok(!ids.has(e.id),'duplicate '+e.id);ids.add(e.id);
  assert.match(e.url,/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  assert.ok(['idea_only','code_or_idea'].includes(e.adoptionType));
  assert.ok(['planned','backlog','reviewed-no-adoption'].includes(e.status));
  assert.equal(typeof e.codeCopied,'boolean');
  if(e.codeCopied)assert.equal(e.license,'MIT','code may only be copied from MIT sources: '+e.id);
  if(e.adoptionType==='idea_only')assert.equal(e.codeCopied,false,e.id);
  if(e.status==='reviewed-no-adoption')assert.equal(e.adopted.length,0,e.id);
 }
 const raw=readFileSync(new URL('../credits.json',import.meta.url),'utf8');
 assert.ok(!raw.includes('$'),'no $ in credits: breaks string replacement in builds');
 assert.ok(!/<\/script/i.test(raw));
});
test('About stays honest when no code has been copied: no "Code used" group',()=>{
 const html=render();
 assert.doesNotMatch(html,/Code used \(MIT\)/);
 assert.match(html,/Inspired by/);
 assert.match(html,/Reviewed, nothing adopted/);
 assert.match(html,/No code is copied from these projects/);
 assert.match(html,/MIT license/);
});
test('both builds embed credits.json',()=>{
 for(const file of files){
  const src=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(src,/readFileSync\('credits\.json','utf8'\)/);
 }
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
