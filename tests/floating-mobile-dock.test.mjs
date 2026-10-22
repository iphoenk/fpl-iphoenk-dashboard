import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('floating-dock.css');
const js=read('refined-layout.js');
test('floating bottom dock is a mobile-only upgrade with the existing five navigation actions',()=>{
  assert.match(css,/@media \(max-width:767px\)/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/body\.has-team:not\(\.connecting-team\) \.mobile-bottom-nav/);
  for(const view of ['dashboard','tim','transfers','liga','more'])assert.ok(js.includes("'"+view+"'"),view);
  assert.match(js,/data-mobile-view/);
  assert.doesNotMatch(css,/\.app-side\s*\{/);
});
test('premium dock retains green FPL palette, active capsule and works in both themes',()=>{
  assert.match(css,/#16352d/i);
  assert.match(css,/#075f43/i);
  assert.match(css,/button\.active\s*\{/);
  assert.match(css,/html\[data-theme="dark"\]/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
test('home indicator and More sheet remain reachable above floating dock',()=>{
  assert.match(css,/bottom,0px/);
  assert.match(css,/mobile-more:not\(\.hidden\)/);
  assert.match(css,/padding-bottom:calc\(124px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(css,/min-height:54px/);
});
test('Vercel and Worker both load floating dock after decision-first styles',()=>{
  for(const path of ['scripts/build-vercel.mjs','scripts/build.mjs']){
    const source=read(path);
    const baseline=source.indexOf("readFileSync('decision-first.css','utf8')");
    const dock=source.indexOf("readFileSync('floating-dock.css','utf8')");
    assert.ok(baseline>0&&dock>baseline,path);
  }
});
