import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../advanced-league.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('async function collectCompleteLeagueStandings('),source.indexOf('async function renderLeagueExtras('));
const countHelper=source.slice(source.indexOf('function leagueCounts('),source.indexOf('function leagueOwnershipPanels('));
const mkrows=(from,to)=>Array.from({length:to-from+1},(_,i)=>({entry:from+i,entry_name:'Team '+(from+i),rank:from+i,total:500}));
const first={league:{id:9477},standings:{results:mkrows(1,50),has_next:true}};
const last={league:{id:9477},standings:{results:mkrows(51,58),has_next:false}};
function ctx(load){
 const context=vm.createContext({state:{leaguePage:1,league:{league:{id:9477}}},ext:{leagueToken:1},api:load});
 vm.runInContext(helper+';this.collect=collectCompleteLeagueStandings;this.valid=validLeaguePicks;',context);
 vm.runInContext(countHelper+';this.count=leagueCounts;',context);
 return context;
}
test('58-person classic league fetches page 2 and uses all 58 unique teams',async()=>{
 const requested=[];const x=ctx(async path=>{requested.push(path);return last;});
 const result=await x.collect(first,1);
 assert.equal(result.complete,true);
 assert.equal(result.rows.length,58);
 assert.equal(new Set(result.rows.map(r=>r.entry)).size,58);
 assert.deepEqual(requested,['leagues-classic/9477/standings/?page_standings=2']);
});
test('denominator 58 produces 42/58, never 42/50',async()=>{
 const x=ctx(async()=>last);
 const result=await x.collect(first,1);
 const records=result.rows.map((row,i)=>({row,picks:{picks:[{element:i<42?101:102,is_captain:i<42}]}}));
 const counted=x.count(records);
 assert.equal(counted.counts[101],42);
 assert.equal(result.rows.length,58);
 assert.ok(Math.abs(counted.counts[101]/result.rows.length*100-72.413793)<.0001);
 assert.notEqual(counted.counts[101]/result.rows.length,42/50);
});
test('failed last page rejects full-coverage ownership (fail closed)',async()=>{
 const x=ctx(async()=>{throw new Error('upstream 429')});
 const result=await x.collect(first,1);
 assert.equal(result.complete,false);
 assert.equal(result.rows.length,50);
 assert.match(result.reason,/gagal dimuat/);
 assert.match(source,/if\(!coverage\?\.complete\)return panel\('Who owns whom'/);
 assert.match(source,/ext\.leagueOwnRecords=coverage\.complete\?ownRecords:\[\]/);
});
test('duplicates or wrong-league standings are not silently counted',async()=>{
 const dup={league:{id:9477},standings:{results:mkrows(49,58),has_next:false}};
 const result=await ctx(async()=>dup).collect(first,1);
 assert.equal(result.complete,false);
 assert.match(result.reason,/duplikat/);
 const mismatch=await ctx(async()=>({league:{id:444},standings:{results:mkrows(51,58),has_next:false}})).collect(first,1);
 assert.equal(mismatch.complete,false);
 assert.match(mismatch.reason,/tidak cocok/);
});
test('ownership picks require all fifteen distinct players for the correct GW',()=>{
 const x=ctx(async()=>last);
 const full={picks:Array.from({length:15},(_,i)=>({element:i+1})),entry_history:{event:9}};
 assert.equal(x.valid(full,9),true);
 assert.equal(x.valid({...full,picks:full.picks.slice(0,14)},9),false);
 assert.equal(x.valid({...full,picks:[...full.picks.slice(0,14),full.picks[0]]},9),false);
 assert.equal(x.valid(full,10),false);
});
test('UI always identifies complete league coverage and does not label a single page the entire league',()=>{
 assert.match(source,/const fullKey='league-full-'/);
 assert.match(source,/const ownKey='leagueown-full-'/);
 assert.match(source,/n=coverage\.total/);
 assert.match(source,/Ownership: seluruh '\+coverage\.total\+' tim liga/);
 assert.match(source,/Coba refresh/);
 assert.match(source,/Bukan ownership global FPL/);
});
