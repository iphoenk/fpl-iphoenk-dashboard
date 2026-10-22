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


## Concurrency and V6 provenance addendum (PR #62, staging only)
The existing \`/api/decision?entry_id=...\` backend is the **one** public multi-user advisory endpoint. PR #62 does not create a competing API. It adds optional read-only V6 health/index metadata from \`runtime-data-v6\` with explicit status \`VERIFIED/STALE/UNVERIFIED/UNAVAILABLE\`; V6 does not supply account-specific decisions and Official FPL remains factual authority.

The service limits concurrent **upstream HTTP requests** to six per serverless instance and independent concurrent CPU advisory tasks to four. Distinct same-key resource requests share a single Promise, Official bootstrap and V6 provenance are cached globally per warm instance, per-entry results are briefly cached, body size is bounded, and extra local requests return 429/503 with Retry-After. These are **per-instance** limits, not globally enforced across Vercel cold instances. The proof is a 20-user mocked concurrency test in CI; real-host load and Official provider quota remain unverified.

No Neon is required at this stage. No MC, private V12 outputs, account login, or paid worker is introduced. The returned A/B/C remains explicitly **non-canonical, Official ep_next based**, with unidentified hits and personal economics kept unresolved. The multi-user V12 canonical producer is not integrated: UI must never relabel this result as V12.


## Multi-GW public deterministic challenger, staging
The existing \`GET /api/decision?entry_id=...&horizon=1|3|5\` reads the shared global model built by \`iphoenk/fpl-dashboard\` from read-only public \`meta.json\` and \`players.json\`. That upstream legacy repo computes 8 GW from Official FPL, V6 factual data and optional independent sources every 3h. It is an **independent projection challenger**, not Canonical V12. Only 1/3/5 GW from the same validated snapshot/GW are used, with a six-hour freshness limit, >=300 Official-ID/team/position cross-validations and required Official source success. It never reads private V12 manager decisions, and never runs MC.
Each A/B/C route optimizes a legal XI/bench/C/VC for every GW in its selected horizon; route search is explicitly bounded, and all gains are **gross** with missing FT/hits labelled unknown. Missing/mismatched snapshot fails closed to the existing Official one-GW advisory. Shared in-process cache and six-upstream/four-compute limits remain. No new database or build schedule has been created.
