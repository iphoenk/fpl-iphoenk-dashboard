# Frozen prediction ledger: current state, gaps and v2 design

Status: design for review. No ledger code is changed by this document.
Evidence date: 2026-10-25, read from production `/api/forecast-archive` and the code in `phase-one.mjs`, `phase-one-server.mjs`, `own-model*.mjs`.

## Why

Any claim that a model is accurate, or that a recommendation helped win the mini-league, needs predictions that were fixed before the outcome and settled afterwards against Official FPL. Idea source: the frozen-ledger pattern in `jorgefhernandezg/fpl-dashboard` (idea only, no code copied).

## What already exists

- Private Vercel Blob, one record per season, gameweek and source: `forecasts/v1/<season>/gw<N>/<source>.json`.
- Record = snapshot + SHA-256 of the snapshot; a record is never overwritten; records captured at or after the deadline are rejected on read.
- Sources: `official-fpl` (ep_next), `fplens` (config_d), `fpl-iphoenk-python-v1`.
- Settlement after the GW is final (`finished`, `data_checked`, all fixtures finished): MAE overall and per position.
- Capture mode is `on-visit`: a snapshot is written when someone opens Overview or presses the button.

## Gaps found in production data

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| G1 | History starts at GW8; GW1-7 are missing and cannot be backfilled honestly | Only gw8 and gw9 exist | At most a few GWs of evidence; any accuracy claim is premature |
| G2 | The frozen snapshot is the first capture, not the last before the deadline | GW8 captured 2026-10-19 14:50Z, deadline 2026-10-23 17:30Z (about 4 days early) | An early capture is a valid forecast, but of a different horizon: it measures a prediction made about 4 days ahead. News after capture is not reflected, and the direction of the resulting bias is unknown. Do not call it an understated accuracy; label it as the early checkpoint and compare sources only at equal checkpoints |
| G3 | On-visit capture can miss a GW if nobody opens the site before the deadline | GW9 fplens captured 2026-10-24 11:35Z, Python model has no GW9 record | Silent gaps; sources are not captured at the same time, so comparisons are not like for like |
| G4 | No V12 predictions in the ledger | UI text: "Not yet using V6/V12" | The decision authority is not the thing being measured |
| G5 | Only per-player expected points are recorded, not decisions | Schema has `players[{id,predicted}]` only | Cannot settle captain picks, transfer advice or win probability against the rival |
| G6 | Coverage gaps | Python model GW8: 667 of 668 players | Must be recorded and shown, not hidden by MAE over matched rows |
| G7 | Official ep_next is a heuristic, FPL chance values are 0/25/50/75/100 | FPL bootstrap-static | Do not treat these as calibrated probabilities when scoring models |

## v2 design

### Entry (append-only)

```json
{
  "schema": 2,
  "season": "2026", "gw": 9, "deadline": "2026-10-31T11:00:00Z",
  "source": "v12", "model": "<name>", "model_version": "<semver>", "code_commit": "<sha>",
  "checkpoint": "T-24h",
  "captured_at": "2026-10-30T11:00:00Z",
  "input_digests": {"bootstrap_sha256": "...", "fixtures_sha256": "..."},
  "players": [{"id": 12, "xp": 5.1, "minutes_prob": null}],
  "decisions": {"captain": 411, "vice": 12, "xi": [], "transfers": []},
  "coverage": {"predicted": 668, "universe": 668},
  "prev_sha256": "<hash of previous entry for this source and season>",
  "sha256": "<hash of this entry without sha256>"
}
```

### Freeze rules

1. Entries are append-only. A new checkpoint never replaces an older one.
2. An entry with `captured_at >= deadline` is invalid and never settled.
3. The scored entry for a source and GW is the last valid checkpoint before the deadline ("final"). Earlier checkpoints are kept to measure how forecasts drift.
4. `prev_sha256` chains entries per source and season. A chain alone does not prove integrity: whoever can rewrite the whole chain can rewrite the head. The latest head hash must be anchored independently (for example a signed tag or a separate write-restricted location), and the storage must forbid overwrite and deletion of existing entries.
5. Gaps are recorded as `missing` for that GW, never filled afterwards.

### Settlement

Only after the GW is final in Official FPL. Report, per source and baseline `official-fpl`:

- MAE, RMSE and bias per position, with n and coverage.
- Rank agreement (Spearman) and top-10 hit rate. The primary evaluation includes players who did not play (0 minutes): excluding them hides the forecast failure that matters most. A secondary view restricted to players with minutes may be shown, labelled as such.
- Decision settlement: captain points and XI points against the hindsight best captain and best XI under the same squad. These are hindsight benchmarks, not achievable targets, and must be labelled that way (needs `decisions`).
- Five settled GWs is a minimum threshold for reporting at all, not evidence of superiority. A "better than X" statement additionally needs coverage, an uncertainty interval, and comparison on the same checkpoint and the same player universe. Always show n.

### Authority and boundaries

- V12 writes entries. V6 supplies the facts they are computed from. The dashboard only reads and displays ledger records and their hashes.
- The browser never computes or writes ledger entries.
- AGENTS.md forbids a replacement scheduler and exposing private engine reports in this repository, so checkpoint scheduling belongs to the engine, not to dashboard cron.
- Source credit for the idea stays in `credits.json` (jorgefhernandezg: ledger idea, no code copied).

## Decisions needed from the owner

The recommendations below come from an external review and my own reading, not from the owner. They are not decided until the owner confirms them.

| # | Decision | Options | My recommendation |
|---|---|---|---|
| D1 | Where entries live | A: keep Vercel Blob; B: private git for the manifest, version and hash; private Blob for full snapshots | B: git holds the manifest/version/hash only, full snapshots stay in private Blob; never put MC simulation paths in git |
| D2 | Checkpoints that count | Existing V12 times: 04:30, 12:30, 21:30 WIB plus deadline-day T-24h to T-5m | Score the last valid checkpoint at or before T-5m, and score T-24h separately; keep the others for drift |
| D3 | Record decisions, not only xP | Yes / not yet | Yes: XI, bench, C, VC, transfers, chip and the economic context, each marked known or unknown |
| D4 | Who captures | V12 job only, or V12 job plus on-visit fallback | Engine job primary; on-visit fallback labelled and held to the same validation |
| D5 | Retention | Whole season, or all seasons | Keep summaries, decisions and audit records across seasons; retain raw MC output on a separate, shorter schedule |

## Rollout

1. Owner decides D1-D5.
2. Fix G2 in the existing dashboard archive only if D1 keeps Blob: capture a final checkpoint near the deadline, labelled, without overwriting the first.
3. Define the V12 ledger contract (schema above) in the engine repository and add a read-only adapter here that validates schema, hash chain and deadline rule.
4. Show settled results with n, coverage and missing GWs; no rankings before 5 settled GWs, and even then only with coverage, uncertainty and equal checkpoint and universe.
5. Add decision settlement once V12 records `decisions`.

## Out of scope here

Backfilling GW1-7 and changing any scoring or recommendation logic.

## Monte Carlo readiness (2026-10-25)

The private `fpl-iphoenk-mc` repository has open PRs #1 (validation foundation) and #2 (transport plus an engine-backed player histogram exporter). No real MC output exists yet, so the ledger has no MC entry and none may be backfilled or synthesized. When the first real run exists, record it before the deadline with: engine revision, input hash, seed, actual simulation count, source timestamps and universe coverage. MC marginals are shadow evidence only; the ledger must not claim that MC improves recommendations until parity, backtest and acceptance pass.
