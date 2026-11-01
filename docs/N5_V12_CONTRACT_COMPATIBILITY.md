# N5: Canonical V12 contract vs. the public frontend

Status: release constraint. Owner decision pending. No production change is made by this document.

## Constraint

Do not set `FPL_V12_CANONICAL_URL` in production until the frontend renders `FPL_V12_CANONICAL_DECISION_V1`.
V6 VERIFIED does not mean V12 READY_FULL, and HTTP 200 does not prove the model, the source gate or MC500K.

## What happens today if the backend returns a canonical response

`multiuser-decision-server.mjs` returns `contract: FPL_V12_CANONICAL_DECISION_V1`, `canonical_v12: true` when the
canonical service answers READY (`v12-canonical-adapter.mjs: toDashboardDecision`).
Three frontend consumers allow-list only the two public contracts and require `canonical_v12 === false`:

| File | Behaviour on a canonical response |
|---|---|
| decision-first.js (loadPublicPlan) | throws, caught: Overview plan card shows "Failed to fetch data: Invalid public decision context", no scenario numbers |
| planning-compact.js | `ready` is false: Planning shows "Decision service unavailable: Invalid public decision context", no scenario numbers |
| dashboard-focus.js | horizon label falls back to "1 GW" (reads contract name) |

Verified by tests in this PR (fixture-mocked, not production): the dashboard fails closed. It does not crash and does
not show wrong numbers. The defects are the misleading wording and the loss of the plan card, not data corruption.

## Proposed fix (not implemented here)

Frontend only, no API contract change, no new decision engine:

1. One small normaliser `decisionView(report)` returns `{mode:'public'|'canonical'|'invalid', ...}`. All three consumers
   call it instead of repeating the allow-list.
2. `mode:'canonical'` is accepted only when contract, entry_id, planning_gw, horizon and `provenance.input_fingerprint` /
   `canonical_v12_revision` are present and consistent with the request. Anything else is `invalid`.
3. The plan card footer and scope text are chosen per mode. Public mode keeps "Public data · Non-canonical". Canonical mode
   must not reuse that wording, and must not claim MC500K or Stage3 results unless the payload carries them.
4. `invalid` shows "Unsupported decision contract" instead of "Invalid public decision context".

Blocker for implementation: a redacted real sample of a `FPL_V12_CANONICAL_DECISION_V1` payload. Whether
`decision.scenarios.A/B/C` has the same shape as the public contract is not verified [Menebak]. If the sample shows a
different shape, an API adapter change would be needed and must be a separate PR with review.

## Acceptance for the future fix

- canonical READY payload renders A/B/C with canonical wording and no "Non-canonical" text.
- mismatched entry/GW/horizon, missing provenance, or `canonical_v12` not boolean renders "Unsupported decision contract".
- public contract output unchanged (existing tests stay green).
- Pins in `tests/v12-contract-frontend-constraint.test.mjs` and `tests/browser/v12-canonical-constraint.spec.mjs` are updated in that PR.
