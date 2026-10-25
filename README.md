# FPL iphoenk Dashboard

**Official FPL Data. Independent Intelligence. Evidence-Based Decisions.**

Responsive Fantasy Premier League companion for public squad data, classic leagues, scouting, transfer scenarios, player news, watchlists, and forecast evaluation.

**Production:** https://fpl-iphoenk.vercel.app  
**Status:** Public companion with experimental analytics and a separately gated Canonical V12 integration.

This project is independent and is not affiliated with the Premier League.

## Product principles

- **Official-first:** Official FPL is authoritative for factual player, team, fixture, price, status, point, and published-pick data.
- **No invented account state:** A public Entry ID does not reveal unpublished picks, actual selling prices, bank, free transfers, chip activations, or hit costs.
- **One decision authority:** Canonical V12 is the intended authoritative decision brain when explicitly configured and validated. Public deterministic advice must remain labeled non-canonical.
- **Transparent provenance:** Validate identity, GW, deadline, source freshness, coverage, and model revision.
- **Graceful degradation:** Optional source failure must not erase valid Official FPL functionality; explain degraded decisions.
- **Responsive experience:** Support mobile, tablet, desktop, and both light and dark themes.
- **No unauthorized source copying:** External code, assets, and datasets require verified rights and appropriate attribution.

## Capabilities and limitations

### Official FPL and public dashboard
Official FPL supplies public identities, prices, fixtures, statuses, points, and published GW picks. Overview supports This GW results and Plan Next GW. Planning starts from the last published squad and can show official `ep_next` estimates. A local captain draft is scoped to team and GW; captain x2 does not imply chip activation or an account change.

The dashboard cannot read unpublished personal picks or make authenticated FPL account changes.

### Public deterministic adviser
`GET /api/decision?entry_id=123456` provides a non-canonical public advisory based on published picks, verified `ep_next`, legal squad/XI formations, bounded transfer search, and scenario C/VC selection. It is not the private Canonical V12 optimizer, does not run Monte Carlo, and must not invent FT, hits, actual bank, sale prices, or net transfer gains.

Caching, singleflight, and concurrency bounds are in-process controls, not guarantees across serverless instances. The public-only route requires neither an FPL login nor a Neon database.

### External forecasts, news, and attribution
Prediction snapshots may use [FPLens](https://github.com/abdelmalek-maskri/fplens), with supplementary public scouting snapshots from [FPL Insights](https://github.com/JonnoMillar/fpl-insights), subject to identity, GW, deadline, freshness, coverage, and applicable data-use terms. Attribution of a data source does **not** authorize copying its source code.

News uses Guardian/FPL updates and an allowlisted public RSS integration path. Community reports are not official confirmation.

### Experimental Python xP
An independent Python 3.12 standard-library batch produces an optional next-GW baseline by position using final, checked Official FPL history. It is not executed inside Vercel page requests. The user explicitly opts in to its JSON comparison in supported insights/planning views.

The model has no demonstrated accuracy advantage. Missing observations are unavailable, never zero. Unsupported coach-fit, tactical, and formation-fit scores are excluded. Python xP does not automatically drive transfers or rival decisions.

```sh
python -m unittest discover -s tests_python -v
python -m python_xp acquire --output .model-data/input.json
python -m python_xp predict --input .model-data/input.json --output .model-data/prediction.json
node --env-file=.env.own-model.local scripts/publish-own-model.mjs .model-data/prediction.json
```

Publishing requires authorized private Vercel Blob credentials kept in ignored local environment files. Artifacts expire six hours after the oldest input acquisition or at deadline. Refresh requires a new explicit batch; there is no unattended refresh guarantee.

### Staged multi-GW adviser
The staged global projection challenger from the separate `iphoenk/fpl-dashboard` batch producer supports optional 1/3/5-GW planning design, comparing HOLD, one transfer, and bounded two-transfer packages with per-GW lineup and C/VC optimization. Its historical draft reference is PR #69; do not infer current deployment from the PR description.

The global projection is **not Canonical V12**. If GW, identity, freshness, or coverage validation fails, fall back to the public Official one-GW advisory with an explicit non-canonical label. Never fabricate free transfers, hit costs, or net gains.

## Offline MC shadow connection

`GET /api/mc/shadow` reads only the fixed private Blob path `mc-shadow/v1/latest.json` and returns sanitized operational metadata. It does not return forecast rows or change `/api/decision`. Missing output is `UNAVAILABLE`, never a synthetic forecast. Set `FPL_MC_SHADOW_ENABLED=0` to disable this optional reader. Alternative Worker builds return unavailable for this private integration.

The private `iphoenk/fpl-iphoenk-mc` bridge can generate a transport record with `python -m mc_bridge --input approved-player-export.json --context trusted-context.json --output candidate.json --format blob-record`. The exporter and real engine parity are not yet implemented. To publish an approved real record using an existing trusted environment, run `node --env-file=.env.local scripts/publish-mc-shadow.mjs candidate.json`. This command validates fresh Official context, writes the dedicated private path and verifies readback; do not publish constructed test data. No publication credential is embedded in GitHub or the browser.

See `docs/mc-shadow-integration.md` for contract boundaries, acceptance and remaining blockers. Shadow integration is not model acceptance or a production latency guarantee.

## Canonical V12 decision boundary

Official FPL remains the factual authority. Canonical V12 is the target decision authority, not an automatically active dashboard capability.

Server-side configuration:

```sh
FPL_V12_CANONICAL_URL=https://<validated-canonical-v12-service>/api/decision
```

The adapter requires contract `FPL_V12_CANONICAL_DECISION_V1`, matching `entry_id` and `horizon`, plus `provenance.input_fingerprint` and `provenance.canonical_v12_revision`. Invalid, stale, mismatched, or unavailable responses fail closed for canonical decisions. Public fallback may continue, but must never be presented as Canonical V12.

Do not declare full V12 integration or production readiness without verified endpoint availability, contract checks, consistent UI output, and production acceptance. Monte Carlo/MC500 is not a public capability unless a validated implementation actually runs.

## Source code ownership, licensing, and attribution

**Strict policy: No unauthorized copying of source code.**

Public access to a GitHub repository does not imply permission to copy, modify, redistribute, or relicense its implementation.

- Check license and permissions before reusing code, functions, files, assets, datasets, or model artifacts.
- Prefer independent implementation of ideas and documented interfaces. Renaming variables or cosmetically rewriting copied code is not independent development.
- AI-generated contributions from ChatGPT, Claude, Gemini, or other agents require the same provenance, security, and licensing review.
- Preserve required copyright notices, licenses, attribution, and modification notices for permitted reuse.
- Document the source URL, version/commit, license, usage, and reviewer approval in the pull request.
- Never expose private repositories, unpublished V6/V12 implementations, secrets, private Blob data, or proprietary models.
- Block merging any contribution whose origin or reuse rights cannot be verified pending human review.

Detailed mandatory contributor rules are in [AGENTS.md](AGENTS.md) and [docs/AI_COLLABORATION.md](docs/AI_COLLABORATION.md).

## Run and verify

Node.js 24 recommended. Use the lockfile on a clean checkout:

```sh
npm ci
npm test
npm run build:vercel
npm run check:browser
npm run build
npm run dev
```

Local preview: http://127.0.0.1:4173.

## Forecast archive and evaluation

Independent source freshness, identity/deadline validity, and model coverage are reported separately. The private accuracy archive retains the first eligible forward capture per season/GW/source with immutable paths and SHA-256 integrity. No capture after deadline. Captures are triggered by an Overview visit or explicit action; an unattended scheduler is not guaranteed.

Evaluation waits for finished Official fixtures and `event.data_checked`. Optional-source failures must not remove Official FPL functionality.

Private Vercel Blob is configured through server environment settings. Never commit tokens, forecast data, `.model-data/`, `.env`, or `.vercel` files. Historical phase-one checkpoint and rollback notes: [docs/checkpoints/2026-10-19-phase-one.md](docs/checkpoints/2026-10-19-phase-one.md).

## Collaboration and deployment

Read [AGENTS.md](AGENTS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/AI_COLLABORATION.md](docs/AI_COLLABORATION.md) before making changes. Claude and Gemini instructions must point to the same shared rules.

Use one focused feature branch per task, coordinate one writer per file, and submit a reviewed pull request. GitHub Actions and browser verification must be checked, not assumed.

Vercel project: `fpl-iphoenk`. Build entry: `node scripts/build-vercel.mjs`. Static output: `public`. Serverless proxy: `api/index.js`.

A Git push or green CI alone does not prove production deployment. Deployment requires authorization, confirmed Vercel status, and smoke testing of the real production UI, including responsive layouts, themes, degraded states, and decision consistency.


## Trusted owner-authorized AI workflow
ChatGPT, Claude, and Gemini working through owner-authorized accounts or integrations may use a streamlined collaboration process without repeated administrative provenance checks for original internal changes. Keep handoffs and PR descriptions concise to minimize time and token usage. This fast track does not waive third-party licensing, attribution, security, confidentiality, required validation, or deployment authorization. See [AGENTS.md](AGENTS.md) and [docs/AI_COLLABORATION.md](docs/AI_COLLABORATION.md).
