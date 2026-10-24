import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicDecisionService} from '../multiuser-decision-server.mjs';

const players=[];
for(let i=1;i<=15;i++)players.push({id:i,web_name:'P'+i,element_type:i<=2?1:i<=7?2:i<=12?3:4,team:i,status:'a',ep_next:'5',now_cost:50});
const bootstrap={elements:players,events:[
 {id:7,deadline_time:'2026-10-18T11:00:00Z',finished:true},
 {id:8,is_next:true,deadline_time:'2026-10-25T11:00:00Z'}
]};
const picks={picks:players.map((p,i)=>({element:p.id,position:i+1,selling_price:50,is_captain:i===0,is_vice_captain:i===1})),
 entry_history:{bank:100,event:7,points:50,value:1000}};
const canonical={contract:'FPL_V12_CANONICAL_DECISION_V1',status:'ready',entry_id:123,horizon:1,planning_gw:8,
 owned_15:players.map(p=>({id:p.id})),provenance:{input_fingerprint:'fp-123',canonical_v12_revision:'v12-test'},
 decision:{starting_xi:players.slice(0,11).map(p=>p.id),bench:players.slice(11).map(p=>p.id),captain:1,vice_captain:2,monte_carlo:false}};

test('decision service uses validated Canonical V12 payload when configured',async()=>{
 const calls=[];
 const fetcher=async url=>{
  calls.push(String(url)); const u=new URL(url); const p=u.pathname;
  if(u.hostname==='v12.example.test')return Response.json(canonical);
  if(p.endsWith('/bootstrap-static/'))return Response.json(bootstrap);
  if(p.endsWith('/latest_index.json'))return Response.json({generated_at:'2026-10-24T00:00:00Z',sources:[]});
  if(p.endsWith('/publish_integrity.json'))return Response.json({status:'PASS',observed_at:'2026-10-24T00:00:00Z'});
  if(p.endsWith('/picks/'))return Response.json(picks);
  if(p.endsWith('/history/'))return Response.json({current:[]});
  return Response.json({id:123,name:'Test'});
 };
 const service=createPublicDecisionService({fetcher,clock:()=>Date.parse('2026-10-24T01:00:00Z'),
  canonicalBaseUrl:'https://v12.example.test/api/decision'});
 const result=await service.get(123,1);
 assert.equal(result.canonical_v12,true);
 assert.equal(result.source.authority,'CANONICAL_V12');
 assert.equal(result.source.model_mode,'CANONICAL_V12_SERVICE');
 assert.equal(result.provenance.input_fingerprint,'fp-123');
 assert.ok(calls.some(url=>url.includes('entry_id=123')&&url.includes('horizon=1')));
});
