// Fixtures for the future claim-parser work (PR-B), scoped to news + X/social
// only (YouTube excluded — see docs/PLAYER_INTELLIGENCE_AUDIT.md §1).
// These are plain RSS-XML strings shaped like what parsePublicNewsFeed()
// already consumes in server.mjs — same pattern as tests/europe-news.test.mjs.
// This file defines no behavior and is not imported by any production code;
// it exists so PR-B can write claim-parser tests on day one without needing
// live network access to news.google.com.

export const rssItem=({title,link='https://example.test/a',pubDate='Tue, 20 Oct 2026 21:30:00 GMT',sourceUrl='https://example.test',sourceName='Example'})=>
 '<item><title>'+title+'</title><link>'+link+'</link><pubDate>'+pubDate+'</pubDate><source url="'+sourceUrl+'">'+sourceName+'</source></item>';

export const rssFeed=items=>'<rss><channel>'+items.join('')+'</channel></rss>';

// A "doubtful" claim: ambiguous fitness language, should classify as
// lower-confidence than a flat "ruled out" statement.
export const DOUBTFUL_INJURY_FIXTURE=rssFeed([rssItem({
 title:'Saka a doubt for Arsenal after picking up knock in training',
 sourceName:'Example Football News',
})]);

// A "confirmed out" claim: explicit, unambiguous.
export const CONFIRMED_OUT_FIXTURE=rssFeed([rssItem({
 title:'Arsenal confirm Saka will miss the next three matches with hamstring injury',
 sourceName:'Example Football News',
})]);

// A claim that should NOT attach to any FPL player (no name match).
export const NO_PLAYER_MATCH_FIXTURE=rssFeed([rssItem({
 title:'Premier League announces new broadcast deal from next season',
 sourceName:'Example Business Desk',
})]);

// A social/X-sourced claim (via the existing site:x.com Google News proxy,
// NOT the X API) — lower default trust than official/club feed types,
// per the existing verification:'reporting' convention in parsePublicNewsFeed.
export const SOCIAL_CLAIM_FIXTURE=rssFeed([rssItem({
 title:'Reports: Saka withdrawn from Arsenal training session, fitness assessed daily',
 sourceUrl:'https://x.com',
 sourceName:'Example Insider (via X)',
})]);

// Two claims about the SAME player that disagree — this is the case the
// claim ledger's provenance tracking exists to handle (keep both, with
// source + timestamp, rather than silently overwriting one with the other).
export const CONFLICTING_CLAIMS_FIXTURE=rssFeed([
 rssItem({title:'Saka expected to start despite minor knock',sourceName:'Example Club Source',pubDate:'Tue, 20 Oct 2026 10:00:00 GMT'}),
 rssItem({title:'Saka ruled out for the weekend, confirms manager',sourceName:'Example Press Conference Wire',pubDate:'Tue, 20 Oct 2026 18:00:00 GMT'}),
]);
