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

Vercel project: fpl-dugout, production domain fpl-iphoenk.vercel.app. Build: node scripts/build-vercel.mjs; static output public; serverless proxy api/index.js. .vercel and .env files stay local and untracked. A Git push alone is not proof that production deployed: check Vercel status and the actual production UI.
