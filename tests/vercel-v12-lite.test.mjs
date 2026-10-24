import test from 'node:test';
import assert from 'node:assert/strict';
import {multiGwDecision} from '../multiuser-horizon.mjs';

const bootstrap={elements:[],events:[{id:9,is_next:true,deadline_time:'2026-10-30T18:00:00Z'}]};
const picks={entry_history:{bank:100,event:8},picks:[]};
const entry={id:3462711};

function player(id,position,team=1,xpm=[5,5,5,5,5]){
 return {id,element_type:position,team,status:'a',now_cost:50,web_name:'P'+id,xpm,nx:{pstart:.9,pplay:.95}};
}

function fixture(){
 const owned=[player(1,1,1),player(2,1,2),...Array.from({length:5},(_,i)=>player(3+i,2,3+i)),...Array.from({length:5},(_,i)=>player(8+i,3,8+i)),...Array.from({length:3},(_,i)=>player(13+i,4,13+i))];
 const all=[...owned,player(30,2,4,[6,6,6,6,6]),player(31,3,4,[6,6,6,6,6]),player(32,4,4,[6,6,6,6,6])];
 for(let id=100;all.length<320;id++)all.push(player(id,(id%4)+1,(id%20)+1));
 return {owned,all};
}

for(const horizon of [1,3,5])test(`Vercel V12 Lite contract supports ${horizon} GW`,()=>{
 const {owned,all}=fixture();
 const result=multiGwDecision({entry,picks:{...picks,picks:owned.map((p,i)=>({element:p.id,selling_price:50,is_captain:i===0,is_vice_captain:i===1}))},bootstrap:{...bootstrap,elements:all},planningGw:9,snapshot:{meta:{authority:'model',next_gw:9,horizon:5,built_at:'2026-10-24T00:00:00Z',sources:[{source:'FPL official API',status:'ok'}]},players:all.map(p=>({id:p.id,t:p.team,p:p.element_type,xpm:p.xpm,nx:p.nx}))},horizon,now:Date.parse('2026-10-24T01:00:00Z')});
 assert.equal(result.vercel_v12_lite.contract,'FPL_V12_VERCEL_DECISION_V1');
 assert.equal(result.vercel_v12_lite.status,'READY_LITE');
 assert.equal(result.horizon,horizon);
 assert.equal(result.vercel_v12_lite.canonical_v12,false);
 assert.equal(result.monte_carlo,false);
 assert.equal(result.scenarios.A.formation.length>0,true);
 assert.equal(result.scenarios.A.starting_xi.length,11);
 assert.equal(result.scenarios.A.bench.length,4);
 assert.equal(result.scenarios.A.captain,1);
 assert.equal(result.scenarios.A.vice_captain,3);
 assert.equal(result.scenarios.A.risk.risk_status,'INDICATIVE');
 assert.equal(result.provenance.model_built_at,'2026-10-24T00:00:00.000Z');
});
