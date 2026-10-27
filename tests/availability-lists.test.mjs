import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const start=ui.indexOf('function playerAvailabilityLevel('),end=ui.indexOf('document.addEventListener(\'error\'',start);
const lib=ui.slice(start,end);
const ext=readFileSync(new URL('../availability-ui.js',import.meta.url),'utf8').split('(function watchAvailability')[0];
const el=(id,cls=[],text='X')=>{const attrs={},set=new Set(cls);return {dataset:{player:String(id)},classList:{contains:c=>set.has(c),add:(...c)=>c.forEach(x=>set.add(x)),has:c=>set.has(c)},getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{attrs[k]=v},textContent:text,attrs,set};};
function run(players,nodes){
 const root={querySelectorAll:()=>nodes};
 const c=vm.createContext({state:{players},esc:String,Number});
 vm.runInContext(lib+'\n'+ext+'\nglobalThis.d=decorateAvailability;',c);
 c.d(root);
}
const players={1:{web_name:'Saka',status:'i',chance_of_playing_next_round:0,news:'Thigh injury - Unknown return date'},2:{web_name:'Calafiori',status:'d',chance_of_playing_next_round:75,news:'Hip injury - 75% chance of playing'},3:{web_name:'Haaland',status:'a',chance_of_playing_next_round:null,news:''}};
test('list buttons for flagged players get shading class, title and accessible name',()=>{
 const saka=el(1,[],'Saka'),cal=el(2,[],'Calafiori'),hal=el(3,[],'Haaland');
 run(players,[saka,cal,hal]);
 assert.ok(saka.set.has('fit-red')&&saka.set.has('fit-inline'));
 assert.ok(cal.set.has('fit-amber'));
 assert.equal(hal.set.has('fit-red')||hal.set.has('fit-amber'),false);
 assert.match(saka.attrs.title,/^Injured · FPL flag 0% · Thigh injury/);
 assert.equal(cal.attrs['aria-label'],'Calafiori · Doubtful · FPL flag 75% · Hip injury');
});
test('pitch cards, unknown players and already-processed nodes are left alone; an existing title is kept',()=>{
 const card=el(1,['player'],'Saka'),unknown=el(99),done=el(1);done.dataset.fitDone='1';
 const titled=el(2);titled.attrs.title='Existing';
 run(players,[card,unknown,done,titled]);
 assert.equal(card.set.has('fit-red'),false);
 assert.equal(unknown.set.has('fit-red'),false);
 assert.equal(done.set.has('fit-red'),false);
 assert.equal(titled.attrs.title,'Existing');
});
test('both builds load availability-ui.js and the CSS styles inline buttons',()=>{
 for(const f of ['scripts/build-vercel.mjs','scripts/build.mjs'])assert.match(readFileSync(new URL('../'+f,import.meta.url),'utf8'),/'planning-compact\.js','availability-ui\.js'(?:,'[a-z-]+\.js')*\]/);
 assert.match(readFileSync(new URL('../availability.css',import.meta.url),'utf8'),/button\.fit-inline\.fit-red/);
});

test('observer uses a timer, not requestAnimationFrame, so hidden tabs are still decorated',()=>{
 const src=readFileSync(new URL('../availability-ui.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/requestAnimationFrame/);
 assert.match(src,/setTimeout\(run,40\)/);
});

test('departed players (status u) get a neutral inactive style in lists, never red',()=>{
 const gone=el(9,[],'Leaver');
 run({9:{web_name:'Leaver',status:'u',chance_of_playing_next_round:0,news:'Joined Fulham - 0% chance of playing'}},[gone]);
 assert.ok(gone.set.has('fit-inactive'));
 assert.equal(gone.set.has('fit-red'),false);
 assert.equal(gone.attrs.title,'Tidak aktif di FPL · Joined Fulham');
});
