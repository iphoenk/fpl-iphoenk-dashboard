# Architecture

Browser UI is composed from ui.html, ui.js and ordered extensions listed in both build scripts. dashboard-focus.js contains the Overview time toggle, local next-GW captain draft, dashboard brief and personalized news composition. Themes use CSS variables and theme.js.

server.mjs restricts upstream API paths. api/index.js adapts it for Vercel; the alternative Worker build uses the same handler. Never add arbitrary URL forwarding. Official FPL is the canonical source for published squad and football data. Snapshot identity and GW guards prevent mixing seasons and player mappings.

The current dashboard does not call the FPL-iphoenk-engine V6 or V12 interfaces. V6 is a possible future factual freshness/provenance layer. V12 is an optional advisory counterpart; neither should be represented as active until a governed read-only contract, validation and deployment are implemented. Private engine reports and scheduling controls must not become browser data.

Production is deployed to the existing Vercel project, not a new project. GitHub Actions provides independent test/build verification. Secrets are not in this repository.


The canonical repository is https://github.com/iphoenk/fpl-iphoenk-dashboard and the Vercel project is `fpl-iphoenk`, serving https://fpl-iphoenk.vercel.app. Python source is retained in this repository but excluded from the Vercel upload because it is a manual offline batch, not a request runtime. The production runtime remains Node.js; the browser uses JavaScript/CSS/HTML. JSON is the interchange format, not a streaming broker.

`python_xp` validates Official inputs and computes experimental position-aware contributions. Trusted `scripts/publish-own-model.mjs` revalidates current context, writes private `own-model/v1/2026/gwN/0.1.1/latest.json`, and captures the first eligible immutable `forecasts/v1/2026/gwN/fpl-iphoenk-python-v1.json`. The read-only `/api/own-model` route validates freshness, identity, scoring and fixtures, suppressing changed player availability. No model calculation happens on requests. The browser calls it only on explicit opt-in, holds it in memory and drops it at expiry. Worker builds return unavailable for this private-store feature. All other providers remain independent.

The optional comparison response selects at most20 explicit player IDs (or10 highest pool predictions), keeping the full artifact private. Only successful validated responses use a30-second in-process/CDN cache, capped by expiry, with no stale-on-error reuse. The browser remains no-store and checks current identity/availability again. Cold requests still require Official and Blob validation; subsequent edge hits avoid that work.
