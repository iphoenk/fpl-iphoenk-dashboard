# Architecture

Browser UI is composed from ui.html, ui.js and ordered extensions listed in both build scripts. dashboard-focus.js contains the Overview time toggle, local next-GW captain draft, dashboard brief and personalized news composition. Themes use CSS variables and theme.js.

server.mjs restricts upstream API paths. api/index.js adapts it for Vercel; the alternative Worker build uses the same handler. Never add arbitrary URL forwarding. Official FPL is the canonical source for published squad and football data. Snapshot identity and GW guards prevent mixing seasons and player mappings.

The current dashboard does not call the FPL-iphoenk-engine V6 or V12 interfaces. V6 is a possible future factual freshness/provenance layer. V12 is an optional advisory counterpart; neither should be represented as active until a governed read-only contract, validation and deployment are implemented. Private engine reports and scheduling controls must not become browser data.

Production is deployed to the existing Vercel project, not a new project. GitHub Actions provides independent test/build verification. Secrets are not in this repository.


The canonical repository is https://github.com/iphoenk/fpl-iphoenk-dashboard and the Vercel project is `fpl-iphoenk`, serving https://fpl-iphoenk.vercel.app. Python source is retained in this repository but excluded from the Vercel upload because it is a manual offline batch, not a request runtime. The production runtime remains Node.js; the browser uses JavaScript/CSS/HTML. JSON is the interchange format, not a streaming broker.

`python_xp` validates Official inputs and computes experimental position-aware contributions. Trusted `scripts/publish-own-model.mjs` revalidates current context, writes private `own-model/v1/2026/gwN/0.1.1/latest.json`, and captures the first eligible immutable `forecasts/v1/2026/gwN/fpl-iphoenk-python-v1.json`. The read-only `/api/own-model` route validates freshness, identity, scoring and fixtures, suppressing changed player availability. No model calculation happens on requests. The browser calls it only on explicit opt-in, holds it in memory and drops it at expiry. Worker builds return unavailable for this private-store feature. All other providers remain independent.

The optional comparison response selects at most20 explicit player IDs (or10 highest pool predictions), keeping the full artifact private. Only successful validated responses use a30-second in-process/CDN cache, capped by expiry, with no stale-on-error reuse. The browser remains no-store and checks current identity/availability again. Cold requests still require Official and Blob validation; subsequent edge hits avoid that work.

## Public multi-user advisory (2026-10-21)

`multiuser-decision.mjs` is a **bounded, non-canonical V12-informed public deterministic advisory**, not a clone of V12. `multiuser-decision-server.mjs` reads Official FPL bootstrap, published entry and picks only, validates identity, computes legal XI/bench/C/VC for HOLD, one-transfer and two-transfer shortlisted scenarios with Official `ep_next` for ONE GW only. Hit points, net gain, real free-transfer balance, unpublished picks and Monte Carlo are NEVER inferred. The endpoint is read-only and requires no login; do not expose private V12 outputs. The current V6 architecture has no verified public stable consumer contract into this dashboard and is not claimed as active.

The serverless adapter uses 120s global bootstrap caching, same-ID singleflight, 45s decision cache, 4 active computations per instance with bounded queue, and a 45s public CDN cache. This is best-effort per process rather than a globally distributed lock or guaranteed SLA. There is no Neon requirement for this public-only stage. 20 concurrent virtual users are included in offline tests; real production load remains unverified. All releases remain gated on actual Vercel production deployment verification.


## Public multi-user gateway (staged, not deployed)
The read-only \`GET /api/public-team?entry_id=123&league_id=456\` endpoint accepts **public FPL IDs without login**. \`league_id\` is optional and must belong to the publicly listed classic leagues for that entry. It retrieves Official FPL public bootstrap, profile and last published GW picks, and an optional 10-team rank block/leader from Official classic standings. It never fetches pending transfers, unsubmitted picks, authentication cookies or private personal data. No user identifiers or requests are persisted in the cache beyond process memory; client or CDN caching is short-lived.

V6 integration here is read-only **provenance and health metadata only** from the public \`runtime-data-v6\` factual branch. Its health/index documents are verified and age-labelled; Official FPL retains factual authority. V6 source content is not treated as a substitute for a public FPL account.

The multi-user V12 optimizer is **not yet integrated**. Its status is \`NOT_CONNECTED_MULTI_USER\`, MC is \`DISABLED\`, and \`advice=null\`. Do not turn the old frontend shortlist into a V12 recommendation. The original V12 personal-decision outputs are PRIVATE_DECISION and cannot be exposed to arbitrary FPL IDs. A future actual V12 public-only deterministic producer needs a separate privacy-reviewed output contract and per-entry input fingerprint. Neither decision scores nor timings are invented here.

The gateway bounds each serverless-instance process to 6 concurrent upstream requests, queues at most 120 additional resource fetches, deduplicates in-flight cache keys, caches successful Official snapshots briefly, and returns a 503 \`BUSY_RETRY\` under local overload. This is **not** a global cross-instance semaphore: CDN + shared external rate limit / queue should be assessed under real production load. The synthetic 20-client test validates **in-process** concurrency and fallback; it does not prove Vercel distributed scalability or actual public Official FPL rate limits.

Initial release gate: server + UI acceptance, V6 availability checks, CI concurrency tests, and a controlled real concurrency test with external traffic limits. No Neon, sign-in, server-side MC, or production deployment required for the staged branch.
