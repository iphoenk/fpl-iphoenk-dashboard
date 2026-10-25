import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const start=ui.indexOf('function playerAvailabilityLevel('),end=ui.indexOf('document.addEventListener(\'error\'',start);
const marker=ui.slice(start,end);
const scope=vm.createContext({esc:String});
vm.runInContext(marker+'\nglobalThis.level=playerAvailabilityLevel;globalThis.marker=playerFitnessMarker;',scope);
const level=p=>scope.level(p);

test('available players get no shading',()=>{
 assert.equal(level({status:'a',chance_of_playing_next_round:null}),'');
 assert.equal(level({status:'a'}),'');
 assert.equal(level({status:'a',chance_of_playing_next_round:100}),'');
});
test('75% chance is amber; below 75% is red',()=>{
 assert.equal(level({status:'d',chance_of_playing_next_round:75}),'amber');
 assert.equal(level({status:'d',chance_of_playing_next_round:50}),'red');
 assert.equal(level({status:'i',chance_of_playing_next_round:25}),'red');
 assert.equal(level({status:'i',chance_of_playing_next_round:0}),'red');
});
test('missing chance falls back to status: doubtful amber, injured/suspended/unavailable red',()=>{
 assert.equal(level({status:'d',chance_of_playing_next_round:null}),'amber');
 for(const s of ['i','s','u','n'])assert.equal(level({status:s,chance_of_playing_next_round:null}),'red',s);
});
test('marker keeps a non-colour cue: "!" with the chance in title and aria-label',()=>{
 const html=scope.marker({status:'d',chance_of_playing_next_round:75,news:'Unspecified injury'});
 assert.match(html,/>!<\/span>/);
 assert.match(html,/aria-label="Doubtful · 75% chance of playing"/);
 assert.match(html,/title="Doubtful · 75% chance of playing · Unspecified injury"/);
 assert.equal(scope.marker({status:'a'}),'');
});
test('player cards carry the fit class and both builds ship availability.css',()=>{
 assert.match(ui,/' fit-'\+playerAvailabilityLevel\(p\)/);
 const css=readFileSync(new URL('../availability.css',import.meta.url),'utf8');
 assert.match(css,/\.player\.fit-amber\{[^}]*rgba\(255,196,0/);
 assert.match(css,/\.player\.fit-red\{[^}]*rgba\(226,48,72/);
 for(const f of ['scripts/build-vercel.mjs','scripts/build.mjs'])assert.match(readFileSync(new URL('../'+f,import.meta.url),'utf8'),/readFileSync\('availability\.css','utf8'\)/);
});
