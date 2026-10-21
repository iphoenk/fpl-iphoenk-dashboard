import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../desktop-shell.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../desktop-shell.css',import.meta.url),'utf8');
test('both build scripts ship the desktop shell files',()=>{
 for(const f of ['scripts/build.mjs','scripts/build-vercel.mjs']){
  const s=readFileSync(new URL('../'+f,import.meta.url),'utf8');
  assert.match(s,/desktop-shell\.js/);
  assert.match(s,/desktop-shell\.css/);
 }
});
test('desktop shell is guarded against double init and escapes the logo src',()=>{
 assert.match(js,/if\(document\.querySelector\('\.app-side'\)\)return/);
 assert.match(js,/esc\(shellLogo\)/);
});
test('desktop shell styles apply only on desktop widths and for connected teams',()=>{
 const base=css.split('@media(min-width:1100px)')[0];
 assert.match(base,/\.app-side,\.shell-title\{display:none\}/);
 const stray=base.split('\n').filter(l=>/has-team|side-collapsed/.test(l)&&!/^@media/.test(l));
 assert.deepEqual(stray,[]);
 assert.match(css,/prefers-reduced-motion/);
});
test('rail toggle is the FPL iphoenk logo, text-free, with an accessible name',()=>{
 const toggle=js.match(/<button type="button" class="app-side-logo"[^>]*>/)[0];
 assert.match(toggle,/aria-label="Ciutkan menu"/);
 assert.doesNotMatch(js,/Ciutkan menu<\/span>/);
});
test('overview fits the viewport by uniform zoom with a readable floor, only on desktop dashboard',()=>{
 assert.match(js,/function shellFit\(\)/);
 assert.match(js,/innerWidth>=1100/);
 assert.match(js,/Math\.max\(\.7,Math\.min\(1,/);
 assert.match(js,/data-view|dataset\.view==='dashboard'/);
 assert.doesNotMatch(css,/100vh - var\(--fold-top/);
});
