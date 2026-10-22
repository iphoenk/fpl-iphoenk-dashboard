import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const css=read('mobile-scout-recovery.css');
const labJs=read('scout-labs.js');
const advanced=read('advanced.js');

function renderLab(pos='GK') {
 const nodes=new Map();
 const element=id=>{
  if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',onchange:null,oninput:null,onclick:null,onkeydown:null,focus(){},setSelectionRange(){}});
  return nodes.get(id);
 };
 const goalkeeper={id:1,webName:'Keeper',minutes:500,startRate:.9,teamShort:'ABC',teamId:1,price:4.5,saves90:3.5,cleanSheets:2,pointsPerGame:4,xgc90:1.1,minutesPerStart:88,bps90:22,xp:5};
 const ctx=vm.createContext({
  ext:{labPos:pos,labQuery:'',labPage:1,labClub:'',labMax:'',labMinStart:null,compare:[],snapshot:{scouts:{DEF:{rows:[]},MID:{rows:[]},FWD:{rows:[]}}}},
  state:{players:{1:{id:1,element_type:1,web_name:'Keeper'}},fixtures:[],teams:{1:{id:1,short_name:'ABC'}}},
  $:element,allPlayers:()=>[],keeperScoutRows:()=>[goalkeeper],score:()=>5,
  snapshotPlayer:()=>null,ownIds:()=>new Set(),fmt:v=>String(v??'—'),esc:String,
  scatter:()=>'<svg></svg>',sourceNote:()=>'<p>Official FPL</p>',snapshotNotice:()=>'<p>Snapshot</p>',
  panel:(title,body)=>'<section>'+title+body+'</section>'
 });
 vm.runInContext(labJs,ctx);
 ctx.renderLabs();
 return {markup:element('view-labs').innerHTML,ctx};
}

test('real scout renderer includes all four accessible positions with goalkeeper statistics',()=>{
 const {markup}=renderLab('GK');
 for(const pos of ['GK','DEF','MID','FWD'])assert.match(markup,new RegExp('data-lab-pos="'+pos+'"'));
 assert.match(markup,/data-lab-pos="GK" class="active"/);
 assert.match(markup,/GK · Goalkeepers/);
 assert.match(markup,/Save volume/);
 assert.match(markup,/Clean sheets/);
 assert.match(markup,/Keeper/);
});

test('other scout positions remain available without modifying the GK data logic',()=>{
 const {markup}=renderLab('DEF');
 assert.match(markup,/data-lab-pos="DEF" class="active"/);
 assert.match(markup,/data-lab-pos="GK"/);
 assert.match(markup,/Defensive contribution/);
 assert.match(advanced,/if\(b\.dataset\.labPos\)\{ext\.labPos=b\.dataset\.labPos;ext\.labPage=1;renderLabs\(\);\}/);
});

test('mobile selector is a visible two-by-two grid, never horizontally clipped',()=>{
 assert.match(css,/@media \(max-width:767px\)/);
 assert.match(css,/#view-labs \.adv-tabs\s*\{[^}]*display:grid!important/s);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/overflow:visible!important/);
 assert.match(css,/button\[data-lab-pos\]/);
 assert.match(css,/min-height:46px!important/);
});

test('mobile font sizes, cards, and dock use bounded styling without affecting desktop or the original header',()=>{
 assert.match(css,/text-size-adjust:100%/);
 assert.match(css,/#view-labs \.adv-grid\.two\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)!important/s);
 assert.match(css,/#view-labs \.adv-card\s*\{[^}]*padding:14px!important/s);
 assert.match(css,/#view-labs \.adv-row\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/s);
 assert.match(css,/\.decision-deep-content \.focus-grid\s*\{[^}]*gap:14px!important/s);
 assert.match(css,/\.mobile-bottom-nav button\s*\{[^}]*min-height:48px!important/s);
 assert.match(css,/padding-bottom:calc\(145px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
 assert.doesNotMatch(css,/\.approved-header\s*\{/);
 assert.doesNotMatch(css,/@media\s*\(min-width/);
});

test('recovery is the final mobile layer in Vercel and Worker bundles',()=>{
 for(const file of ['scripts/build-vercel.mjs','scripts/build.mjs']){
  const source=read(file);
  const recovery=source.indexOf("readFileSync('mobile-scout-recovery.css','utf8')");
  const dock=source.indexOf("readFileSync('floating-dock.css','utf8')");
  assert.ok(dock>0&&recovery>dock,file);
 }
});
