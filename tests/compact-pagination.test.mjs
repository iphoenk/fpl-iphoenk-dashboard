import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('news keeps a valid ten-item window after refreshed results shrink',()=>{
 const source=readFileSync(new URL('../compact-pagination.js',import.meta.url),'utf8');
 const c=vm.createContext({});vm.runInContext(source.slice(0,source.indexOf('(()=>')),c);
 const rows=Array.from({length:25},(_,i)=>i+1);
 let end=c.compactPageEnd(rows.length,30);assert.deepEqual(rows.slice(end-10,end),[21,22,23,24,25]);
 end=c.compactPageEnd(5,end);assert.equal(end,10);assert.deepEqual(rows.slice(0,5).slice(end-10,end),[1,2,3,4,5]);
 assert.equal(c.compactPageEnd(0,30),10);
});

test('Squad breakdown always shows the entire official 15-player table',()=>{
 const source=readFileSync(new URL('../compact-pagination.js',import.meta.url),'utf8');
 const c=vm.createContext({});
 vm.runInContext(source.slice(0,source.indexOf('(()=>')),c);
 assert.equal(c.shouldCompactPaginate({closest:selector=>selector==='#squadTable'?{}:null}),false);
 assert.equal(c.shouldCompactPaginate({closest:()=>null}),true);
 assert.match(source,/if\(!shouldCompactPaginate\(list\)\)return;/);
 const app=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 assert.match(app,/id='squadTable'|\$\('squadTable'\)\.innerHTML/);
 assert.match(app,/picks\.map\(pick=>/);
});
