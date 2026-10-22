# Acceptance recovery — 22 October 2026

Baseline: bd665673e824f979699f95b8e2dd8200704a5271. No Monte Carlo, Neon, private manager inputs, scheduler changes or direct merge.

## Production incident
The production domain was on d3382a3db1058b2380cdc4b244b18c3845bb68ad. Valid entry 3462711 returned HTTP 400 at horizons 1, 3 and 5; Official entry and GW7 picks returned HTTP 200. The baseline fix existed in merged PR #70, but its production deployment check failed with build-rate-limit. A later ready preview d17636d2378f6b602ec298d7298699e915885745 differed from baseline only by a documentation comment. After explicit user approval, it was promoted with the existing Vercel credentials. Deployment dpl_EW979ouBWVf9jp53x2xhaF5yyDAr serves production. Rechecks returned HTTP 200 with all A/B/C scenarios. This is incident recovery, not production verification of this PR.

Production requests for horizon 3/5 currently return Official one-GW fallback. They are NOT verified 3/5-GW projections. V6 was VERIFIED in PROVENANCE_ONLY mode, not a V6 factual analytics payload. The new response makes requested/effective horizon explicit.

## Deterministic V12 reuse
`vendor/v12/provenance.json` pins iphoenk/FPL-iphoenk-engine at 22655d57f17660006059612af23bd94cf79dde41 and SHA-256 of original Git blob bytes. The exact public 2026/27 rules JSON is reused. Both planners now share `canonicalSquadCheck`, a JavaScript adapter of `src/engines/v12_package_search.py::legal_squad`; lineup enumeration consumes the canonical legal formations. The isolated Python oracle preserves the original normalization helpers and legal_squad function for cross-language parity on 155 normalized public squad cases.

Coverage is squad size, unique players, position composition, maximum players per club and allowed lineup formations. This does NOT reuse canonical scoring, utility, pStart, player distributions, private economics, complete package search or the full V12 optimizer. Search remains bounded and noncanonical. Missing public inputs remain unavailable; FT/hits/net are never inferred. Malformed public identifiers are rejected more strictly by the adapter before the normalized parity domain.

There is no established governance blocker against reusing these pure functions or public rules. `config/intelligence/v12_package_search.json` explicitly separates search from decision utility and forbids Monte Carlo. `config/security/v12_delivery_classification.json` classifies owner-specific bank/free transfers/sale prices as PRIVATE_PERSONAL and owner decisions (XI/bench/C/VC/routes) as PRIVATE_DECISION. Consequently no owner reports, personal cache or private routes are copied. Safe alternative: apply public rules to each user's published Official squad and keep the entire canonical optimizer label false.

V6 factual expansion is deferred: the current integration validates only evidence/latest_index.json and health/publish_integrity.json. Those are provenance, not an identity/GW-bound public player analytics contract. The existing global challenger is already shared/cached, but a stale or mismatched publication fails closed. No extra Official fan-out or replacement scheduler is introduced to fabricate coverage.

## League acceptance
Live league 9477 had 58 distinct members across two pages. Entry 3462711 was rank 6 with 477 points; leader had 517, gap 40. Public GW7 squad: 15 unique players, four bench, one C and one VC. Production browser at 393px verified ten-team navigation from 1–10 to 11–20, preserved own rank/gap, and sticky header/footer. Regression tests cover ranks 1/6/10/11/274, partial page failure, full-league denominator and missing/duplicate picks. Touch gesture acceptance and real iPhone Safari remain separate from viewport checks.

## Recommendation panel
Captain Watch now explicitly shows captain and vice from published starters and the same validated model ranking. Unconnected users receive no personal armband recommendation. The global top-three panel is labelled Top xP GW Berikutnya, with source, creation time, age and a statement that it is not a personal transfer recommendation. Refresh does not recompute the model. FPLens snapshot.yml schedules daily 06:30 UTC (13:30 WIB), plus manual dispatch; this is not a successful-publication guarantee. The observed config_d snapshot was created 21 October 2026 at 19:11 WIB. Its starter ranking was Haaland 5.23, Palmer 4.34. The public Official ep_next fallback gave different C/VC; those are different sources and must not be presented as consensus.

## Evidence levels
- CODE PASS: 149 JavaScript tests, 15 Python tests, Vercel static build, browser syntax check and executable Worker build passed locally before PR creation. CI to be recorded after push.
- SYNTHETIC PASS: mocked 20-ID IO/compute limits, singleflight, cache, backpressure, 155 canonical normalized-squad parity cases and partial-source regressions. Not a live-host claim.
- STAGING: first live probe against d17636d had 1/1 and 5/5 successes; 10/20-user runs suffered client/CLI failures without HTTP responses. Those runs are inconclusive, not STAGING PASS. Observed successful-request p50/p95 (ms): 1 user 831/831; 5 users 574/848; 10 users 197/1284 (6 received); 20 users 619/1353 (11 received). CPU and cache hit metrics were absent; health snapshots switched instances. Per-instance totals cannot be subtracted as deployment-wide Official request counts. This PR adds instance IDs, Official request count, resource/decision cache counters and process CPU time since service creation; process CPU includes other work in that process and is not CPU utilization or per-request CPU. No global limit/SLA is claimed.
- PRODUCTION VERIFIED: recovery of the valid-ID API, public identity/picks and selected-league data on d17636d only. New PR code, true 3/5-GW live output, real iPhone Safari, touch swipe and reliable 10/20-user load metrics remain unverified.

Overall acceptance is NOT GREEN. Keep this PR unmerged until remaining acceptance evidence is reviewed.

## Corrected live staging run
A second run used one authenticated native curl --parallel process per phase, avoiding concurrent CLI authentication failures. At staging d17636d, distinct public league entries returned the correct IDs with HTTP 200 and ready/partial status in all 1/5/10/20-user phases. p50/p95 in ms: 1 = 973/973; 5 = 515/1123; 10 = 545/1194; 20 = 526/1214. Errors: 0/36 requests. This verifies a small live HTTP concurrency smoke test, not sustained capacity or uncached/cold scaling. Cache/CDN could satisfy requests. Official request totals, queue under peak load, CPU and cache hit ratio remain unavailable on that SHA; health remained idle when sampled and cannot prove peak activity or deployment-wide counters. Full STAGING PASS remains pending instrumentation-based verification on the PR deployment.

The executable Worker acceptance also caught loss of page_standings on canonical no-trailing-slash paths. Both Worker and Vercel now preserve the same validated page selection and cache key; the regression executes the built Worker and inspects the actual Official URL.
