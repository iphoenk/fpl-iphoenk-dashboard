# BARATAYUDA_HANDOFF — iphoenk/fpl-iphoenk-dashboard

Status (updated 2026-11-01): P0 reconciled, P1/P2 implemented and awaiting Yudistira/Kresna sign-off; Vercel Preview visual verification NOT VERIFIED. No merge, no production deploy, no scheduler change, no private-data-boundary change has been made.

Baseline production SHA: `02857b6176ea8c91c8e3b20661174a5377083d5e` (main HEAD, merged PR #234, "D10: 44px minimum touch targets on phones, lower ratchet baselines"). Confirmed current — PR #239 below branches from this exact SHA.

## P0 — Consolidation status: RECONCILED (2026-11-01)

The earlier version of this section reported P0 as BLOCKED because the five Phase 0 documents (AUDIT_BASELINE, SYSTEM_INVENTORY, API_DATA_LINEAGE, GAP_ANALYSIS, REGRESSION_BASELINE) were not reachable from the first session. They were produced in the second session's workspace, not committed to any repository. The coordinating session has since reconciled them against this file:

| Topic | This file | Phase 0 documents | Result |
|---|---|---|---|
| OUR15 join | KEEP | KEEP | Agree |
| Historical stats (14 metrics) | matrix below | consistent | Agree |
| V6 provenance | IMPROVE | IMPROVE (V6 VERIFIED is not V12 READY_FULL) | Agree; wording refined in #239 head 155bbdc |
| V12 publication | DEFER, adapter KEEP | DEFER; adds risk N5 (frontend rejects the canonical contract) | Extended, see "Release constraint N5" |
| Rate limiting | best-effort, per isolate | IMPROVE; found HEAD bypass and unbounded memory (fixed in #237 commit f6cd844) | Extended, see "Rate limiting review" |
| Baseline regression on 02857b6 | not run end to end | 351/351 Node, 15/15 Python, 139/139 Playwright | Phase 0 supplies the baseline |

The Phase 0 documents remain outside the repository. Their conclusions are carried by this file and by docs/N5_V12_CONTRACT_COMPATIBILITY.md (PR #242).

## Evidence-based findings (this session, independently verified against live code and live FPL data — not carried over from any other session)

| # | Area | Verdict | Evidence |
|---|------|---------|----------|
| 1 | OUR15 join (`/api/decision` × `/api/bootstrap-static`) | KEEP | Join already happens 100% client-side via one-line helpers (`decision-first.js:191` etc.), keyed on official `element` id. No inconsistency found, no new endpoint needed. |
| 2 | Historical stats coverage (14 metrics) | See matrix below | Verified live against Official FPL API + source code across `fpl-iphoenk-dashboard`, `fpl-dashboard`, `FPL-iphoenk-engine`. |
| 3 | V6 provenance (`source.v6.status`) | IMPROVE (now implemented) | Upstream integrity check is genuinely rigorous (669/669 players, 20/20 teams, 380/380 fixtures cross-validated, 13 sources, 420 files checked — `evidence/latest_index.json` + `health/publish_integrity.json` on `runtime-data-v6`). Dashboard's `provenance()` (`multiuser-decision-server.mjs:59-78`) reads this correctly, but the resulting status was computed on every response and never shown in the UI. Fixed in PR #239 (see below). Contract unchanged. |
| 4 | V12 publication path | DEFER (adapter: KEEP) | Current state is exactly category (a): endpoint not configured at all (`FPL_V12_CANONICAL_URL` unset → `fetchCanonicalDecision` returns `NOT_CONFIGURED`, `v12-canonical-adapter.mjs:34`). Never reaches (b) computed-but-not-servable or (c) published-but-fails-gate, because no live V12 HTTP endpoint exists in any of the 6 repos. Adapter's contract validation (`validateCanonicalDecision`) is already correct and strict — kept as-is. V6 VERIFIED must not be read as V12 readiness; they are unrelated checks (enforced explicitly in the new UI tooltip, see PR #239). |
| 5 | Rate limiting | Reviewed, not merged | See "Rate limiting review" below. |

### Historical stats coverage matrix (14 metrics)

| Metric | Category | Evidence | Note |
|---|---|---|---|
| BPS | Available directly | `bootstrap-static.elements[].bps`; `element-summary/{id}/.history[].bps`, confirmed live | Native field. |
| Bonus | Available directly | `bootstrap-static.elements[].bonus`; per-GW `history[].bonus`, confirmed live | Native field. |
| Dream Team (current) | Available directly | `bootstrap-static.elements[].in_dreamteam`, `.dreamteam_count` | Native field, current status only. |
| Dream Team (per-GW history) | Needs derivation | `element-summary/{id}/.history` has no `in_dreamteam`; `event/{gw}/live/` does, per-GW; V6 branch publishes `event_live_gwN` caches but the dashboard does not consume them | Gap: requires wiring, not yet built. DEFER per Kresna. |
| DefCon | Available directly | `bootstrap-static.elements[].defensive_contribution(_per_90)` — native 2025/26+ field, confirmed live, not dashboard-derived | `domain.mjs` `defcon90` reads it directly. |
| Minutes | Available directly | `bootstrap-static`/`history[].minutes` | Native field. |
| Starts | Available directly | `bootstrap-static.elements[].starts`, `.starts_per_90` (native, not derived) | Native field. |
| xG | Available directly | `bootstrap-static.expected_goals`, `.expected_goals_per_90` | Native field. |
| xA | Available directly | `bootstrap-static.expected_assists`, `.expected_assists_per_90` | Native field. |
| xGI | Available directly | `bootstrap-static.expected_goal_involvements_per_90` | Native field. |
| PPM / value | Was: not available. Now: available directly (PR #239) | `bootstrap-static.value_season`/`value_form` native; arithmetic relation verified on the frozen Official snapshot (669/669 players, tolerance 0.051): `value_season = total_points/(now_cost/10)`, `value_form = form/(now_cost/10)`. A later upstream redefinition would not be detected by this check. | Exposed in the Value scatter as "Value (season)" / "Value (form)". The dashboard does not call it PPM. |
| Expected points (model) | From engine (3 layers) | Own model (`own-model-server.mjs`), V12 canonical (if configured), FPLens/GLOBAL challenger (`fpl-dashboard/pipeline/model/xp.py`) | Own model is primary today; priority order documented in `fpl-dashboard/README.md`. |
| Starter probability | From engine | `xp.py` computes `pstart`/`pplay` from start history + status + predicted lineups — belongs to the GLOBAL challenger engine, not a dashboard concern | KEEP as-is; migrating it into the dashboard itself is explicitly DEFERRED per Kresna, no proven need. |
| Coach fit | Not available | `FPL-iphoenk-engine/.../v12_gw1_gw6_history_context.py:126-127`: engine itself returns `status:"UNAVAILABLE", reason:"NO_CAUSAL_COACH_FIT_CALIBRATION"`; `own-model-ui.js:23` explicitly states it produces no such score | Not a dashboard gap — the source engine declines to produce this value. DEFER per Kresna; building it in the dashboard would mean inventing a number with no causal calibration behind it. |
| Formation fit | Not available | Same file, `"status":"UNAVAILABLE","reason":"MATCH_LEVEL_ROLE_AND_COACH_EVIDENCE_REQUIRED"` | Same as above. DEFER per Kresna. |

## V6 status visibility — implemented (P1)

- Branch: `feat/v6-status-and-value-metrics`
- PR: https://github.com/iphoenk/fpl-iphoenk-dashboard/pull/239 (open, not merged)
- Change (updated at #239 head 155bbdc): `decision-first.js` renders a V6 chip in the Next GW Plan footer from `report.source.v6.status` (no API change). Five states, each with its own glyph and border style (not colour alone): Verified, Stale, Unverified, Unavailable, and an explicit Not reported when `source.v6` is missing or unknown. `observed_at` is shown only when present and valid; no substitute timestamp is created. The tooltip states V6 is independent of V12 readiness.
- No API contract change. No change to `provenance()` logic in `multiuser-decision-server.mjs`.

## Player value metrics — implemented (P2)

- Same branch/PR as above.
- Change: `domain.mjs` `valueMetricOptions()` gained two entries, `valueSeason` and `valueForm`, reading `bootstrap-static`'s native `value_season`/`value_form` fields directly. No new endpoint, no recomputation duplicating what FPL already publishes.
- Labelled "Value (season)" / "Value (form)". The notes cite FPL's own field names and make no claim of equivalence with community PPM definitions, and no claim about the form window length (not verified from official text).

## Rate limiting review (P1, PR #237)

PR #237 ("Audit #3: per-IP rate limiting on /api/decision and /api/own-model") was re-verified against current main, not re-implemented as a competing solution:

- `gh api .../pulls/237`: `merged:false`, `mergeable:true`, `mergeable_state:"clean"`, base SHA `02857b6176ea8c91c8e3b20661174a5377083d5e` — exactly current main HEAD. Not stale, not behind.
- #237 was tested at its original head 96aab6f: 357/357 (main's 351 + 6). The head is now f6cd844, which adds a separate hardening commit (HEAD requests no longer bypass the limiter, IPv6 /64 and IPv4-mapped normalisation, bounded memory with eviction, 9 tests). That commit was not part of the original review and awaits Kresna's decision (keep or revert to 96aab6f). At f3ba610 (audit tests added) the full Node suite is 374/374.
- Design: `checkRateLimit(name, request)` keys on `endpoint-name + client-IP` only (`rate-limit.mjs:14`) — confirmed by reading the source that query parameters are not part of the key, so varying `entry_id`/`horizon` from the same IP shares one bucket (answers Kresna's "parameter berbeda" scenario).
- Default limit matches Kresna's requested test scenario exactly: 20 requests / 60-second window (`rate-limit.mjs` default `limit=20, windowMs=60000`).
- Multiuser: confirmed by existing test ("tracks distinct IPs... independently") — a second IP is unaffected by the first IP's usage.
- 429/Retry-After: confirmed by existing test — `rateLimitResponse` returns status 429, `Retry-After` header, `Cache-Control: no-store`.
- Cache interaction (corrected): the limiter runs in `api/index.js` before the decision, own-model and provider handlers, so every request that reaches the function is counted, including result-cache hits inside it. Requests served by the Vercel CDN do not invoke the function and are not counted. `/api/decision` successes carry `s-maxage=45` per URL (entry_id+horizon), so repeat requests for one team are mostly CDN hits. `/api/own-model` is `no-store`, so it always reaches the function. 429 responses are `no-store` and are never cached.
- **Multi-instance adequacy — the one real caveat, and PR #237 discloses it itself** (`rate-limit.mjs` header comment): the limiter is an in-memory `Map`, scoped to a single warm serverless isolate. On Vercel, concurrent cold starts or multiple warm isolates each get their own independent bucket, so a client distributed across several isolates could exceed the nominal 20/60s limit by a multiple of however many isolates happen to be warm concurrently. This is **not a bug in the PR** — it is an honestly-documented best-effort protection, not a durable/distributed one. It still meaningfully raises the cost of sustained single-isolate abuse, and sits in front of the already-active CDN cache (`s-maxage=45` on `/api/decision` success responses) and the bounded concurrency pool (6 io / 4 compute, 429/503 overload shedding) that are live in production today regardless of PR #237.
- Verdict: PR #237 is functionally correct for what it claims to be (best-effort, single-isolate). It is not, and does not claim to be, a durable multi-instance rate limiter. If Kresna wants true cross-instance enforcement, that requires an external store (Vercel KV/Upstash or similar) — a materially bigger change, out of scope for "minimal change," and not recommended here without a proven need (no evidence of actual abuse was found in this audit).
- Recommendation: merge-ready as a best-effort layer; Kresna decides whether the documented multi-instance limitation is acceptable as-is or needs the larger durable-store follow-up (separate PR, separate decision).

## Release constraint N5: canonical V12 contract

Do not set `FPL_V12_CANONICAL_URL` in production. If the canonical service answers READY, the server returns `contract: FPL_V12_CANONICAL_DECISION_V1`, `canonical_v12: true`. `decision-first.js` and `planning-compact.js` accept only the two public contracts with `canonical_v12 === false`, so the dashboard fails closed: no plan, no scenario numbers, but a misleading "Invalid public decision context" message. Tests that pin this are in PR #242; the proposed frontend-only fix and its blocker (a redacted real V12 payload sample) are in docs/N5_V12_CONTRACT_COMPATIBILITY.md.

## Test / build evidence (Yudistira)

Branch `feat/v6-status-and-value-metrics` (PR #239), from baseline `02857b6176ea8c91c8e3b20661174a5377083d5e`:
- `npm test` at #239 head 155bbdc: 357/357 pass. New coverage: V6 chip render test (five states, distinct glyphs, observed_at rules, escaping), definition test of value_season/value_form against the frozen Official snapshot, and a Playwright spec for the V6 chip (states, glyph/border distinctness, no overflow at 393/768/1440 in light and dark).
- `npm run check:browser`: pass ("Browser scripts parsed successfully").
- `npm run build` and `npm run build:vercel`: both succeed.
- Vercel preview: built and reported Ready by the Vercel bot, but behind Vercel Deployment Protection (an infrastructure login on previews only; the dashboard application itself has no login). **NOT VERIFIED**: no visual check of the preview has been done from any sandbox. Local fixture screenshots are component evidence only, not Vercel Preview evidence.
- **NOT VERIFIED**: I could not independently curl/browse the live preview myself — this sandbox's outbound proxy allowlist returns 403 for `*.vercel.app` (confirmed: `CONNECT ... vercel.app:443` → `403 Forbidden` from the proxy, not from Vercel). Kresna or a session with browser access should open the preview link above to visually confirm both the V6 footer label and the new Value metric options before approving merge.

Branch `hardening/per-ip-rate-limit` (PR #237): see "Rate limiting review" for the head history (96aab6f original, f6cd844 hardening, f3ba610 audit tests).

## Yudistira verdict (independent evidence review)

| Item | Verdict | Reason |
|---|---|---|
| P1 V6 status visibility | PASS (code/tests) · NOT VERIFIED (visual) | Logic and regression tests pass; live visual confirmation on the preview still needed — see above. |
| P2 value_season/value_form | PASS (code/tests) · NOT VERIFIED (visual) | Same as above. |
| PR #237 rate limiting | PASS (regression), CONDITIONAL (production adequacy) | Tests pass against current main; the multi-instance best-effort limitation is real and must be a conscious Kresna decision, not an assumed non-issue. |
| P0 reconciliation with Phase 0 docs | PASS (documentary) | Reconciled 2026-11-01, see P0 section. The five documents stay outside the repository. |
| Release constraint N5 | CONDITIONAL | Fail-closed behaviour pinned by tests in PR #242; V12 must stay disabled in production until the frontend supports the canonical contract. |

## Backlog / remaining order

1. (Done) P0 reconciliation, see the P0 section.
2. A session with an authorised preview access opens the PR #239 preview and visually confirms the V6 chip states and the Value scatter entries (the preview is behind Vercel Deployment Protection).
3. Kresna decides on PR #237: merge as-is (best-effort, documented limitation) or request the larger durable-store follow-up first.
4. On Kresna's explicit approval only: merge PR #239, then separately PR #237 (or together, Kresna's call) — never both without that approval, never a production deploy without separate explicit authorization per `AGENTS.md`/`docs/AI_COLLABORATION.md`.

## Explicitly deferred (per Kresna, unchanged by this session)

Dream Team per-GW history wiring; V12 endpoint activation; MC500K dashboard runtime; coach fit / formation fit (engine itself marks these UNAVAILABLE); migrating starter-probability off the GLOBAL challenger engine.

## Governance notes

- `AGENTS.md` and `docs/AI_COLLABORATION.md` were read before any change in this session, per `CLAUDE.md`'s pointer. One writer per file was respected: this session only touched `decision-first.js`, `domain.mjs`, and their two test files, in a new branch, with no overlap with PR #237's files.
- No credentials, private V6/V12 data, or proprietary engine code were read into or exposed by this change.
- No production deploy, no merge to main, no scheduler change, no private-data-boundary change was made or attempted.
