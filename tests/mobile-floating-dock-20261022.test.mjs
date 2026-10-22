import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../mobile-floating.css',import.meta.url),'utf8');
const ui=readFileSync(new URL('../refined-layout.js',import.meta.url),'utf8');
const vercel=readFileSync(new URL('../scripts/build-vercel.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
const renderAfterDecision=source=>source.indexOf("readFileSync('mobile-floating.css','utf8')")>source.indexOf("readFileSync('decision-first.css','utf8')");

test('five existing navigational actions remain functional; no second dock is created',()=>{
 for(const [route,label] of [['dashboard','Overview'],['tim','My Team'],['transfers','Transfers'],['liga','League'],['more','More']])
  assert.ok(ui.includes("['"+route+"','"+label+"'"),label);
 assert.match(ui,/data-mobile-view/);
 assert.match(ui,/bottomNav\.className='mobile-bottom-nav'/);
 assert.match(ui,/bottomNav\.innerHTML=/);
 assert.match(ui,/moreSheet\.className='mobile-more hidden'/);
});

test('floating dock CSS is loaded AFTER approved decision-first CSS on both targets',()=>{
 assert.ok(renderAfterDecision(vercel));
 assert.ok(renderAfterDecision(worker));
 assert.match(css,/@media \(max-width:767px\)/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/bottom:var\(--mobile-dock-offset\)!important/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/max-width:540px/);
 assert.match(css,/border-radius:24px!important/);
});

test('phone safe-area, fixed dock and bottom content clearance prevent overlap',()=>{
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/safe-area-inset-left/);
 assert.match(css,/safe-area-inset-right/);
 assert.match(css,/padding-bottom:calc\(132px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
 assert.match(css,/\.mobile-more:not\(\.hidden\)/);
 assert.match(css,/z-index:65!important/);
 assert.match(css,/max-height:calc\(100dvh - 146px/);
});

test('FPL colors and interaction remain legible in both themes',()=>{
 assert.match(css,/background:rgba\(20,33,55,\.97\)!important/);
 assert.match(css,/color:#087b57!important/);
 assert.match(css,/html\[data-theme="dark"\]/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/min-height:58px!important/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});

test('mobile polish does not override masthead, official logo, or desktop / tablet rules',()=>{
 assert.doesNotMatch(css,/\.approved-header\s*\{/);
 assert.doesNotMatch(css,/\.approved-header-inner\s*\{/);
 assert.doesNotMatch(css,/\.approved-brand\s*\{/);
 assert.doesNotMatch(css,/\.approved-brand img\s*\{/);
 assert.doesNotMatch(css,/@media\s*\(min-width/);
 assert.match(css,/\.decision-pitch \.pitch/);
 assert.match(css,/#dashboardHeroStats/);
 assert.match(css,/\.decision-league-kpis/);
});
