import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_NEWS_FEEDS,parsePublicNewsFeed} from '../server.mjs';
import {attachMentionedPlayers} from '../dashboard-signals.mjs';
import {DOUBTFUL_INJURY_FIXTURE,CONFIRMED_OUT_FIXTURE,NO_PLAYER_MATCH_FIXTURE,SOCIAL_CLAIM_FIXTURE,CONFLICTING_CLAIMS_FIXTURE} from './fixtures/player-intelligence/sample-feed-fixtures.mjs';

// PR-A is audit/spec/fixtures only. These tests exercise the EXISTING
// server.mjs/dashboard-signals.mjs pipeline against the new fixtures, to
// verify (not just assert in the audit doc) that the claims made in
// docs/PLAYER_INTELLIGENCE_AUDIT.md are actually true of the current code.
// No new production code is introduced by this file.

const mediaFeed=PUBLIC_NEWS_FEEDS.find(f=>f.id==='media');
const socialFeed=PUBLIC_NEWS_FEEDS.find(f=>f.id==='social');
const players=[{id:1,web_name:'Saka',first_name:'Bukayo',team:2,status:'a',news:''}];
const teams={2:{short_name:'ARS'}};

test('every feed-sourced article is tagged verification:"reporting", never "official", via the media feed', ()=>{
 const [doubtful]=parsePublicNewsFeed(DOUBTFUL_INJURY_FIXTURE,mediaFeed);
 const [confirmed]=parsePublicNewsFeed(CONFIRMED_OUT_FIXTURE,mediaFeed);
 assert.equal(doubtful.verification,'reporting');
 assert.equal(confirmed.verification,'reporting');
 // The existing pipeline does not distinguish "doubtful" language from
 // "confirmed out" language today — both land as the same verification
 // level and source_type. This is exactly the gap PR-B's claim classifier
 // is meant to fill; this test documents that the gap is real, not assumed.
 assert.equal(doubtful.verification,confirmed.verification);
});

test('social/X claims parse through the existing feed pipeline at the lowest trust tier, with no new ingest surface', ()=>{
 const [social]=parsePublicNewsFeed(SOCIAL_CLAIM_FIXTURE,socialFeed);
 assert.equal(social.source_type,'social');
 // Social/X is deliberately lower-trust than the media/europe "reporting"
 // tier used elsewhere in this file — the existing pipeline already enforces
 // this three-tier split (official > reporting > community).
 assert.equal(social.verification,'community');
 assert.match(social.url,/^https:\/\//);
});

test('a non-matching article attaches to no player (no false attribution)', ()=>{
 const [article]=parsePublicNewsFeed(NO_PLAYER_MATCH_FIXTURE,mediaFeed);
 const attached=attachMentionedPlayers([article],players,teams);
 assert.equal(attached.length,0);
});

test('a matching article attaches to the named player via existing attachMentionedPlayers', ()=>{
 const [article]=parsePublicNewsFeed(DOUBTFUL_INJURY_FIXTURE,mediaFeed);
 const attached=attachMentionedPlayers([article],players,teams);
 assert.equal(attached.length,1);
 assert.deepEqual(attached[0].players,[{element:1,web_name:'Saka',team_name:'ARS'}]);
});

test('conflicting same-player claims both survive attachment with distinct timestamps (provenance precondition)', ()=>{
 const articles=parsePublicNewsFeed(CONFLICTING_CLAIMS_FIXTURE,mediaFeed);
 assert.equal(articles.length,2);
 const attached=attachMentionedPlayers(articles,players,teams);
 assert.equal(attached.length,2);
 // Both claims must remain distinguishable (different publish times, via
 // the existing `date` field) so a future claim ledger can order them
 // rather than silently picking one.
 assert.ok(attached.every(a=>a.date));
 assert.notEqual(attached[0].date,attached[1].date);
 assert.notEqual(attached[0].headline,attached[1].headline);
});
