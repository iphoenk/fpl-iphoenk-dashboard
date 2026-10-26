import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_RESEARCH_CONTEXT,normalizeResearchContext,serializeResearchContext,parseResearchContext,metricValue,classifyInjuryClaim} from '../research-context.mjs';
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
