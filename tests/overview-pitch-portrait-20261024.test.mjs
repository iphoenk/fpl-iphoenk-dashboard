import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const cardLine=readFileSync('ui.js','utf8').split('\n').find(line=>line.startsWith('function playerCard('));
const decision=readFileSync('decision-first.js','utf8');
const stylesheet=readFileSync('decision-first.css','utf8');

function renderCard(pick,bench=false){
  assert.ok(cardLine,'the actual playerCard renderer must remain available');
  const state={
    players:{7:{id:7,web_name:'Example Player',element_type:3,team:1,code:12345}},
    teams:{1:{short_name:'TEST'}},
    live:{7:{stats:{total_points:4}}},
    metric:'points'
  };
  const render=vm.runInNewContext('('+cardLine+')',{
    state,positions:{3:'MID'},palettes:{TEST:'#00845e'},
    xp:()=>5,fmt:value=>String(value),displayPickPoints:(value,selected)=>value*selected.multiplier,
    playerPortraitUrl:()=> 'https://resources.premierleague.com/example.png',
    playerFixture:()=>'<span class="player-fixture upcoming">TOT (H)</span>',
    playerFitnessMarker:()=>'',
    esc:value=>String(value)
  });
  return render({...pick,element:7,multiplier:pick.multiplier??1},bench);
}

test('Current Team photo and captain/vice labels remain readable and distinct',()=>{
  const captain=renderCard({is_captain:true,multiplier:2});
  const vice=renderCard({is_vice_captain:true});
  assert.match(captain,/<span class="player-portrait-frame"><img class="player-portrait"/);
  assert.match(captain,/onload="this.classList.add/);
  assert.doesNotMatch(captain,/onerror="this.parentElement.classList.add/);
  assert.match(captain,/class="cap cap-captain" aria-label="Captain">C<\/span>/);
  assert.match(vice,/class="cap cap-vice" aria-label="Vice-captain">VC<\/span>/);
  assert.doesNotMatch(vice,/class="cap cap-captain"/);
  assert.match(captain,/TOT \(H\)/);
});
test('Bench includes player position and preserves the current fixture',()=>{
  const bench=renderCard({},true);
  assert.match(bench,/class="player bench"/);
  assert.match(bench,/class="bench-position">MID<\/span>/);
  assert.match(bench,/TOT \(H\)/);
});
test('Overview CSS covers pitch/bench portrait and 393/768/desktop layouts',()=>{
  assert.match(stylesheet,/Issue #143: readable/);
  assert.match(stylesheet,/\.cap-vice/);
  assert.match(stylesheet,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(stylesheet,/@media\(max-width:767px\)/);
  assert.match(stylesheet,/@media\(min-width:768px\) and \(max-width:960px\)/);
  assert.match(stylesheet,/@media\(min-width:1100px\)/);
  assert.match(decision,/const formation=starters\.length===11/);
  assert.match(decision,/Formation '\+formation/);
});

test('Issue #145: true cropped headshots rather than only larger cards',()=>{
  const portraitRule=stylesheet.slice(stylesheet.indexOf('/* Issue #145: true head-and-shoulders'));
  assert.ok(portraitRule.length>500,'the latest headshot styles must be present');
  assert.match(portraitRule,/\.player-portrait-frame\{/);
  assert.match(portraitRule,/overflow:hidden!important/);
  assert.match(portraitRule,/object-fit:cover!important/);
  assert.match(portraitRule,/object-position:50% 0%!important/);
  assert.match(portraitRule,/transform:scale\(1\.43\)!important/);
  assert.match(portraitRule,/transform:scale\(1\.32\)!important/);
  assert.match(portraitRule,/\.player:has\(>\.player-portrait-frame > \.player-portrait\.loaded\) > \.shirt\{display:none!important\}/);
  assert.match(portraitRule,/\.player-portrait-frame\.failed\{/);
  assert.match(portraitRule,/@media\(max-width:767px\)/);
  assert.ok(stylesheet.lastIndexOf('/* Issue #145: true') < stylesheet.lastIndexOf('/* Issue #67: one genuinely slim'), 'mobile masthead must remain final block for its existing regression contract');
});

test('bench and XI use photo-or-shirt, not both, regardless of bench-position sibling',()=>{
 const bench=renderCard({},true),xi=renderCard({},false);
 assert.match(bench, /class="player bench"/);
 assert.match(bench, /class="player-portrait-frame"[^]*class="bench-position"[^]*<svg class="shirt"/);
 assert.match(xi, /class="player-portrait-frame"[^]*<svg class="shirt"/);
 const marker=stylesheet.indexOf('/* Issue #145: true head-and-shoulders');
 const rules=stylesheet.slice(marker);
 assert.ok(marker>=0);
 assert.match(rules,/\.player:has\(>\.player-portrait-frame > \.player-portrait\.loaded\) > \.shirt\{display:none!important\}/);
 assert.match(rules,/\.player:not\(:has\(>\.player-portrait-frame > \.player-portrait\.loaded\)\) > \.shirt\{display:block!important\}/);
 assert.doesNotMatch(rules,/\.player-portrait-frame:has\(>\.player-portrait\.loaded\)\+\.shirt/);
 assert.match(rules,/\.player-portrait-frame\.failed\{display:none!important\}/);
});
