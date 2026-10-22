import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
function render(players,picks){
 const nodes=Object.fromEntries(['captainCard','radar','modelStatus','scoutNotice'].map(id=>[id,{innerHTML:'',textContent:'',classList:{toggle(){}}}]));
 const state={players:Object.fromEntries(players.map(p=>[p.id,p])),picks:{picks},next:{id:8},teams:{1:{short_name:'ARS'}},manifest:{default_model:'config_d',generated_at:'2026-10-21T12:11:19Z'}};
 const context=vm.createContext({state,$:id=>nodes[id],xp:p=>p.xp,esc:String,fmt:String,money:String,positions:{3:'MID'},fixturePills:()=>'',deviceDateTime:x=>x});
 vm.runInContext(source.slice(source.indexOf('function rankedPlayers()'),source.indexOf('async function loadBase()'))+';renderInsights();',context);
 return nodes;
}
test('captain and vice come from owned starters rather than a higher ranked unowned player',()=>{
 const out=render([{id:1,web_name:'Owned C',xp:5.23,team:1},{id:2,web_name:'Owned VC',xp:4.34,team:1},{id:3,web_name:'Unowned',xp:8,team:1}], [{element:1,position:1},{element:2,position:2}]);
 assert.match(out.captainCard.innerHTML,/Wakil kapten/);
 assert.match(out.captainCard.innerHTML,/Owned VC/);
 assert.doesNotMatch(out.captainCard.innerHTML,/Unowned/);
 assert.match(out.modelStatus.textContent,/FPLens/);
 assert.match(out.modelStatus.textContent,/2026-10-21T12:11:19Z/);
 assert.match(out.modelStatus.textContent,/bukan rekomendasi transfer personal/);
});
test('without a connected squad global rankings do not become a personal captain recommendation',()=>{
 const out=render([{id:1,web_name:'Global leader',xp:8,team:1}],[]);
 assert.doesNotMatch(out.captainCard.innerHTML,/<h3>Global leader/);
 assert.match(out.captainCard.innerHTML,/Hubungkan tim/);
});
