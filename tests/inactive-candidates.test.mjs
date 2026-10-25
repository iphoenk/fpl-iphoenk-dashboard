import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../advanced.js',import.meta.url),'utf8');
const pick=name=>{const i=src.indexOf('function '+name+'(');assert.ok(i>=0,name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;if(src[k]==='}'&&--d===0)return src.slice(i,k+1);}};
const code=['allPlayers','isInactivePlayer','candidatePlayers','inactiveToggle'].map(pick).join('\n');
const make=show=>{const c=vm.createContext({state:{players:{1:{id:1,status:'a'},2:{id:2,status:'u'},3:{id:3,status:'i'}}},ext:{showInactive:show}});vm.runInContext(code+'\nglobalThis.api={candidatePlayers,inactiveToggle};',c);return c.api;};
test('inactive (status u) players are excluded from candidate lists by default',()=>{
 assert.equal(JSON.stringify(make(false).candidatePlayers().map(p=>p.id)),'[1,3]');
});
test('injured players stay candidates; the toggle opts inactive players back in',()=>{
 assert.equal(JSON.stringify(make(true).candidatePlayers().map(p=>p.id)),'[1,2,3]');
 assert.match(make(false).inactiveToggle(),/data-show-inactive/);
 assert.match(make(true).inactiveToggle(),/checked/);
});
