import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildNewsContext,selectPersonalNews,newsCategories,articleMentionsPlayer,deadlineBrief} from '../dashboard-signals.mjs';
const now=Date.parse('2026-10-19T12:00:00Z');
const teams={1:{short_name:'CHE'},2:{short_name:'MUN'}};
const make=(id,name,extra={})=>({id,web_name:name,first_name:name,team:1,status:'a',transfers_in_event:0,event_points:0,...extra});
function article(name,date='2026-10-18',extra={}){return {headline:name+' team update',date,url:'https://example.test/'+name,players:[{element:1,web_name:name,team_name:'CHE'}],...extra};}
test('For You includes performance trending Neto even outside the top transfer buyers and legal transfer targets',()=>{
 const players=[...Array.from({length:22},(_,i)=>make(i+1,'Buyer'+i,{transfers_in_event:1000-i})),make(156,'Neto',{event_points:15}),make(30,'Target')];
 const context=buildNewsContext(players,[1],[2],[{out:{id:1,web_name:'Buyer0'},incoming:players.at(-1),gain:3}]);
 assert.ok(context.trending.has(156));assert.ok(context.candidates.has(30));assert.equal(context.candidates.get(30).outId,1);assert.deepEqual(newsCategories(1,context),['Squad','Trending']);
 const selected=selectPersonalNews({players,teams,context,now,articles:[article('Neto','2026-10-17',{players:[{element:156,web_name:'Neto',team_name:'CHE'}]})]});
 assert.equal(selected.length,1);assert.ok(selected[0].categories.includes('Trending'));
});
test('feed is newest first across categories, deduplicates, includes all recent relevant stories and excludes stale stories',()=>{
 const players=[make(1,'Own'),make(2,'Watch')],context=buildNewsContext(players,[1],[2]);
 const articles=[article('Own','2026-10-17'),article('Watch','2026-10-19',{players:[{element:2,web_name:'Watch',team_name:'CHE'}]}),article('Own','2026-10-01')];
 for(let i=0;i<12;i++)articles.push(article('Own','2026-10-18',{headline:'Own story '+i}));
 articles.push({...articles[1],url:'https://example.test/duplicate'});
 const items=selectPersonalNews({players,teams,context,now,articles});assert.equal(items.length,14);assert.equal(items[0].players[0].id,2);assert.equal(items.at(-1).article.date,'2026-10-17');
 assert.equal(selectPersonalNews({players,teams,context,now,articles,filter:'Watchlist'}).length,1);
});
test('broad source lineup tags do not turn unrelated stories into squad news; surnames disambiguate',()=>{
 const own=make(1,'Rogers'),neto=make(2,'Neto'),players=[own,neto],context=buildNewsContext(players,[1],[]);
 assert.equal(selectPersonalNews({players,teams,context,now,articles:[article('Neto','2026-10-18',{players:[{element:1,web_name:'Rogers',team_name:'CHE'},{element:2,web_name:'Neto',team_name:'CHE'}]})]}).length,0);
 const a=make(3,'Martinez',{first_name:'Lisandro',team:2}),b=make(4,'Martínez',{first_name:'Emiliano'});
 assert.equal(articleMentionsPlayer({headline:'Neto double',snippet:'Emiliano Martínez received treatment'},a,[a,b]),false);
 assert.equal(articleMentionsPlayer({headline:'Neto double',snippet:'Emiliano Martínez received treatment'},b,[a,b]),true);
});
test('active squad fitness alerts remain visible with an ongoing label; old resolved updates are excluded',()=>{
 const players=[make(1,'Own',{status:'d',news:'Injury',news_added:'2026-09-01'}),make(2,'Fit',{news:'Old update',news_added:'2026-09-01'})],context=buildNewsContext(players,[1,2],[]);
 const items=selectPersonalNews({players,teams,context,articles:[],now});assert.equal(items.length,1);assert.equal(items[0].urgent,true);assert.equal(items[0].ongoing,true);
});
test('same player ID with mismatched name or club is not attributed; deadline is based on official timestamp',()=>{
 const players=[make(1,'Own')],context=buildNewsContext(players,[1],[]);
 assert.equal(selectPersonalNews({players,teams,context,now,articles:[article('Own','2026-10-18',{players:[{element:1,web_name:'Own',team_name:'MUN'}]})]}).length,0);
 assert.equal(deadlineBrief({deadline_time:'2026-10-20T12:00:00Z'},now).short,'1 hari 0 jam');assert.equal(deadlineBrief({},now),null);
});
test('fresh recovery news ranks above older active injuries and ambiguous names must be adjacent',()=>{
 const players=[make(1,'Own',{status:'d',news:'Old injury',news_added:'2026-10-13'})],context=buildNewsContext(players,[1],[]);
 const items=selectPersonalNews({players,teams,context,now,articles:[article('Own','2026-10-19')]});assert.equal(items[0].kind,'article');assert.equal(items[1].urgent,true);
 const pedro=make(3,'Neto',{first_name:'Pedro'}),norberto=make(4,'Neto',{first_name:'Norberto'}),story={headline:'Pedro Neto scores as Norberto watches from the bench'};
 assert.equal(articleMentionsPlayer(story,norberto,[pedro,norberto]),false);assert.equal(articleMentionsPlayer(story,pedro,[pedro,norberto]),true);
});
test('within the same publication date, a recent standout gets visibility without outranking newer news',()=>{
 const players=[make(1,'Own'),make(156,'Neto',{event_points:15})],context=buildNewsContext(players,[1],[]);
 const items=selectPersonalNews({players,teams,context,now,articles:[article('Own','2026-10-17'),article('Neto','2026-10-17',{players:[{element:156,web_name:'Neto',team_name:'CHE'}]}),article('Own','2026-10-18',{headline:'Own latest update'})]});
 assert.equal(items[0].article.headline,'Own latest update');assert.equal(items[1].players[0].id,156);
});
