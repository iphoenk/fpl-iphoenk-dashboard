import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_NEWS_FEEDS,parsePublicNewsFeed,publicNewsHeadlines} from '../server.mjs';
import {attachMentionedPlayers,buildNewsContext,selectPersonalNews} from '../dashboard-signals.mjs';
const feed=PUBLIC_NEWS_FEEDS.find(f=>f.id==='europe');
const rss=title=>'<rss><channel><item><title>'+title+'</title><link>https://example.test/a</link><pubDate>Tue, 20 Oct 2026 21:30:00 GMT</pubDate><source url="https://example.test">Example</source></item></channel></rss>';
test('Europe feed is a fixed Google News URL limited to two days and lineup terms',()=>{
 assert.ok(feed);assert.equal(feed.type,'europe');
 const url=new URL(feed.url);assert.equal(url.hostname,'news.google.com');
 const q=url.searchParams.get('q');assert.match(q,/when:2d/);assert.match(q,/Champions League/);assert.match(q,/bench/);
});
test('Europe articles are parsed as reporting, not official',()=>{
 const [a]=parsePublicNewsFeed(rss('Haaland benched for Champions League tie'),feed);
 assert.equal(a.source_type,'europe');assert.equal(a.verification,'reporting');assert.match(a.url,/^https:\/\//);
});
test('Europe news is attached only to FPL players it names and reaches the personal feed',()=>{
 const players=[{id:1,web_name:'Haaland',first_name:'Erling',team:1,status:'a',news:''},{id:2,web_name:'Saka',first_name:'Bukayo',team:2,status:'a',news:''}];
 const teams={1:{short_name:'MCI'},2:{short_name:'ARS'}};
 const [a]=parsePublicNewsFeed(rss('Haaland benched for Champions League tie'),feed);
 const attached=attachMentionedPlayers([a,{...a,headline:'Real Madrid rotate for Champions League'}],players,teams);
 assert.equal(attached.length,1);assert.deepEqual(attached[0].players,[{element:1,web_name:'Haaland',team_name:'MCI'}]);
 const context=buildNewsContext(players,[1],[]);
 const items=selectPersonalNews({players,teams,articles:attached,context,now:Date.parse('2026-10-21T05:00:00Z')});
 assert.equal(items.length,1);assert.equal(items[0].article.source_type,'europe');
});
test('Europe feed failure does not break the other public feeds',async()=>{
 const fetcher=async url=>String(url).includes('Champions')?{ok:false,status:503}:{ok:true,text:async()=>rss('Arsenal team news')};
 const result=await publicNewsHeadlines(fetcher,Date.now());
 assert.ok(result.sources.find(s=>s.id==='europe').status!=='ok');
 assert.ok(result.articles.length>0);
});
