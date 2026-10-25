import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../team-portrait.css',import.meta.url),'utf8');
test('My Team portraits use the shoulders-up crop: cover, top-aligned, scaled from the head',()=>{
 assert.match(css,/#view-tim \.pitch-row \.player-portrait-frame>\.player-portrait/);
 assert.match(css,/object-fit:cover!important;object-position:50% 0%!important/);
 assert.match(css,/transform:scale\(1\.43\)!important;transform-origin:50% 4%!important/);
 assert.match(css,/#view-tim \.bench-row \.player-portrait-frame>\.player-portrait\{transform:scale\(1\.35\)/);
 assert.match(css,/overflow:hidden!important/);
});
test('both builds ship team-portrait.css after the other layers',()=>{
 for(const f of ['scripts/build-vercel.mjs','scripts/build.mjs']){
  const src=readFileSync(new URL('../'+f,import.meta.url),'utf8');
  assert.match(src,/readFileSync\('availability\.css','utf8'\)\+'\\n'\+readFileSync\('team-portrait\.css','utf8'\)/);
 }
});
