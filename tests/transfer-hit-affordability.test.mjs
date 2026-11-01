import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

/* GAP-01: transfer hit, free-transfer provenance, sale price and bank in advanced-planning.js. */
const source=readFileSync(new URL('../advanced-planning.js',import.meta.url),'utf8');
const pick=name=>{const i=source.indexOf('function '+name+'(');assert.ok(i>=0,name);let d=0;const j=source.indexOf('}){',i)>=0&&source.indexOf('}){',i)<source.indexOf('\n',i)?source.indexOf('}){',i)+2:source.indexOf('){',i)+1;for(let k=j;k<source.length;k++){if(source[k]==='{')d++;if(source[k]==='}'&&--d===0)return source.slice(i,k+1);}};
const NAMES=['ftParse','transferFtContext','transferHitContext','transferHit','transferNetSummary','transferBankInfo','transferSellingPrice','transferAffordabilityLabel','loadTransferFt','currentSquad','transferSuggestions','transferCard','transferPanels'];
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
 vm.runInContext(code+'\nglobalThis.t={ftParse,transferFtContext,transferHit,transferNetSummary,transferBankInfo,transferSellingPrice,transferAffordabilityLabel,loadTransferFt,transferSuggestions,transferCard,transferPanels};',sandbox);
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

test('loadTransferFt reads the public decision, validates GW and never invents a value',async()=>{
 const calls=[];
 const ok=base({ext:{ftPublic:undefined},api:async path=>{calls.push(path);return {status:'ready',team_state:{planning_gameweek:10,free_transfers:2}};}});
 await ok.t.loadTransferFt();
 assert.deepEqual(calls,['decision?entry_id=1&horizon=1']);
 assert.equal(ok.t.transferFtContext().value,2);
 await ok.t.loadTransferFt();
 assert.equal(calls.length,1,'one request per entry and GW');
 for(const reply of [{status:'unavailable',team_state:{planning_gameweek:10,free_transfers:2}},{status:'ready',team_state:{planning_gameweek:11,free_transfers:2}},{status:'ready',team_state:{planning_gameweek:10,free_transfers:null}},{status:'ready'},null]){
  const m=base({ext:{ftPublic:undefined},api:async()=>reply});await m.t.loadTransferFt();
  assert.equal(m.t.transferFtContext().status,'unknown',JSON.stringify(reply));
 }
 const failing=base({ext:{ftPublic:undefined},api:async()=>{throw new Error('429');}});await failing.t.loadTransferFt();
 assert.equal(failing.t.transferFtContext().status,'unknown');
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
