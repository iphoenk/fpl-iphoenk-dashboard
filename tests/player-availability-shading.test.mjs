import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const start=ui.indexOf('function playerAvailabilityLevel('),end=ui.indexOf('document.addEventListener(\'error\'',start);
const marker=ui.slice(start,end);
const scope=vm.createContext({esc:String});
vm.runInContext(marker+'\nglobalThis.level=playerAvailabilityLevel;globalThis.label=playerAvailabilityLabel;globalThis.summary=playerAvailabilitySummary;',scope);
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
test('label states the chance once: the FPL news suffix is not repeated',()=>{
 const p={status:'d',chance_of_playing_next_round:75,news:'Hip injury - 75% chance of playing',news_added:'2026-10-24T09:00:00Z'};
 assert.equal(scope.label(p),'Doubtful · 75% chance of playing · Hip injury · updated 24 Oct');
 assert.equal((scope.label(p).match(/75%/g)||[]).length,1);
 assert.equal(scope.label({status:'d',chance_of_playing_next_round:75,news:'Unspecified injury - 75% chance of playing'}),'Doubtful · 75% chance of playing · Unspecified injury');
});
test('below 75% the label explains what the chance means and keeps the return-date news',()=>{
 assert.equal(scope.label({status:'d',chance_of_playing_next_round:50,news:'Foot injury - 50% chance of playing'}),'Doubtful · 50% chance of playing (a coin flip) · Foot injury');
 assert.equal(scope.label({status:'d',chance_of_playing_next_round:25,news:'Knee injury - 25% chance of playing'}),'Doubtful · 25% chance of playing (unlikely to play) · Knee injury');
 assert.equal(scope.label({status:'i',chance_of_playing_next_round:0,news:'Thigh injury - Unknown return date',news_added:'2026-10-21T08:00:00Z'}),'Injured · 0% chance of playing (not expected to play) · Thigh injury - Unknown return date · updated 21 Oct');
 assert.equal(scope.label({status:'i',chance_of_playing_next_round:null,news:'Hamstring injury - Expected back 1 Nov'}),'Injured · Hamstring injury - Expected back 1 Nov');
 assert.equal(scope.label({status:'a',chance_of_playing_next_round:null}),'');
});
test('squad note lists flagged players, red first, and omits itself when everyone is fit',()=>{
 const fit={web_name:'Fit',status:'a',chance_of_playing_next_round:null};
 assert.equal(scope.summary([fit,null]),'');
 const text=scope.summary([{web_name:'Calafiori',status:'d',chance_of_playing_next_round:75},fit,{web_name:'Saka',status:'i',chance_of_playing_next_round:0}]);
 assert.match(text,/^Fitness flags: Saka 0%, Calafiori 75%\./);
 assert.match(text,/Amber = 75% chance of playing, red = below 75% or out/);
});
test('no "!" badge anywhere; card title and accessible name carry the label',()=>{
 assert.doesNotMatch(ui,/player-fitness/);
 assert.match(ui,/aria-label="Details '\+esc\(p\.web_name\+\(playerAvailabilityLabel\(p\)/);
 assert.match(ui,/playerAvailabilitySummary\(picks\.map\(p=>state\.players\[p\.element\]\)\)/);
});
test('player cards carry the fit class and both builds ship availability.css',()=>{
 assert.match(ui,/' fit-'\+playerAvailabilityLevel\(p\)/);
 const css=readFileSync(new URL('../availability.css',import.meta.url),'utf8');
 assert.match(css,/\.player\.fit-amber\{[^}]*rgba\(255,196,0/);
 assert.match(css,/\.player\.fit-red\{[^}]*rgba\(226,48,72/);
 for(const f of ['scripts/build-vercel.mjs','scripts/build.mjs'])assert.match(readFileSync(new URL('../'+f,import.meta.url),'utf8'),/readFileSync\('availability\.css','utf8'\)/);
});
