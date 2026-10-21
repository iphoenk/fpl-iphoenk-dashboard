# FPL iphoenk dashboard

Responsive FPL dashboard with official public squad data, classic leagues, scouting, transfer simulations, player news, watchlist and evaluation.

## Run and verify

Node.js 24 recommended; no package dependencies required.

```
npm test
npm run build:vercel
npm run check:browser
npm run build
npm run dev
```

Local preview: http://127.0.0.1:4173. Production: https://fpl-iphoenk.vercel.app.

## Collaboration

Read AGENTS.md, docs/ARCHITECTURE.md and docs/AI_COLLABORATION.md. Claude and Gemini entry points share the same instructions. Use one feature branch per task and a pull request; GitHub Actions checks tests and both builds. The repository does not contain deployment credentials.

## Data and limits

Official FPL supplies public identities, prices, fixtures, status, points and published GW picks. Overview switches between This GW results and Plan Next GW: the latter starts from the last published squad, shows official ep_next estimates and stores a local captain draft per team and GW. It cannot read unpublished picks or send account changes. Captain draft is x2; no chip activation is assumed.

Prediction snapshots come from FPLens (https://github.com/abdelmalek-maskri/fplens), and supplementary public scouting snapshots from FPL Insights (https://github.com/JonnoMillar/fpl-insights), validated against current identities, deadline and GW. Source attribution is retained. News uses Guardian/FPL updates; a separate fixed-source public RSS endpoint is available for further integration. Community reports are not official confirmation.

V6/V12 engine integration is NOT active in this dashboard. See architecture notes before adding it. This is an independent companion, not affiliated with Premier League.

## Deployment

Vercel project: fpl-iphoenk, production domain fpl-iphoenk.vercel.app. Build: node scripts/build-vercel.mjs; static output public; serverless proxy api/index.js. .vercel and .env files stay local and untracked. A Git push alone is not proof that production deployed: check Vercel status and the actual production UI.

## Phase one checkpoint

Overview now reports independent source freshness, identity/deadline validity and model player coverage. Accuracy has a separate private forecast archive: first server capture per season/GW/source, immutable path, SHA-256 integrity, no capture after deadline. Capture happens on Overview visit or explicit action; there is no unattended scheduler guarantee. Actual evaluation waits for Official finished fixtures plus event.data_checked. Failed optional sources do not erase Official FPL functionality.

Vercel Blob is a private store connected by server environment configuration. Neither token nor forecast data belongs in Git. Runtime dependencies are locked in package-lock.json; run npm ci before tests on a clean checkout. See docs/checkpoints/2026-10-19-phase-one.md for baseline deployment and rollback. Phase two remains separate.


## Experimental independent Python xP

Python 3.12 standard library computes a manual next-GW baseline per GK/DEF/MID/FWD from final, checked Official FPL history. It does not run inside Vercel or a page request. Existing predictions remain the default; the optional comparison loads JSON only after clicking **Muat model Python** in Model Insights, Planning or Plan Next GW. Player details show components after opt-in. Accuracy keeps the first eligible forward capture, with evaluation only after final checked results.

```sh
python -m unittest discover -s tests_python -v
python -m python_xp acquire --output .model-data/input.json
python -m python_xp predict --input .model-data/input.json --output .model-data/prediction.json
node --env-file=.env.own-model.local scripts/publish-own-model.mjs .model-data/prediction.json
```

The trusted publication command needs the existing private Vercel Blob credential in its ignored environment file. Do not commit generated input, predictions or credentials. Artifacts expire six hours after the oldest input acquisition or at deadline. Updating requires another explicit batch; there is no scheduler or background browser refresh. Missing observations stay unavailable, never zero. The model is experimental and has no demonstrated accuracy advantage yet. It excludes unsupported tactical/coach/formation-fit scores and does not feed transfer or rival decisions automatically.
