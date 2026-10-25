# Audit improvements baseline (G00) — dashboard

Captured 2026-10-25 (Asia/Jakarta) before D01. Pack: `FPL-Improvement-Claude-2026-10-25`. Figures are a snapshot, not live facts.

## Source and PRs

| Item | Value |
|---|---|
| Repo | `iphoenk/fpl-iphoenk-dashboard` |
| Baseline HEAD | `fc7cff8fad8e6ba35d74aa782912059c9e0da735` (docs: adoption backlog, #186) |
| Branch / dirty files | `main`, clean |
| Node | v22.23.4 locally (CI uses 24; `engines` >=22) |

Open PRs at capture (REST): #171 `feat/mc-shadow-integration` (draft, `dirty` = conflicts with main, head `c2e1b22`), #93 single decision authority guard, #91 Player Intelligence audit, #90 advisory failure diagnostics, #80 deterministic lineup evidence, #75 English connection gate, #73 desktop/tablet reference style, #72 acceptance V12 deterministic reuse.

Collisions to watch: #93, #72 and #80 touch decision/lineup authority and will overlap D04; #73 touches layout CSS (overlaps D01/D06); #171 overlaps M-series and `phase-one`/server files.

## Baseline commands (HEAD `fc7cff8`)

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | audit warnings only |
| `npm test` | 0 | 237 pass / 0 fail |
| `npm run build:vercel` | 0 | |
| `npm run build` | 0 | |
| `npm run check:browser` | 0 | exit is non-zero if run before a build (needs `public/index.html`) |
| `python -m unittest discover -s tests_python` | 0 | 15 tests |

No baseline failures in this repo. (PR171's reported three baseline failures were not reproduced on `main`; they may belong to that branch.)

## Reproduction of audit findings

| Finding | Status |
|---|---|
| Overview 768/820 pitch collapse | Reproduced: `.decision-primary` computed `0px 658px`, pitch wrapper 0px. Fixed in #187. |
| Mixed score basis (picks / standings / live) | Reproduced by reading code paths (header read `entry_history.points`, standings and live elsewhere). Addressed in #188. |
| Silent GW switch on failed explicit GW | Reproduced in `loadTeam` (candidate list fell back to older finished GWs). Fixed in #188. |
| `Number(p.multiplier||1)` bench 0 -> 1 | Reproduced in `teamState.squad`. Fixed in #188. |
| Awards scope = displayed page (20 rows) | Reproduced in `renderLeagueAwards` (`ext.leagueRecords`). Addressed in D03. |
| Optimal XI invalid | Not reproduced yet (D04). |
| Old captain conflict / undefined features | Historical in the plan; not re-investigated. |

## Ownership notes

`ui.js`, `phase-three-ui.js`, `decision-first.js`, `advanced-league.js` are shared by D02–D06: one writer, sequential branches. Both `scripts/build.mjs` and `scripts/build-vercel.mjs` list modules explicitly. Bundled modules share one global script scope: do not declare top-level names such as `history` (guarded by a test).

## Other repos (see their own checkpoints)

Engine `iphoenk/FPL-iphoenk-engine` HEAD `7d0852b`; MC `iphoenk/fpl-iphoenk-mc` main `5615b9a`, PR #1 `55645f9`, PR #2 `73a1531` (draft, stacked).
