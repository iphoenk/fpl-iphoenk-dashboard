import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../decision-first.js',import.meta.url),'utf8');
const section=js.slice(js.indexOf('  function leagueBlockStart('),js.indexOf('  function pitchCard('));
for(const [rank,start,page] of [[1,1,1],[6,1,1],[10,1,1],[11,11,1],[274,271,6]]){
 test(`rank ${rank}: correct ten-team block and separate leader/member totals`,async()=>{
  const rows=Array.from({length:50},(_,i)=>({rank:(page-1)*50+i+1,entry:(page-1)*50+i+1,total:600-i}));
  rows[rank-(page-1)*50-1]={rank,entry:3462711,total:477};
  const top={league:{id:9477},standings:{results:page===1?rows:[{rank:1,entry:9,total:517}],has_next:true}};
  if(rank!==1&&page===1)top.standings.results[0].total=517;
  const calls=[];
  const context=vm.createContext({state:{entry:{id:3462711},gw:7},leagueList:()=>[{id:9477,entry_rank:rank}],currentLeagueId:()=>9477,renderDecision(){},api:async path=>{calls.push(path);return path.endsWith('='+page)?{league:{id:9477},standings:{results:rows,has_next:true}}:top;}});
  vm.runInContext(section+';this.run=refreshLeagueSnapshot;this.value=()=>snapshot;this.blockRows=leagueBlockRows;',context);
  await context.run();
  const result=context.value();
  assert.equal(result.blockStart,start);assert.equal(result.own.entry,3462711);
  const block=context.blockRows(result.local.standings.results,start);
  assert.equal(block.length,10);assert.ok(block.some(r=>r.entry===3462711));
  assert.ok(calls.some(p=>p.endsWith('='+page)));
  assert.equal(result.error,null);
  assert.equal(result.leader.total-result.own.total,rank===1?0:40);
 });
}
test('partial standings failure does not invent a leader or gap',async()=>{
 const context=vm.createContext({state:{entry:{id:3462711},gw:7},leagueList:()=>[{id:9477,entry_rank:274}],currentLeagueId:()=>9477,renderDecision(){},api:async()=>{throw Error('partial source');}});
 vm.runInContext(section+';this.run=refreshLeagueSnapshot;this.value=()=>snapshot;',context);
 await context.run();const value=context.value();
 assert.equal(value.leader,null);assert.equal(value.own,null);assert.equal(value.local,null);assert.equal(value.error,'partial source');
});
