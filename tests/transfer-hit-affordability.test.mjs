import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

/* GAP-01: transfer hit, free-transfer provenance, sale price and bank in advanced-planning.js. */
const source=readFileSync(new URL('../advanced-planning.js',import.meta.url),'utf8');
const pick=name=>{const i=source.indexOf('function '+name+'(');assert.ok(i>=0,name);let d=0;const j=source.indexOf('}){',i)>=0&&source.indexOf('}){',i)<source.indexOf('\n',i)?source.indexOf('}){',i)+2:source.indexOf('){',i)+1;for(let k=j;k<source.length;k++){if(source[k]==='{')d++;if(source[k]==='}'&&--d===0)return source.slice(i,k+1);}};
const NAMES=['strictNumber','ftParse','transferScope','transferFtFromReport','transferFtContext','transferHitContext','transferHit','transferNetSummary','transferBankInfo','transferSellingPrice','transferAffordabilityLabel','loadTransferFt','currentSquad','transferSuggestions','transferCard','transferPanels'];
const code=NAMES.map(pick).join('\n');

const player=(id,type,team,cost,xp,extra={})=>({id,element_type:type,team,now_cost:cost,xp,status:'a',web_name:'P'+id,...extra});
function make({picks,players,ext={},gw=10,next=10,api,entryId=1}={}){
 const sandbox={
  state:{entry:{id:entryId},next:{id:next},gw,teams:{},players:Object.fromEntries(players.map(p=>[p.id,p])),picks},
  ext:{horizon:1,...ext},
  fmt:(n,d=1)=>Number(n).toFixed(d),esc:s=>String(s??'').replace(/[&<>"']/g,''),money:t=>'£'+(t/10).toFixed(1)+'m',
  numberOrNull:v=>{const n=Number(v);return v==null||!Number.isFinite(n)?null:n;},
  panel:(title,body,foot='')=>'<section data-title="'+title+'">'+body+'<footer>'+foot+'</footer></section>',emptyState:t=>'<div class="empty">'+t+'</div>',
  ownIds:()=>new Set(picks?.picks.map(p=>p.element)||[]),allPlayers:()=>players,candidatePlayers:()=>players,
  projectedAt:p=>p.xp??null,playerPhoto:()=>'',fixturePills:()=>'',api:api||(async()=>{throw new Error('no api');})
 };
 vm.createContext(sandbox);
 vm.runInContext(code+'\nglobalThis.t={ftParse,strictNumber,transferFtContext,transferHit,transferNetSummary,transferBankInfo,transferSellingPrice,transferAffordabilityLabel,loadTransferFt,transferSuggestions,transferCard,transferPanels};',sandbox);
 return {t:sandbox.t,sandbox};
}
const squadPicks=(ids,entry_history={bank:10,event_transfers:0},extra={})=>({picks:ids.map((element,i)=>({element,position:i+1})),entry_history,...extra});
/* owned DEF 2 and 3 (xp 3); market DEF 11 (xp 9), 12 (xp 8), 13 (xp 7) */
const basePlayers=()=>[player(1,1,1,45,2),player(2,2,2,50,3),player(3,2,3,50,3),player(11,2,4,50,9),player(12,2,5,50,8),player(13,2,6,60,7)];
const base=(over={})=>make({players:basePlayers(),picks:squadPicks([1,2,3]),ext:{ftPublic:{entryId:1,gw:10,status:'ready',value:1}},...over});
const hasPairCard=html=>html.includes('adv-card green');

test('hit maths: FT 0, 1, 2, 3 and unknown for one and two transfers',()=>{
 const {t}=base();
 const hit=(n,ft,o={})=>t.transferHit(n,{ft,...o});
 assert.deepEqual([0,1,2,3].map(ft=>hit(1,ft).hit),[4,0,0,0]);
 assert.deepEqual([0,1,2,3].map(ft=>hit(2,ft).hit),[8,4,0,0]);
 for(const bad of [null,undefined,NaN,'abc','',-1,6,1.5])assert.equal(hit(2,bad).status,'unknown',String(bad));
 assert.deepEqual(JSON.parse(JSON.stringify(hit(2,null).scenarios)),[{ft:'0',hit:8},{ft:'1',hit:4},{ft:'2+',hit:0}]);
 assert.equal(hit(0,2).status,'invalid');
});

test('two transfers do not always cost 4: FT 2 or more gives a zero hit',()=>{
 const {t}=base({ext:{ftUser:2}});
 const html=t.transferNetSummary(5,2);
 assert.match(html,/data-hit="0"/);
 assert.match(html,/Hit 0/);
 assert.doesNotMatch(html,/−4/);
 assert.match(html,/Net \+5\.00/);
});

test('transfers already made this GW consume free transfers only when verified',()=>{
 const {t}=base();
 assert.equal(t.transferHit(2,{ft:2,made:1}).hit,4);
 assert.equal(t.transferHit(2,{ft:1,made:1}).hit,8);
 assert.equal(t.transferHit(1,{ft:1,made:3}).hit,4,'earlier hits are sunk, the new transfer is paid');
 assert.equal(t.transferHit(2,{ft:2,made:null}).hit,0);
 assert.equal(t.transferHit(2,{ft:2,made:null}).assumesNoEarlier,true);
 const same=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:10,event_transfers:1},{active_chip:null}),gw:10,next:10,ext:{ftUser:2}});
 assert.match(same.t.transferNetSummary(5,2),/data-hit="4"/);
 const other=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:10,event_transfers:1},{active_chip:null}),gw:9,next:10,ext:{ftUser:2}});
 assert.match(other.t.transferNetSummary(5,2),/data-hit="0"/);
 assert.match(other.t.transferNetSummary(5,2),/not verified/);
});

test('chip state: Wildcard and Free Hit remove the hit, unknown chip state is disclosed',()=>{
 const {t}=base();
 assert.equal(t.transferHit(2,{ft:0,chip:'wildcard'}).hit,0);
 assert.equal(t.transferHit(2,{ft:0,chip:'freehit'}).hit,0);
 assert.equal(t.transferHit(2,{ft:0,chip:'bboost'}).hit,8);
 assert.equal(t.transferHit(2,{ft:0,chip:'none'}).chipUnknown,false);
 const wc=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:10,event_transfers:0},{active_chip:'wildcard'}),gw:10,next:10,ext:{ftUser:0}});
 assert.match(wc.t.transferNetSummary(5,2),/Wildcard is active/);
 const unknownChip=make({players:basePlayers(),picks:squadPicks([1,2,3]),gw:9,next:10,ext:{ftUser:1}});
 assert.match(unknownChip.t.transferNetSummary(5,2),/no hit if Wildcard or Free Hit is played/);
});

test('unknown FT never yields a single net number and states every scenario',()=>{
 const {t}=base({ext:{ftPublic:{entryId:1,gw:10,status:'unavailable',value:null}}});
 const html=t.transferNetSummary(6,2);
 assert.match(html,/data-ft-status="unknown"/);
 assert.match(html,/FT UNVERIFIED/);
 assert.match(html,/FT 0: net -2\.00/);
 assert.match(html,/FT 1: net \+2\.00/);
 assert.match(html,/FT 2\+: net \+6\.00/);
 assert.doesNotMatch(html,/<strong>Net/);
});

test('FT provenance: user-provided beats public, public is labelled inferred, stale context is unknown',()=>{
 const pub=base();
 assert.equal(pub.t.transferFtContext().status,'public-inferred');
 assert.match(pub.t.transferFtContext().label,/inferred from public history, not an authenticated account value/);
 const user=base({ext:{ftUser:3,ftPublic:{entryId:1,gw:10,status:'ready',value:1}}});
 assert.equal(user.t.transferFtContext().status,'user');
 assert.equal(user.t.transferFtContext().value,3);
 assert.equal(base({ext:{ftPublic:{entryId:2,gw:10,status:'ready',value:1}}}).t.transferFtContext().status,'unknown');
 assert.equal(base({ext:{ftPublic:{entryId:1,gw:9,status:'ready',value:1}}}).t.transferFtContext().status,'unknown');
 assert.equal(base({ext:{ftPublic:{entryId:1,gw:10,status:'ready',value:99}}}).t.transferFtContext().status,'unknown');
 assert.equal(base({ext:{ftPublic:undefined}}).t.transferFtContext().label,'FT UNVERIFIED');
});

/* A decision response as /api/decision returns it for entry 1, planning GW 10, horizon 1 (fields the FT check relies on). */
const report=(over={},ts={},ev={})=>({status:'ready',contract:'PUBLIC_FPL_MULTIGW_ADVISORY_V2',canonical_v12:false,entry_id:1,planning_gw:10,horizon:1,
 team_state:{entry_id:1,requested_entry_id:1,planning_gameweek:10,free_transfers:2,authority:'OFFICIAL_FPL',source:'Official FPL',
  free_transfer_evidence:{value:2,as_of_gameweek:9,next_gameweek:10,source:'Official FPL entry history',verified:true,...ev},...ts},...over});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('loadTransferFt reads the public decision and accepts a fully matching response',async()=>{
 const calls=[];
 const ok=base({ext:{ftPublic:undefined},api:async path=>{calls.push(path);return report();}});
 await ok.t.loadTransferFt();
 assert.deepEqual(calls,['decision?entry_id=1&horizon=1']);
 assert.equal(ok.t.transferFtContext().value,2);
 assert.equal(ok.t.transferFtContext().status,'public-inferred');
 await ok.t.loadTransferFt();
 assert.equal(calls.length,1,'one request per entry and GW');
 const partial=base({ext:{ftPublic:undefined},api:async()=>report({status:'partial',contract:'PUBLIC_FPL_DETERMINISTIC_ADVISORY_V1',horizon:undefined})});
 await partial.t.loadTransferFt();
 assert.equal(partial.t.transferFtContext().value,2,'V1 contract without a horizon field is supported');
});

test('FT response validation fails closed: wrong team, GW, contract, status, authority, evidence',async()=>{
 const bad={
  'wrong team, same GW (top-level entry_id)':report({entry_id:2}),
  'wrong team in team_state':report({},{entry_id:2}),
  'requested entry mismatch':report({},{requested_entry_id:2}),
  'missing entry ids':report({entry_id:undefined},{entry_id:undefined}),
  'stale planning GW':report({planning_gw:9}),
  'stale team_state GW':report({},{planning_gameweek:9}),
  'future planning GW':report({planning_gw:11},{planning_gameweek:11}),
  'canonical V12 contract':report({contract:'FPL_V12_CANONICAL_DECISION_V1',canonical_v12:true}),
  'canonical flag set on a public contract':report({canonical_v12:true}),
  'unknown contract':report({contract:'SOMETHING_ELSE'}),
  'missing contract':report({contract:undefined}),
  'status unavailable':report({status:'unavailable'}),
  'status error':report({status:'error'}),
  'status stale':report({status:'stale'}),
  'horizon 3':report({horizon:3}),
  'wrong team_state authority':report({},{authority:'USER'}),
  'wrong team_state source':report({},{source:'Cache'}),
  'FT null':report({},{free_transfers:null}),
  'FT above cap':report({},{free_transfers:9},{value:9}),
  'FT fractional':report({},{free_transfers:1.5},{value:1.5}),
  'evidence missing':report({},{free_transfer_evidence:null}),
  'evidence disagrees with FT':report({},{},{value:3}),
  'evidence for another GW':report({},{},{next_gameweek:11,as_of_gameweek:10}),
  'evidence next GW only':report({},{},{next_gameweek:11}),
  'evidence next GW missing':report({},{},{next_gameweek:undefined}),
  'evidence as-of GW stale':report({},{},{as_of_gameweek:7}),
  'not an object':'ready',
  'null':null,
  'array':[]
 };
 for(const [name,reply] of Object.entries(bad)){
  const m=base({ext:{ftPublic:undefined},api:async()=>reply});await m.t.loadTransferFt();
  assert.equal(m.t.transferFtContext().status,'unknown',name);
  assert.equal(m.t.transferFtContext().value,null,name);
 }
 const failing=base({ext:{ftPublic:undefined},api:async()=>{throw new Error('429');}});await failing.t.loadTransferFt();
 assert.equal(failing.t.transferFtContext().status,'unknown');
 assert.match(failing.t.transferNetSummary(5,2),/FT UNVERIFIED/);
});

test('team switch: user FT, bank and sale prices of team A never apply to team B',()=>{
 const m=base({ext:{ftUser:2,transferBank:30,salePrices:{2:4.7},ftPublic:{entryId:1,gw:10,status:'ready',value:1}}});
 assert.equal(m.t.transferFtContext().status,'user');
 assert.equal(m.t.transferBankInfo().source,'user-provided');
 m.sandbox.state.entry={id:2};
 m.sandbox.state.picks=squadPicks([1,2,3],{bank:55,event_transfers:0});
 const ft=m.t.transferFtContext();
 assert.equal(ft.status,'unknown','team A public FT and user FT are gone');
 assert.equal(m.sandbox.ext.ftUser,undefined);
 const bank=m.t.transferBankInfo();
 assert.equal(bank.tenths,55,'team B uses its own public bank');
 assert.equal(bank.source,'last published GW');
 assert.equal(m.t.transferSellingPrice({id:2,now_cost:50}).source,'market-proxy');
 assert.equal(m.sandbox.ext.transferBankInvalid,false);
 // policy: nothing is restored when switching back
 m.sandbox.state.entry={id:1};
 assert.equal(m.t.transferFtContext().status,'unknown');
 assert.equal(m.t.transferBankInfo().source,'last published GW');
});

test('team switch also clears an invalid bank entry and a GW rollover resets inputs',()=>{
 const m=base({ext:{transferBankInvalid:true,ftUser:1}});
 assert.equal(m.t.transferBankInfo().valid,false);
 m.sandbox.state.entry={id:7};
 assert.equal(m.t.transferBankInfo().valid,true,'team 7 is not blocked by team 1\'s invalid entry');
 m.sandbox.ext.ftUser=3;m.sandbox.ext.transferBank=20;
 m.sandbox.state.next={id:11};m.sandbox.state.gw=11;
 assert.equal(m.t.transferFtContext().status,'unknown','planning GW changed, inputs expire');
 assert.equal(m.sandbox.ext.transferBank,undefined);
});

test('viewing another squad gameweek discards typed inputs and invalidates the public bank',()=>{
 const m=base({ext:{ftUser:2,transferBank:30,salePrices:{2:4.7}}});
 assert.equal(m.t.transferBankInfo().source,'user-provided');
 m.sandbox.state.gw=4;
 assert.equal(m.t.transferFtContext().status,'unknown','a bank or FT typed for the current squad does not follow the GW selector');
 assert.equal(m.sandbox.ext.transferBank,undefined);
 assert.equal(m.sandbox.ext.salePrices,undefined);
 assert.equal(m.t.transferBankInfo().valid,false,'the public bank of GW 4 is not the last published bank');
 assert.match(m.t.transferBankInfo().reason,/GW 4/);
 assert.equal(m.t.transferSuggestions(1).length,0);
 assert.match(m.t.transferPanels(),/data-bank-status="invalid"/);
 m.sandbox.state.gw=9;
 assert.equal(m.t.transferBankInfo().valid,true,'last published GW is accepted again');
 assert.equal(m.t.transferBankInfo().source,'last published GW');
 assert.equal(base({gw:9,next:10}).t.transferBankInfo().valid,true);
 assert.equal(base({gw:10,next:10}).t.transferBankInfo().valid,true);
 assert.equal(base({gw:4,next:10}).t.transferBankInfo().valid,false);
});

test('non-numeric values are rejected, not coerced: false, blank, arrays, hex and booleans',async()=>{
 const m=base();
 for(const bad of [false,true,' ','',[],{},'0x2','1e1',null,undefined,NaN,Infinity,'abc'])assert.equal(m.t.ftParse(bad),null,JSON.stringify(bad)+' as FT');
 assert.equal(m.t.ftParse(2),2);assert.equal(m.t.ftParse('3'),3);assert.equal(m.t.ftParse(' 1 '),1);
 for(const raw of [false,true,' ','',[],{},'0x2','1e1','abc',null,undefined,NaN,Infinity,-1]){
  const x=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:raw,event_transfers:0})});
  assert.equal(x.t.transferBankInfo().valid,false,'bank '+JSON.stringify(raw));
 }
 assert.equal(make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:'14',event_transfers:0})}).t.transferBankInfo().tenths,14);
 const falseFt=base({ext:{ftPublic:undefined},api:async()=>report({},{free_transfers:false},{value:false})});
 await falseFt.t.loadTransferFt();
 assert.equal(falseFt.t.transferFtContext().status,'unknown','false is not FT 0');
 const falseMade=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:10,event_transfers:false},{active_chip:null}),ext:{ftUser:2}});
 assert.match(falseMade.t.transferNetSummary(5,2),/not verified/,'false is not 0 transfers made');
});

test('affordability label only claims user input when bank and every sale price are user-provided',()=>{
 const outs=[{id:2,now_cost:50}];
 const publicBank=base({ext:{salePrices:{2:4.7}}});
 assert.doesNotMatch(publicBank.t.transferAffordabilityLabel(outs),/Affordability uses the bank and sale prices you entered/,'public bank is never user-confirmed');
 const confirmed=base({ext:{transferBank:30,salePrices:{2:4.7}}});
 assert.match(confirmed.t.transferAffordabilityLabel(outs),/Affordability uses the bank and sale prices you entered/);
 assert.doesNotMatch(confirmed.t.transferAffordabilityLabel([]),/Affordability uses the bank and sale prices you entered/,'an empty list confirms nothing');
 assert.doesNotMatch(base({ext:{transferBank:30}}).t.transferAffordabilityLabel(outs),/Affordability uses the bank and sale prices you entered/,'bank typed but sale price is a proxy');
});

test('stale async response for team A never changes team B',async()=>{
 const pending={};
 const api=path=>{const id=Number(path.match(/entry_id=(\d+)/)[1]);pending[id]=deferred();return pending[id].promise;};
 const m=base({ext:{ftPublic:undefined},api});
 const loadA=m.t.loadTransferFt();
 m.sandbox.state.entry={id:2};
 m.sandbox.state.picks=squadPicks([1,2,3],{bank:55,event_transfers:0});
 const loadB=m.t.loadTransferFt();
 assert.equal(m.t.transferFtContext().status,'unknown','team B is waiting for its own answer');
 pending[1].resolve(report({},{free_transfers:3},{value:3}));await loadA;
 assert.equal(m.t.transferFtContext().status,'unknown','team A answered first: ignored for team B');
 pending[2].resolve(report({entry_id:2},{entry_id:2,requested_entry_id:2,free_transfers:1},{value:1}));await loadB;
 assert.equal(m.t.transferFtContext().value,1);
 // switching back to A refetches instead of reusing a stale slot
 m.sandbox.state.entry={id:1};
 assert.equal(m.t.transferFtContext().status,'unknown');
 const again=m.t.loadTransferFt();
 pending[1].resolve(report());await again;
 assert.equal(m.t.transferFtContext().value,2);
});

test('wrong-team response for the active GW is rejected even when everything else matches',async()=>{
 const m=base({ext:{ftPublic:undefined},api:async()=>report({entry_id:2},{entry_id:2,requested_entry_id:2,free_transfers:5},{value:5})});
 await m.t.loadTransferFt();
 assert.equal(m.t.transferFtContext().status,'unknown');
 assert.doesNotMatch(m.t.transferNetSummary(5,2),/FT 5/);
});

test('one selling-price calculation: actual price below market, proxy label, invalid prices',()=>{
 const {t}=base({ext:{salePrices:{2:4.7,3:5.2}}});
 assert.deepEqual({...t.transferSellingPrice({id:2,now_cost:50})},{tenths:47,source:'actual'});
 assert.deepEqual({...t.transferSellingPrice({id:3,now_cost:50})},{tenths:null,source:'invalid'},'sale price above market is impossible');
 assert.deepEqual({...t.transferSellingPrice({id:4,now_cost:50})},{tenths:50,source:'market-proxy'});
 assert.deepEqual({...t.transferSellingPrice({id:4,now_cost:'x'})},{tenths:null,source:'invalid'});
 assert.deepEqual({...t.transferSellingPrice({id:4,now_cost:0})},{tenths:null,source:'invalid'});
 assert.equal(base({ext:{salePrices:{2:0}}}).t.transferSellingPrice({id:2,now_cost:50}).tenths,null);
 assert.equal(base({ext:{salePrices:{2:'abc'}}}).t.transferSellingPrice({id:2,now_cost:50}).source,'market-proxy','non-numeric input is ignored, not turned into zero');
 assert.match(base().t.transferAffordabilityLabel([{id:2,now_cost:50}]),/indicative/i);
 const confirmed=base({ext:{transferBank:30,salePrices:{2:4.7}}});
 assert.match(confirmed.t.transferAffordabilityLabel([{id:2,now_cost:50}]),/you entered/);
 assert.match(confirmed.t.transferAffordabilityLabel([{id:2,now_cost:50},{id:3,now_cost:50}]),/indicative/i);
});

test('single and pair cards use the same sale price and 0.1m integer arithmetic',()=>{
 const proxy=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:0,event_transfers:0}),ext:{ftUser:1}});
 assert.ok(proxy.t.transferSuggestions(1).some(s=>s.out.id===2&&s.incoming.id===11&&s.remaining===0),'market proxy allows a 0.0 bank swap');
 const actual=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:0,event_transfers:0}),ext:{ftUser:1,salePrices:{2:4.7,3:4.7}}});
 assert.equal(actual.t.transferSuggestions(1).filter(s=>s.out.id===2&&s.incoming.id===11).length,0,'actual sale 4.7 + bank 0.0 cannot buy 5.0');
 assert.equal(hasPairCard(actual.t.transferPanels()),false,'no pair when both exits sell below the buy price');
 const rounded=make({players:basePlayers(),picks:squadPicks([1,2,3]),ext:{transferBank:3.0000000000000004}});
 assert.equal(rounded.t.transferBankInfo().tenths,3);
});

test('bank missing, null, NaN, negative or invalid is never treated as zero or as affordable',()=>{
 for(const raw of [null,undefined,NaN,-5,'abc',Infinity,'']){
  const m=make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:raw,event_transfers:0}),ext:{ftUser:2}});
  assert.equal(m.t.transferBankInfo().valid,false,String(raw));
  assert.equal(m.t.transferSuggestions(1).length,0,String(raw));
  const html=m.t.transferPanels();
  assert.match(html,/data-bank-status="invalid"/,String(raw));
  assert.doesNotMatch(html,/adv-card|adv-transfer/,String(raw));
 }
 assert.equal(make({players:basePlayers(),picks:squadPicks([1,2,3]),ext:{transferBankInvalid:true}}).t.transferBankInfo().valid,false);
 assert.equal(make({players:basePlayers(),picks:squadPicks([1,2,3]),ext:{transferBank:-10}}).t.transferBankInfo().valid,false);
 assert.equal(make({players:basePlayers(),picks:squadPicks([1,2,3],{bank:0,event_transfers:0})}).t.transferBankInfo().valid,true,'a real zero bank is valid');
});

test('club limit of three and same-position rule for single transfers',()=>{
 const players=[...basePlayers(),player(21,2,4,50,1),player(22,2,4,50,1),player(23,3,4,50,1)];
 const s=make({players,picks:squadPicks([21,22,23,2,3]),ext:{ftUser:1}}).t.transferSuggestions(1);
 assert.equal(s.filter(x=>x.incoming.team===4&&![21,22,23].includes(x.out.id)).length,0,'a fourth player from the same club is never suggested');
 assert.ok(s.filter(x=>x.incoming.team===4&&[21,22,23].includes(x.out.id)).length>0,'swapping inside the club stays legal');
 assert.ok(s.every(x=>x.incoming.element_type===x.out.element_type),'position is preserved');
});

test('pairs: a club overflow is excluded and an affordable pair shows gross, hit and net',()=>{
 // two team 4 players already owned (MID 31, 32); the only candidates are DEF 11 and 12, both team 4
 const blocked=make({players:[player(2,2,2,50,3),player(3,2,3,50,3),player(11,2,4,50,9),player(12,2,4,50,8),player(31,3,4,50,1),player(32,3,4,50,1)],picks:squadPicks([2,3,31,32],{bank:100,event_transfers:0}),ext:{ftUser:2}});
 assert.equal(hasPairCard(blocked.t.transferPanels()),false,'both team 4 candidates together would make four from one club');
 const ok=make({players:[player(2,2,2,50,3),player(3,2,3,50,3),player(11,2,4,50,9),player(13,2,6,50,7)],picks:squadPicks([2,3],{bank:0,event_transfers:0}),ext:{ftUser:1}});
 const out=ok.t.transferPanels();
 assert.ok(hasPairCard(out));
 assert.match(out,/Gross \+10\.00/);
 assert.match(out,/Hit −4/);
 assert.match(out,/Net \+6\.00/);
 assert.match(out,/Bank after \(indicative\)/);
 assert.match(out,/Affordability is indicative/);
 assert.doesNotMatch(out,/After −4/);
 const free=make({players:[player(2,2,2,50,3),player(3,2,3,50,3),player(11,2,4,50,9),player(13,2,6,50,7)],picks:squadPicks([2,3],{bank:0,event_transfers:0}),ext:{ftUser:2}});
 assert.match(free.t.transferPanels(),/Hit 0/);
});

test('single card separates gross, hit and net and keeps the before-hits label',()=>{
 const m=base({ext:{ftUser:1}});
 const html=m.t.transferCard(m.t.transferSuggestions(1)[0]);
 assert.match(html,/GROSS PROJECTED GAIN/);
 assert.match(html,/BEFORE HITS/);
 assert.match(html,/Hit 0/);
 const zero=base({ext:{ftUser:0}});
 assert.match(zero.t.transferCard(zero.t.transferSuggestions(1)[0]),/Hit −4/);
 const unknown=base({ext:{ftPublic:{entryId:1,gw:10,status:'unavailable',value:null}}});
 assert.match(unknown.t.transferCard(unknown.t.transferSuggestions(1)[0]),/FT UNVERIFIED/);
});

test('source has no hard-coded After −4 and no zero fallback for the bank',()=>{
 assert.equal(source.includes('After −4'),false);
 assert.equal(/Math\.max\(0,Number\(ext\.transferBank/.test(source),false);
 assert.equal(/Math\.max\(0,Number\(\$\('suggestionBank'\)/.test(source),false);
});
