# Public deterministic lineup optimizer and formation evidence

Base: main `201cc3160e2fb3ff08a3972eebd8d6cc30a23096`. This focused change carries forward the reviewed canonical-rule/Worker/league acceptance fixes from draft #72 without reverting main's indicative public A/B/C economics or one-GW UI default. Desktop/tablet/smartphone refinement remains in draft #73.

## Implemented contract

- Every final A/B/C roster, in every requested GW, enumerates all 550 legal XI masks and returns the best XI for each of eight legal formations, xP, delta from the winner, bench and C/VC. The objective is sum of starter mean xP plus one extra captain mean xP. Captain multiplier is two; no chip is assumed.
- Transfer candidates still use bounded shortlist search. The fast positional selection used while searching is exact for this additive mean-xP objective; tests compare it against exhaustive enumeration. Full evidence is generated only for final scenarios. No additional Official request is required to open the table.
- Native details controls show per-GW comparisons and named XI/bench/C/VC. Scrolling is contained in the table on phone screens. About describes the active data/model/backend components and their limits.
- Independent bootstrap, identity, provenance and shared-model requests overlap. Only picks depend on the deadline-derived published GW. Network waits no longer occupy compute slots. Existing source singleflight, TTLs and bounded IO/compute queues remain. Server-Timing exposes decision handler duration; this is not end-to-end latency and cached headers can describe the original render.

## Actual V12 reuse

Pinned engine commit: `22655d57f17660006059612af23bd94cf79dde41`.
`vendor/v12/provenance.json` records original Git-blob SHA256 hashes.

- `src/engines/v12_package_search.py::legal_squad`: public adapter, 155 normalized parity cases.
- `config/rules/fpl_2026_27.json`: original canonical squad/formation rules consumed at runtime.
- `src/engines/v12_lineup_optimizer.py::_legal_xi_templates/enumerate_legal_xi`: public adapter with bounded position-template cache, parity against verbatim isolated Python functions across 15 reordered signatures, each producing 550 masks.

This is actual component reuse, not execution of the full canonical distributional optimizer. The public objective is identified separately as `EXACT_PUBLIC_MEAN_XP`; `canonical_v12` remains false.

## Distributional/autosub audit

Read-only public snapshot audit on 22 October 2026: 668 rows have `nx.pplay` and `nx.pstart`; `nx` also has expected minutes and scoring components. No row supplies a point PMF. `xpm` contains per-GW means, while `nx` is a next-GW surface, not a validated probability series for every requested GW.

Canonical `src/engines/v12_lineup_optimizer.py::_point_distribution` requires `point_distribution.probabilities`; its missing-data contract is `PARTIAL_MOMENTS_ONLY` / `P1.3B_EXACT_GW_POINT_PMF_UNAVAILABLE`, with no fabricated tails. `_state_probabilities` expects START, REGULAR_CAMEO, LATE_CAMEO and ZERO_MINUTES (or corresponding xmins fields). Public pplay could support a separately validated next-GW appearance adapter, but does not establish that full distributional contract or future-GW probabilities. No arbitrary risk penalty, synthetic PMF, DNP/cameo split or covariance is introduced.

Governance: `config/security/v12_delivery_classification.json` classifies engine owner bank/FT/selling-price inputs as PRIVATE_PERSONAL and materialized owner XI/bench/C/VC/routes as PRIVATE_DECISION. Reusing pure code and public rules does not require publishing those reports. Safe alternative is this locally computed public-only result, explicitly noncanonical and indicative. Full private-cache, crypto, numpy distributional runtime and owner reports are not imported.

V6 scope remains verified public provenance/source health, not full player factual analytics integration. Global public multi-GW projections are an independent challenger and are not relabeled canonical V12.

## Validation and remaining gates

- CODE PASS: 159 JS tests, 15 Python tests, Vercel build, Worker build and generated-browser syntax pass. Independent reviewer reran 10 targeted tests sequentially with no actionable findings.
- SYNTHETIC PASS: normalized canonical parity and bounded IO/concurrency pass. This does not prove deployed latency.
- STAGING: pending deployment/real cold and warm 1/5/10/20-user measurements.
- PRODUCTION VERIFIED: not claimed for this change. No merge or production promotion performed.
- Maximum one-second latency is NOT yet proven. One local real-source request returned HTTP 200 in 2.236 seconds while Windows reported system paging/allocation failures. Treat that environment as unsuitable for a reliable performance benchmark; do not turn the result into PASS. A complete response, rather than a fast error or empty placeholder, is required for latency acceptance.
- Physical iPhone 17 Pro Max/Samsung S23 Ultra browser acceptance remains unverified. Earlier responsive widths are browser simulation only.

## Live Official FPL and browser acceptance, 22 October (GitHub-hosted)

Run [#39749710444](https://github.com/iphoenk/fpl-iphoenk-dashboard/actions/runs/39749710444), SHA 14889552793c02a0e06b8064ecde27cb5670685b, built the same Worker locally on GitHub's Ubuntu runner. Requests queried live Official FPL data. Twenty-user intake was genuine concurrent GETs from distinct public league 9477 entries, not synthetic mocks. The production Vercel deployment was **not** tested by this measurement.

- 36/36 distinct-ID cold requests and 36/36 subsequent warm requests were valid. 0 JSON-contract, 8-formation, XI/bench, C/VC or delta violations. Horizon 1/3/5 was also checked for entry 3462711.
- p95 cold/warm ms by phase: 1 user 457.9/3.6; 5 users 684.9/6.2; 10 users 780.6/7.2; 20 users 1620.7/10.5. Strict 1000ms cold p95 **FAIL** at 20; warm **PASS**. These values are local Worker+real upstream times, not Vercel deployment latency.
- Browser CI job **PASS**: WebKit simulated 393, 430 and 768 pixel viewports; Chromium 1440. No document overflow or missing eight-formation evidence. Actual physical iPhone Safari remains **UNVERIFIED**. Artifacts include screenshots.
- Vercel branch preview itself responded **401 (deployment protection)** from GitHub Actions. No project security setting was weakened, and no bypass secret was placed in GitHub. Thus real Vercel preview latency and error rates remain **BLOCKED BY AUTH**.
- Default upstream IO limit is raised from 6 to 12 (compute remains 4; bounded waits stay 120) as a performance *candidate*. Require fresh live run, Official request/error audit, and browser acceptance after the change before claiming improved cold p95 or production readiness.

Final gate remains NOT GREEN until live acceptance of the updated cap and protected Vercel preview access with authorized test credentials. The public 1-GW and 3/5-GW responses retain their noncanonical V12/V6 provenance limits.
