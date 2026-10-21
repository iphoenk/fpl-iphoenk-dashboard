# Independent Python xP engine — proposed design

Status: design approved by the user on 20 October 2026; implementation plan follows separately. No Python engine or new production endpoint implemented by this document.

## Intent and scope

Build an independent, explainable next-gameweek expected-points baseline for FPL iphoenk. Python produces a validated JSON snapshot consumed by the existing JavaScript dashboard on the existing Vercel project. GK, DEF, MID and FWD use different scoring and relevant statistics. The initial release is explicitly experimental, not a claim of a trained tactical model or better accuracy than Official FPL/FPLens.

User constraints, including the latest correction:

- Exclude factors with unavailable/unreliable data or calculations that cannot be supported. Do not add empty tactical panels, invented percentages or speculative simulations.
- Do not let incomplete or stale inputs contaminate the output. Missing is not zero. A previous GW output cannot stand in for a new one.
- Preserve the current working dashboard, private source mirrors and immutable forecast archive. Do not integrate V6/V12, add a replacement scheduler or copy upstream trained models.
- Keep numerical data, generated predictions and secrets outside Git. Keep implementation and provenance documentation in the private project repository.

## What version one uses

Official FPL only for the initial computation: bootstrap identities and current availability, fixtures and deadlines, verified scoring configuration, and historical player/fixture records. Current projections must be computed independently: Official ep_next and FPLens are comparison baselines, never input features or silent replacements for this engine.

The implementation first inventories actual source fields. A feature enters the model only if its definition, identity, timestamp and coverage pass validation. Unsupported optional data sources are excluded from the initial contract rather than being required and then falling back.

| Position | Relevant supported evidence |
| --- | --- |
| GK | Minutes/starts, saves, conceded goals, clean sheets, recorded bonus and deductions |
| DEF | Minutes/starts, xG/xA, goals/assists, defensive records, clean sheets, bonus and deductions |
| MID | Minutes/starts, xG/xA, goals/assists, applicable clean-sheet/defensive scoring, bonus and deductions |
| FWD | Minutes/starts, xG/xA, goals/assists, applicable defensive scoring, bonus and deductions |

Fixture context uses observed home/away team attacking and defensive records where complete, with disclosed statistical shrinkage toward observed league/position averages. Such shrinkage is modelling uncertainty from complete low-sample records; it must not disguise missing or failed acquisition.

## Explicitly excluded from version one

- Coach fit, tactical team fit, formation fit, pressing style, defensive line, positional tracking and scheme-against-scheme scores.
- An overall subjective skill rating or guessed player role. The source's official position and recorded statistical contributions are sufficient for this baseline.
- Assumed lineups, invented injury recovery dates, speculative rotation narratives or confidence scores inferred from news wording.
- Proprietary odds, new paid feeds or optional provider statistics needed to complete a prediction.
- Calibrated start/haul probabilities, percentile ranges and Monte Carlo outcome simulations before an independently validated probabilistic model exists.
- Multi-GW injury recovery and transfer optimization driven by unvalidated future extrapolation. First release targets the next GW only.

Unavailable features do not appear as empty scores in the UI and are not included in a weighted composite.

## Computation design

1. Acquire a bounded, reproducible input snapshot; record acquisition timestamps, source paths and SHA-256 hashes. Recheck the official next GW/deadline and fixtures before publication.
2. Admit historical fixtures only when final and officially checked. Deduplicate by player permanent identity and fixture ID. Preserve each fixture in a double GW rather than evenly splitting an aggregate. Do not invent a zero row for a missing match, a blank GW or a player before registration.
3. Estimate playing-time and contribution rates from recorded appearances, using position-level shrinkage for small but complete samples. Configuration, priors, sample size and any recency weighting are versioned and disclosed. Player availability is separate from historical start frequency. Published chance_of_playing is not a guaranteed minute prediction.
4. Estimate fixture context from completed observed matches. Produce per-fixture expected contributions for supported components, then translate using verified active-season FPL scoring. Do not infer scoring thresholds from a few award observations. Unsupported scoring configuration blocks publication.
5. Sum actual scheduled fixtures for the target GW. A confirmed blank is explicit zero with fixture provenance; an unknown schedule is unavailable. Do not apply captain multipliers inside player xP.
6. Validate each eligible player's full required component coverage and finite output. An unavailable component blocks that player's own-model xP; never publish an apparently complete total assembled from missing terms.
7. Validate dataset-level integrity. An incomplete acquisition, invalid season/deadline, unavailable scoring configuration or inconsistent identity aborts publication and preserves the last valid artefact only as historical evidence, not as the current prediction.

The first model is a transparent statistical baseline. A later learned model is a separate extension justified by time-ordered evaluation, not an implicit part of this release.

## Existing Python reference audit

Own reference code exists in work/model-reference/pipeline/model/{xp,history,teams}.py and pipeline/benchmark.py. It is not currently wired into this dashboard. Reuse selected own mathematical routines only after tests and audit; do not import its build process, scheduler, source integrations or V6/V12 authority configuration.

Known issues requiring repair before reuse:

- Historical parsing currently coerces absent fields into zero.
- Team-history construction splits aggregate xG evenly across double-GW fixtures.
- Backtesting can use today's identities/prices rather than genuine historical as-of snapshots.
- Price-based priors and injury recovery assumptions must not be inherited silently.
- Scoring fallback assumptions and implied probability labels require explicit validation.

## Execution, storage and Vercel

Python batch computation runs through a manual command, not on every browser visit. This keeps Vercel page reads fast and avoids adding an unattended scheduler. The pipeline separates acquisition, validation, prediction and evaluation. An explicit refresh rebuilds from source data; code updates alone do not make a new data snapshot.

Output goes to an ignored temporary/output directory. A trusted Node publisher validates the result and writes it to the existing private Vercel Blob store using server-side credentials. There is no public upload endpoint, arbitrary source URL or browser-accessible token.

Paths are separate from existing source mirrors and immutable archives:

- own-model/v1/{season}/gw{gw}/{model_version}/latest.json: validated current predeadline output.
- forecasts/v1/{season}/gw{gw}/fpl-iphoenk-python-v1.json: first valid server-verified capture before deadline, immutable.

The existing Node Vercel adapter exposes a read-only allowlisted own-model endpoint. It validates schema, hash, version, season, deadline, official fixture identity and input age before returning data. It never relabels an existing provider snapshot as our model. A failed own-model read does not disable Official FPL or the source-model comparison.

Initial freshness policy: acquisition of all mutable required inputs must complete within one bounded 30-minute collection window, and publication must occur before the deadline. A current prediction expires six hours after the oldest required mutable-input acquisition, or at its deadline, whichever comes first. Revalidate availability against current Official FPL when serving; a changed availability fact suppresses the affected own-model row pending recomputation. Expiry produces unavailable own-model data, not an old-GW/current-label substitution. Display model/input timestamps in the device timezone. These operational limits are configurable and distinct from statistical quality claims.

Because there is no new scheduler, fresh coverage requires an explicit pipeline run. This limitation must be shown in Model Insights; do not promise automatic continuously fresh predictions.

## JSON contract

Envelope: schema_version, model_id, model_version, season, target_gw, deadline_utc, generated_at_utc, inputs_as_of_utc, expires_at_utc, scoring_version/hash, fixture_hash, source_manifest, validation_status and players.

Player row: permanent_code, current_element_id, verified name/team/official position, target fixture IDs, status (ready/unavailable), xP (number or null), component breakdown, evidence counts and supported historical explanation. No xP when status is unavailable. Optional ranges and calibrated probabilities are absent, not made up.

Input data, configuration and code versions must be sufficient to reproduce a prediction. Never backdate a newly reconstructed result as a captured predeadline forecast.

## Where it appears on the existing Vercel dashboard

| Existing section | Proposed change |
| --- | --- |
| Overview → Plan Next GW | Compact optional FPL iphoenk model summary, with comparison/source label and generation time; keep the existing layout |
| Planning → Captain Picks | Additional FPL iphoenk Python xP column/model choice beside Official FPL and the named source model; all GK/DEF/MID/FWD eligible players remain comparable |
| Player detail | Own-model xP and supported component explanation, sample size and timestamp; no tactical fit radar |
| Accuracy | Separate own-model immutable predeadline snapshots and later evaluation, including metrics by position |
| Model Insights | Version, methodology, feature inclusion, required-input validation, freshness and actual evaluation results |
| More → About | Identify the independent engine and retain the accurate existing adoption/data credits |

A model choice is explicit. The first release does not replace the default model or feed transfer/rival simulations automatically. Unknown input means no own-model prediction for that row; Official FPL estimates retain their own label. Repeated tables follow the existing ten-item inline pagination and work on 393px/768px/desktop in both themes.

Example presentation (labels only; no fabricated numerical predictions):

    Player | Position | Official FPL xP | FPLens xP | FPL iphoenk Python xP
    ...    | GK/DEF/MID/FWD | sourced    | sourced   | computed or unavailable

    Own model breakdown: playing-time contribution + expected attacking
    contribution + applicable defending/saves/bonus − expected deductions.

## Evaluation and rollout acceptance

- Unit tests for position scoring, unsupported rules, missing versus true zero, fixture duplication, DGW/blank handling, incomplete histories, changed availability and expiration.
- Reproducible end-to-end Python output, strict Node ingestion and private Blob read-back. Verify no secrets or generated data in Git and no prediction request triggers heavy Python computation.
- Preserve existing archive integrity and predeadline checks; add the new source without overwriting previous records.
- Compare equal eligible player intersections with Official ep_next and FPLens. Report coverage, MAE/rank correlation by position, active-player subset and overall. Keep differing source universes explicit.
- Reconstructed historical experiments are labelled retrospective. Current bootstrap status, prices and team membership cannot be presented as historical as-of facts. Prefer forward immutable snapshots for release decisions.
- No superiority claims from a few GWs or aggregate metrics dominated by non-playing players. No invented target success rate or automatic promotion threshold.
- Experimental release remains opt-in pending human review of forward evaluation. Existing production behavior remains the rollback baseline; failure of this optional model must not degrade Official FPL functionality.

## Implementation sequence after design review

1. Audit data fields and verified scoring; define strict schema and validation fixtures.
2. Build and test independent Python acquisition and position-aware baseline.
3. Add reproducible output and evaluation commands with missing-data/chronology guards.
4. Add trusted private publishing and read-only Node ingestion.
5. Add existing-section UI comparisons and immutable Accuracy integration.
6. Review, run current tests/builds plus Python tests, verify real private storage and responsive UI, then stage an opt-in deployment with rollback checkpoint.

Reference: Official FPL rules https://fantasy.premierleague.com/help/rules. Exact numerical rules are verified from active-season official configuration during implementation, not asserted by this document.
