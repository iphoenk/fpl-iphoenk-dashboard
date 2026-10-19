# Provider independence checkpoint — 20 October 2026

Baseline rollback: phase3 source25859456e4f09412a0e7409de8a13b6f5b3ff24d; deployment dpl_Gocs3vTK1L7E4eYCEssd3nM5u5ZS (https://fpl-iphoenk-9kf47o0wm-iphoenk-4883.vercel.app).

Own repository: iphoenk/fpl-iphoenk-dashboard. Vercel project: fpl-iphoenk. Canonical public URL https://fpl-iphoenk.vercel.app. fpl-dashboard-legacy is not the production source.

| Used source | Independent component | Limits |
| --- | --- | --- |
| FPLens default predictions | Atomic validated manifest/player bundle mirrored into private Blob; source metadata preserved; Official ep_next fallback on cold outage | No trained-engine replica, weights, fabricated SHAP or backtest claims |
| FPLens historical evaluation/diagnostics/news | Private response mirrors of used endpoints; historical labels and article links/dates retained | Undated alternate predictions/optimizer/multi-GW snapshots archived as unverified raw data and not served as current recommendations |
| FPL Insights | Own parser and private validated current-GW snapshot mirror; cold outage uses independent Official player projections with explicit fallback label | Opta fields missing from Official FPL remain unavailable; multi-GW projection remains a labelled fixture heuristic |
| FPL Core | Own CSV adapter, permanent-code/full-name validation, dedup/unknown propagation; computed evidence mirrored privately | Last valid source data cannot create new cross-competition matches if provider stops; publication date is not inferred from check time |
| FPL Jakarta | Own awards algorithms from Official picks/live/history, sample scope, ties, vice-captain and chip rules | No code copied; inspiration credited, no license found |

Provider mirrors use a separate providers/v1 namespace; unverified archives use providers/archive/v1. Forecasts/v1 predeadline evaluation archives remain immutable and untouched. Public routes cannot read personal-entry or arbitrary external URLs into the mirror. GET requests populate validated public-data mirrors; no new scheduler, data commits or private tokens in Git.

Complete provider request budget22s, with bounded factory/bootstrap/read/source/body/write operations below browser27s budget. SHA-256 guards mirror integrity. Wrong GW/season/deadline and unknown values are rejected or kept unavailable. Mirrors preserve source publication timestamps, capture time is separately labelled, stale status is explicit. Optional source failures do not replace Official FPL facts.

Verification:60 automated tests, both builds and browser-script parse passed; injected source loss, corrupt mirrors, undated optional responses, hanging storage and stalled response body tested. Live mirror warm-up and read confirmation recorded in task results. Alternative Worker build has Official fallback but no durable Blob mirror; production runs Vercel adapter.
