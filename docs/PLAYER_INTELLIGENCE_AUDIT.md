# Player Intelligence Integration — PR-A Audit

Scope: audit + spec + test fixtures only. **No production code path changed.**
No live recommendation, ranking, or A/B/C output is affected by this PR.
This is the gated first stage ("Mengubah rekomendasi live? Tidak") of the
staged Player Intelligence Integration Plan.

## 1. Decision made this stage: YouTube excluded

Per explicit user direction (2026-10-22), **video/YouTube evidence collection
is out of scope**, now and for any later PR in this plan, unless re-opened
by the user.

Audit finding that justifies this: the plan's own document implies a
"controlled YouTube transcript ingest path" is close to existing
infrastructure. It is not. `server.mjs` currently has a feed entry
(`PUBLIC_NEWS_FEEDS`, `id:'video'`) that is **not** a transcript source — it
is a Google News site-search (`site:youtube.com ...`) that returns article
*headlines mentioning* a YouTube upload, never the video's spoken content.
Getting actual transcripts would require either the YouTube Data API
(requires a Google Cloud API key — not provisioned here) or downloading and
transcribing audio (heavy, fragile, likely ToS-risk for scraping). Dropping
this removes the single largest unscoped risk in the original plan.

## 2. What already exists (confirmed by reading the code, not the plan's claims)

| Claim in plan | Status | Evidence |
|---|---|---|
| `PUBLIC_NEWS_FEEDS` export exists | Confirmed | `server.mjs:63-69` |
| `/api/news`-equivalent processing exists | Confirmed | `server.mjs:96` `publicNewsHeadlines()` |
| Feed parsing is host-allowlisted (no arbitrary proxy) | Confirmed | `server.mjs:84-86` checks `feed.type` against fixed host lists |
| Social/X coverage exists | Confirmed, same caveat as video | `id:'social'` is also a Google News site-search (`site:x.com ...`), not the X API — it surfaces *articles about* X posts, not raw post text. In scope for PR-B since it reuses the existing feed/parse pipeline as-is, with no new ingest surface. |
| A claim→player attribution layer is net-new work | **Partially false** — a simpler version already exists | `dashboard-signals.mjs` already has `attachMentionedPlayers()` (name-matches an article to FPL players by `web_name`/team), `buildNewsContext()` (own/watch/candidate/trending buckets), and `selectPersonalNews()` (per-user filtering). `parsePublicNewsFeed()` already tags every article's `verification` level by feed type: `'official'` for `official`/`club` feeds, `'reporting'` for `media`/`europe` feeds, and `'community'` for `video`/`social`/`forum` feeds (`server.mjs:89`) — i.e. the "don't blur official vs. reporting vs. unverified social chatter" three-tier distinction the plan asks for is already enforced today, and X/social claims already land at the lowest trust tier by default. |
| Existing test precedent for feed-processing logic | Confirmed | `tests/europe-news.test.mjs` mocks RSS XML strings and a `fetcher`, no live network needed — this is the pattern PR-B should reuse. |

**Implication:** PR-B's job is narrower than the plan implies. It is not
"build attribution from scratch" — it is: (a) extend `attachMentionedPlayers`
to produce a *claim* object (not just an attached article) with a stable
shape, and (b) add the injury/availability-specific classification
(claim type, confidence, source type) on top of what already exists.

## 3. Open question the plan does not answer: claim-ledger storage

The plan references a "claim ledger" without specifying where it is
durably stored. This codebase has **no database** — `pipeline/benchmark.py`'s
forward ledger (`public/data/ledger/gwN.json`, see `write_ledger()`) is the
only precedent for "append-only JSON file checked into the repo's `public/`
output directory, one file per gameweek, frozen at deadline." If the claim
ledger follows the same pattern (flat JSON per GW, committed as a build
artifact), that is consistent with existing architecture and needs no new
infra. If it needs to be mutable/queryable across gameweeks (e.g. tracking a
claim from "doubtful" to "confirmed out" over several days), the flat-file
pattern does not fit and this needs a real decision before PR-B starts
writing code. **This PR does not resolve it — it flags it as a blocking
decision for PR-B, not something to improvise mid-implementation.**

## 4. Concurrency risk (confirmed, not hypothetical)

As of this audit, PR #90 ("Classify advisory failures before retry/cache
changes") is open against `multiuser-decision-server.mjs` — one of the three
files the later integration stages (PR-F/G) would need to touch. This is the
fourth time in one day multiple concurrent agents have touched the same
decision-engine files (see PR #79/#85 conflict during the Transfer Radar
fix, same day). **Recommendation: PR-B through PR-E (collector → parser →
ledger → shadow scoring) should stay confined to new files under
`intelligence/` and do not need to touch `multiuser-decision*.mjs` at all.**
Only PR-F (gated promotion) touches the decision engine, and only after the
shadow-mode backtest gate passes — by which point this PR's audit should be
re-run to check what else has landed on `main`.

## 5. Scope for PR-B (next stage, not started by this PR)

- News + X/social claim extraction only (no YouTube).
- Reuse `PUBLIC_NEWS_FEEDS` + `parsePublicNewsFeed()` as-is — no new feed
  ingest surface, no new allowlisted hosts.
- Extend, don't replace, `attachMentionedPlayers()`/`buildNewsContext()`.
- New code lives under `intelligence/`, isolated from `multiuser-*.mjs`.
- Ledger storage format: **must be decided before PR-B's first commit** —
  see §3.
