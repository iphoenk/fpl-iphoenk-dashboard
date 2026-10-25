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
 assert.equal(scope.label(p),'Doubtful · FPL flag 75% · Hip injury · updated 24 Oct');
 assert.equal((scope.label(p).match(/75%/g)||[]).length,1);
 assert.equal(scope.label({status:'d',chance_of_playing_next_round:75,news:'Unspecified injury - 75% chance of playing'}),'Doubtful · FPL flag 75% · Unspecified injury');
});
test('below 75% the label shows the official flag, never a probability reading, and keeps the return-date news',()=>{
 assert.equal(scope.label({status:'d',chance_of_playing_next_round:50,news:'Foot injury - 50% chance of playing'}),'Doubtful · FPL flag 50% · Foot injury');
 assert.equal(scope.label({status:'d',chance_of_playing_next_round:25,news:'Knee injury - 25% chance of playing'}),'Doubtful · FPL flag 25% · Knee injury');
 assert.equal(scope.label({status:'i',chance_of_playing_next_round:0,news:'Thigh injury - Unknown return date',news_added:'2026-10-21T08:00:00Z'}),'Injured · FPL flag 0% · Thigh injury - Unknown return date · updated 21 Oct');
 assert.equal(scope.label({status:'i',chance_of_playing_next_round:null,news:'Hamstring injury - Expected back 1 Nov'}),'Injured · Hamstring injury - Expected back 1 Nov');
 assert.equal(scope.label({status:'a',chance_of_playing_next_round:null}),'');
});
test('squad note lists flagged players, red first, and omits itself when everyone is fit',()=>{
 const fit={web_name:'Fit',status:'a',chance_of_playing_next_round:null};
 assert.equal(scope.summary([fit,null]),'');
 const text=scope.summary([{web_name:'Calafiori',status:'d',chance_of_playing_next_round:75},fit,{web_name:'Saka',status:'i',chance_of_playing_next_round:0}]);
 assert.match(text,/^Fitness flags: Saka 0%, Calafiori 75%\./);
 assert.match(text,/not a probability of starting/);
 assert.doesNotMatch(text,/chance of playing/);
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

test('labels never read an FPL flag as a probability, and departed players get a neutral label',()=>{
 for(const c of [0,25,50,75])assert.doesNotMatch(scope.label({status:c===75?'d':c===0?'i':'d',chance_of_playing_next_round:c,news:'x'}),/coin flip|unlikely|expected to play|chance of playing/);
 assert.equal(scope.label({status:'u',chance_of_playing_next_round:0,news:'Joined Fulham - 0% chance of playing'}),'Tidak aktif di FPL · Joined Fulham');
 assert.equal(scope.label({status:'u',chance_of_playing_next_round:null,news:''}),'Tidak aktif di FPL');
});
