import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_RESEARCH_CONTEXT,normalizeResearchContext,serializeResearchContext,parseResearchContext,metricValue,classifyInjuryClaim,fixtureWindow,teamFixtures,averageDifficulty,matchesMine,articleRelevance,sortByRelevance} from '../research-context.mjs';
const boot=JSON.parse(readFileSync(new URL('./browser/fixtures/bootstrap-static.json',import.meta.url),'utf8'));
const byName=n=>boot.elements.find(p=>p.web_name===n);

test('frozen fixture: Haaland and Isak price, xGI/90 and DEFCON/90 as expected',()=>{
 const h=byName('Haaland'),i=byName('Isak');
 assert.equal(h.now_cost/10,15.7);assert.equal(i.now_cost/10,9);
 assert.equal(metricValue(h,'xgi','per90'),0.87);assert.equal(metricValue(i,'xgi','per90'),0.73);
 assert.equal(metricValue(h,'defcon','per90'),3.94);assert.equal(metricValue(i,'defcon','per90'),1.28);
});
test('total vs per90 matches definitions; null or zero minutes never become 0 or NaN',()=>{
 const p={minutes:900,expected_goal_involvements:9,expected_goal_involvements_per_90:'1.00'};
 assert.equal(metricValue(p,'xgi','total'),9);
 assert.equal(metricValue({...p,minutes:0},'xgi','per90'),null);
 assert.equal(metricValue({...p,minutes:null},'xgi','per90'),null);
 assert.equal(metricValue({minutes:90},'xgi','total'),null);
 assert.equal(metricValue({minutes:90,expected_goal_involvements:'abc'},'xgi','total'),null);
 assert.equal(metricValue(p,'unknown','total'),null);
});
test('ResearchContext defaults, normalization and URL round trip; invalid input falls back, never invented',()=>{
 assert.deepEqual(normalizeResearchContext({}),DEFAULT_RESEARCH_CONTEXT);
 assert.equal(serializeResearchContext(DEFAULT_RESEARCH_CONTEXT).toString(),'');
 const ctx=normalizeResearchContext({season:'2026-27',gwFrom:9,gwTo:11,position:3,minMinutes:180,metricMode:'xgi',totalOrPer90:'per90',venue:'home',ownedOnly:true,watchlistOnly:false});
 const qs=serializeResearchContext(ctx);
 assert.deepEqual(parseResearchContext(qs),ctx);
 assert.equal(qs.get('gwFrom'),'9');assert.equal(qs.get('owned'),'1');assert.equal(qs.has('watchlist'),false);
 const bad=normalizeResearchContext({gwFrom:40,gwTo:2,position:9,minMinutes:-5,venue:'moon',totalOrPer90:'x',season:'../x'});
 assert.deepEqual(bad,DEFAULT_RESEARCH_CONTEXT);
 assert.deepEqual(parseResearchContext(new URLSearchParams('gwFrom=abc&position=2&evil=<script>')),{...DEFAULT_RESEARCH_CONTEXT,position:2});
 assert.equal(normalizeResearchContext({gwFrom:12,gwTo:9}).gwFrom,null);
});
test('same keyword in an article is a mention, not a confirmed injury; confirmation needs Official status+news',()=>{
 const p={id:1,web_name:'Silva',team:3,element_type:2,status:'a',news:''};
 const art={headline:'Silva injury concern',injury_flag:true,players:[{element:1,web_name:'Silva',team:3}],source:'Guardian'};
 assert.equal(classifyInjuryClaim(art,p).level,'mention');
 assert.equal(classifyInjuryClaim({...art,headline:'Silva could miss out, reportedly'},p).level,'rumour');
 const confirmed=classifyInjuryClaim(art,{...p,status:'d',news:'Knock - 75% chance'});
 assert.equal(confirmed.level,'confirmed');assert.equal(confirmed.source,'Official FPL status');
 assert.equal(classifyInjuryClaim({...art,injury_flag:false},p).level,'none');
});
test('ambiguous Silva needs matching element id, club and position; wrong player is not attributed',()=>{
 const a={id:1,web_name:'Silva',team:3,element_type:2,status:'d',news:'Knock'},b={id:2,web_name:'Silva',team:9,element_type:3,status:'a',news:''};
 const art={headline:'Silva injury',injury_flag:true,players:[{element:1,web_name:'Silva',team:3}]};
 assert.equal(classifyInjuryClaim(art,a).level,'confirmed');
 assert.equal(classifyInjuryClaim(art,b).level,'none');
 assert.equal(classifyInjuryClaim({headline:'Silva injury',injury_flag:true,players:[{web_name:'Silva'}]},a).level,'none');
});

const fx=(event,h,a,dh=2,da=4)=>({event,team_h:h,team_a:a,team_h_difficulty:dh,team_a_difficulty:da});
test('fixtureWindow: explicit range wins, otherwise horizon from next GW; always clamped to GW1..38',()=>{
 assert.deepEqual(fixtureWindow(DEFAULT_RESEARCH_CONTEXT,9,3),[9,10,11]);
 assert.deepEqual(fixtureWindow({...DEFAULT_RESEARCH_CONTEXT,gwFrom:12,gwTo:14},9,6),[12,13,14]);
 assert.deepEqual(fixtureWindow(DEFAULT_RESEARCH_CONTEXT,37,6),[37,38]);
 assert.deepEqual(fixtureWindow({...DEFAULT_RESEARCH_CONTEXT,gwFrom:36,gwTo:38},9,3),[36,37,38]);
 assert.deepEqual(fixtureWindow(DEFAULT_RESEARCH_CONTEXT,null,3),[]);
});
test('teamFixtures: blank GW is empty, double GW has two, venue filters by home/away',()=>{
 const f=[fx(9,1,2),fx(10,3,1),fx(11,1,4),fx(11,5,1)];
 assert.equal(teamFixtures(f,1,12,'all').length,0);
 assert.equal(teamFixtures(f,1,11,'all').length,2);
 assert.deepEqual(teamFixtures(f,1,11,'home').map(x=>x.home),[true]);
 assert.deepEqual(teamFixtures(f,1,11,'away').map(x=>x.home),[false]);
 assert.equal(teamFixtures(f,1,9,'all')[0].difficulty,2);
 assert.equal(teamFixtures(f,1,10,'all')[0].difficulty,4);
 assert.equal(teamFixtures(f,2,9,'home').length,0);
});
test('averageDifficulty: null (not 0) with no fixtures, ignores non-numeric difficulty',()=>{
 assert.equal(averageDifficulty([]),null);
 assert.equal(averageDifficulty([{difficulty:2},{difficulty:4}]),3);
 assert.equal(averageDifficulty([{difficulty:null},{difficulty:'x'}]),null);
 assert.equal(averageDifficulty([{difficulty:2},{difficulty:null}]),2);
});
test('frozen fixtures file: every team plays at most two matches per GW and venue filters partition them',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./browser/fixtures/fixtures.json',import.meta.url),'utf8'));
 for(const gw of [9,10]){for(const team of new Set(fixtures.flatMap(x=>[x.team_h,x.team_a]))){
  const all=teamFixtures(fixtures,team,gw,'all'),home=teamFixtures(fixtures,team,gw,'home'),away=teamFixtures(fixtures,team,gw,'away');
  assert.ok(all.length<=2);assert.equal(home.length+away.length,all.length);}}
});

const mine={owned:new Set([1,2]),watch:[2,3]};
const ctx=(o={},w={})=>({...DEFAULT_RESEARCH_CONTEXT,ownedOnly:o,watchlistOnly:w});
test('matchesMine: no flag passes everyone; owned, watchlist and both (union) behave as defined',()=>{
 assert.equal(matchesMine(ctx(false,false),9,mine),true);
 assert.equal(matchesMine(ctx(true,false),1,mine),true);
 assert.equal(matchesMine(ctx(true,false),3,mine),false);
 assert.equal(matchesMine(ctx(false,true),3,mine),true);
 assert.equal(matchesMine(ctx(false,true),1,mine),false);
 assert.equal(matchesMine(ctx(true,true),1,mine),true);
 assert.equal(matchesMine(ctx(true,true),3,mine),true);
 assert.equal(matchesMine(ctx(true,true),9,mine),false);
 assert.equal(matchesMine(ctx(true,true),null,mine),false);
 assert.equal(matchesMine(ctx(true,true),1,{}),false);
});
test('articleRelevance: squad beats watchlist beats none; only exact player ids count',()=>{
 const a=ids=>({players:ids.map(element=>({element,web_name:'x'}))});
 assert.equal(articleRelevance(a([9,1]),mine),'squad');
 assert.equal(articleRelevance(a([3]),mine),'watchlist');
 assert.equal(articleRelevance(a([2]),mine),'squad');
 assert.equal(articleRelevance(a([9]),mine),'none');
 assert.equal(articleRelevance({players:[{web_name:'Silva'}]},mine),'none');
 assert.equal(articleRelevance({},mine),'none');
});
test('sortByRelevance is stable: squad, then watchlist, then the rest; original order kept inside a group',()=>{
 const art=(id,el)=>({id,players:[{element:el}]});
 const list=[art('n1',9),art('w1',3),art('s1',1),art('n2',8),art('s2',2),art('w2',3)];
 assert.deepEqual(sortByRelevance(list,mine).map(x=>x.id),['s1','s2','w1','w2','n1','n2']);
 assert.deepEqual(list.map(x=>x.id),['n1','w1','s1','n2','s2','w2']);
});
