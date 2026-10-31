# BARATAYUDA_HANDOFF — iphoenk/fpl-iphoenk-dashboard

Status as of this document: P0 partially blocked (see below), P1/P2 implemented and awaiting Yudistira/Kresna sign-off. No merge, no production deploy, no scheduler change, no private-data-boundary change has been made.

Baseline production SHA: `02857b6176ea8c91c8e3b20661174a5377083d5e` (main HEAD, merged PR #234, "D10: 44px minimum touch targets on phones, lower ratchet baselines"). Confirmed current — PR #239 below branches from this exact SHA.

## P0 — Consolidation status: BLOCKED (partial)

KRESNA's directive asks to reconcile this session's findings with five Phase 0 documents from another Claude session (AUDIT_BASELINE, SYSTEM_INVENTORY, API_DATA_LINEAGE, GAP_ANALYSIS, REGRESSION_BASELINE). I searched for these:

- `git log --all --name-only` across every branch of `iphoenk/fpl-iphoenk-dashboard`: no match.
- Filename search across all 6 repos this session has access to (`fpl-iphoenk-dashboard`, `fpl-dashboard`, `FPL-iphoenk-engine`, `fpl-reports-private`, `fpl-master-monitor`, `fpl-iphoenk-mc`, `maenbola-engine`): no match.
- The SHA the directive cites (`02857b6...`) is real and is the current main HEAD — that part is independently confirmed.

The five documents themselves are not committed anywhere this session can reach, so I cannot reconcile against content I have not seen. Reconciling by assumption would mean inventing the other session's findings, which BARATAYUDA's own evidence rules (section D) forbid. This is reported as BLOCKED, not skipped — not implemented as "DEFER" or silently dropped.

What Kresna needs to unblock this: paste the five documents' content directly, attach them as files, or share the artifact/doc links from the other Claude session. Once available, I will reconcile point-by-point against the five sub-audits below and update this file.

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
| PPM / value | Was: not available. Now: available directly (PR #239) | `bootstrap-static.value_season`/`value_form` native; formula-verified live against ~450 players (`total_points/(now_cost/10)` matches `value_season` exactly; `form/(now_cost/10)` matches `value_form` to rounding) | Implemented in PR #239 as `valueSeason`/`valueForm`, reading native fields, explicitly not labelled "PPM" to avoid an ambiguous definition claim. |
| Expected points (model) | From engine (3 layers) | Own model (`own-model-server.mjs`), V12 canonical (if configured), FPLens/GLOBAL challenger (`fpl-dashboard/pipeline/model/xp.py`) | Own model is primary today; priority order documented in `fpl-dashboard/README.md`. |
| Starter probability | From engine | `xp.py` computes `pstart`/`pplay` from start history + status + predicted lineups — belongs to the GLOBAL challenger engine, not a dashboard concern | KEEP as-is; migrating it into the dashboard itself is explicitly DEFERRED per Kresna, no proven need. |
| Coach fit | Not available | `FPL-iphoenk-engine/.../v12_gw1_gw6_history_context.py:126-127`: engine itself returns `status:"UNAVAILABLE", reason:"NO_CAUSAL_COACH_FIT_CALIBRATION"`; `own-model-ui.js:23` explicitly states it produces no such score | Not a dashboard gap — the source engine declines to produce this value. DEFER per Kresna; building it in the dashboard would mean inventing a number with no causal calibration behind it. |
| Formation fit | Not available | Same file, `"status":"UNAVAILABLE","reason":"MATCH_LEVEL_ROLE_AND_COACH_EVIDENCE_REQUIRED"` | Same as above. DEFER per Kresna. |

## V6 status visibility — implemented (P1)

- Branch: `feat/v6-status-and-value-metrics`
- PR: https://github.com/iphoenk/fpl-iphoenk-dashboard/pull/239 (open, not merged)
- Change: `decision-first.js` `planCard()` now reads `report.source.v6.status` (already present in the `/api/decision` payload, no API change) and shows it as a third footer span: "V6 data: verified / stale / unverified / unavailable". Tooltip explicitly states this is independent of V12 readiness.
- No API contract change. No change to `provenance()` logic in `multiuser-decision-server.mjs`.

## Player value metrics — implemented (P2)

- Same branch/PR as above.
- Change: `domain.mjs` `valueMetricOptions()` gained two entries, `valueSeason` and `valueForm`, reading `bootstrap-static`'s native `value_season`/`value_form` fields directly. No new endpoint, no recomputation duplicating what FPL already publishes.
- Labelled "Value (season)" / "Value (form)" per Kresna's instruction not to call it "PPM" unless the definition is verified identical — it is numerically identical to the community PPM formula, but the UI cites FPL's own field name to avoid an unverifiable claim about a different possible PPM definition elsewhere.

## Rate limiting review (P1, PR #237)

PR #237 ("Audit #3: per-IP rate limiting on /api/decision and /api/own-model") was re-verified against current main, not re-implemented as a competing solution:

- `gh api .../pulls/237`: `merged:false`, `mergeable:true`, `mergeable_state:"clean"`, base SHA `02857b6176ea8c91c8e3b20661174a5377083d5e` — exactly current main HEAD. Not stale, not behind.
- Checked out PR #237's branch (`hardening/per-ip-rate-limit`) directly on top of current main and ran the full suite: **357/357 tests pass** (main's own 351 + PR #237's 6).
- Design: `checkRateLimit(name, request)` keys on `endpoint-name + client-IP` only (`rate-limit.mjs:14`) — confirmed by reading the source that query parameters are not part of the key, so varying `entry_id`/`horizon` from the same IP shares one bucket (answers Kresna's "parameter berbeda" scenario).
- Default limit matches Kresna's requested test scenario exactly: 20 requests / 60-second window (`rate-limit.mjs` default `limit=20, windowMs=60000`).
- Multiuser: confirmed by existing test ("tracks distinct IPs... independently") — a second IP is unaffected by the first IP's usage.
- 429/Retry-After: confirmed by existing test — `rateLimitResponse` returns status 429, `Retry-After` header, `Cache-Control: no-store`.
- Cache hit/miss interaction: the rate-limit check runs in `api/index.js` before any business logic, cache lookup, or upstream fetch, so it counts every incoming request regardless of whether the result would have been a cache hit — confirmed by the existing integration test, which shows the limiter tripping even on requests that are themselves rejected downstream for missing `entry_id` (400s still count).
- **Multi-instance adequacy — the one real caveat, and PR #237 discloses it itself** (`rate-limit.mjs` header comment): the limiter is an in-memory `Map`, scoped to a single warm serverless isolate. On Vercel, concurrent cold starts or multiple warm isolates each get their own independent bucket, so a client distributed across several isolates could exceed the nominal 20/60s limit by a multiple of however many isolates happen to be warm concurrently. This is **not a bug in the PR** — it is an honestly-documented best-effort protection, not a durable/distributed one. It still meaningfully raises the cost of sustained single-isolate abuse, and sits in front of the already-active CDN cache (`s-maxage=45` on `/api/decision` success responses) and the bounded concurrency pool (6 io / 4 compute, 429/503 overload shedding) that are live in production today regardless of PR #237.
- Verdict: PR #237 is functionally correct for what it claims to be (best-effort, single-isolate). It is not, and does not claim to be, a durable multi-instance rate limiter. If Kresna wants true cross-instance enforcement, that requires an external store (Vercel KV/Upstash or similar) — a materially bigger change, out of scope for "minimal change," and not recommended here without a proven need (no evidence of actual abuse was found in this audit).
- Recommendation: merge-ready as a best-effort layer; Kresna decides whether the documented multi-instance limitation is acceptable as-is or needs the larger durable-store follow-up (separate PR, separate decision).

## Test / build evidence (Yudistira)

Branch `feat/v6-status-and-value-metrics` (PR #239), from baseline `02857b6176ea8c91c8e3b20661174a5377083d5e`:
- `npm test`: **353/353 pass** (351 pre-existing + 2 new regression tests: one asserting the V6 footer label for all 4 statuses and that it never claims V12 readiness; one asserting `valueSeason`/`valueForm` read native fields without fabrication for missing data).
- `npm run check:browser`: pass ("Browser scripts parsed successfully").
- `npm run build` and `npm run build:vercel`: both succeed.
- Vercel preview: **Ready** — https://fpl-iphoenk-git-feat-v6-status-and-value-metrics-iphoenk-4883.vercel.app (confirmed via GitHub commit status + Vercel bot PR comment, both reporting success/Ready).
- **NOT VERIFIED**: I could not independently curl/browse the live preview myself — this sandbox's outbound proxy allowlist returns 403 for `*.vercel.app` (confirmed: `CONNECT ... vercel.app:443` → `403 Forbidden` from the proxy, not from Vercel). Kresna or a session with browser access should open the preview link above to visually confirm both the V6 footer label and the new Value metric options before approving merge.

Branch `hardening/per-ip-rate-limit` (PR #237, not modified by this session): **357/357 tests pass** against current main, as detailed above.

## Yudistira verdict (independent evidence review)

| Item | Verdict | Reason |
|---|---|---|
| P1 V6 status visibility | PASS (code/tests) · NOT VERIFIED (visual) | Logic and regression tests pass; live visual confirmation on the preview still needed — see above. |
| P2 value_season/value_form | PASS (code/tests) · NOT VERIFIED (visual) | Same as above. |
| PR #237 rate limiting | PASS (regression), CONDITIONAL (production adequacy) | Tests pass against current main; the multi-instance best-effort limitation is real and must be a conscious Kresna decision, not an assumed non-issue. |
| P0 reconciliation with Phase 0 docs | BLOCKED | Five named documents not found in any of the 6 repos or any branch; cannot reconcile unseen content. |

## Backlog / remaining order

1. Kresna supplies the five Phase 0 documents (or confirms they don't exist / were from a different, inaccessible source) → P0 reconciliation completes.
2. Kresna or any session with browser/network access opens the PR #239 preview and visually confirms the V6 footer label and Value metric dropdown entries.
3. Kresna decides on PR #237: merge as-is (best-effort, documented limitation) or request the larger durable-store follow-up first.
4. On Kresna's explicit approval only: merge PR #239, then separately PR #237 (or together, Kresna's call) — never both without that approval, never a production deploy without separate explicit authorization per `AGENTS.md`/`docs/AI_COLLABORATION.md`.

## Explicitly deferred (per Kresna, unchanged by this session)

Dream Team per-GW history wiring; V12 endpoint activation; MC500K dashboard runtime; coach fit / formation fit (engine itself marks these UNAVAILABLE); migrating starter-probability off the GLOBAL challenger engine.

## Governance notes

- `AGENTS.md` and `docs/AI_COLLABORATION.md` were read before any change in this session, per `CLAUDE.md`'s pointer. One writer per file was respected: this session only touched `decision-first.js`, `domain.mjs`, and their two test files, in a new branch, with no overlap with PR #237's files.
- No credentials, private V6/V12 data, or proprietary engine code were read into or exposed by this change.
- No production deploy, no merge to main, no scheduler change, no private-data-boundary change was made or attempted.
