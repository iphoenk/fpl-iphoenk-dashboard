# Architecture

Browser UI is composed from ui.html, ui.js and ordered extensions listed in both build scripts. dashboard-focus.js contains the Overview time toggle, local next-GW captain draft, dashboard brief and personalized news composition. Themes use CSS variables and theme.js.

server.mjs restricts upstream API paths. api/index.js adapts it for Vercel; the alternative Worker build uses the same handler. Never add arbitrary URL forwarding. Official FPL is the canonical source for published squad and football data. Snapshot identity and GW guards prevent mixing seasons and player mappings.

The current dashboard does not call the FPL-iphoenk-engine V6 or V12 interfaces. V6 is a possible future factual freshness/provenance layer. V12 is an optional advisory counterpart; neither should be represented as active until a governed read-only contract, validation and deployment are implemented. Private engine reports and scheduling controls must not become browser data.

Production is deployed to the existing Vercel project, not a new project. GitHub Actions provides independent test/build verification. Secrets are not in this repository.
