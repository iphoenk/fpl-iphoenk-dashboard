# Adoption backlog and license requests

Updated: 2026-10-25. Source of truth for status is `credits.json`; this file holds the work items. Rule: ideas only unless a verified MIT LICENSE file exists. When an item ships, flip its `credits.json` entry and keep the About page honest.

## Already in the dashboard (checked 2026-10-25)

Built independently, no code copied. Existence in code does not prove which repository inspired it. `credits.json` field `implemented` lists these; `adopted` lists ideas still under evaluation.

- xGI and defensive-contribution analysis; data-quality panel (JonnoMillar ideas)
- Pre-deadline prediction archive, server-side and never overwritten; multi-gameweek transfer evaluation (jorgefhernandezg ideas)
- Free-transfer reconstruction from public history (avgcloudwizard idea)
- Mini-league awards (thinesrao idea); league differential metrics (j-maslin idea)

Remaining gaps: Monte Carlo percentiles and head-to-head (blocked: fpl-iphoenk-mc has only README), minutes model, odds to xG, daily price-change record, pre-deadline audit journal, last-good snapshot, linking the prediction archive to V12.

## Backlog by target

| # | Item | Idea source | Target | Notes |
|---|---|---|---|---|
| 1 | Frozen prediction ledger (immutable pre-deadline predictions, settled after the GW) | jorgefhernandezg | V12 | Prerequisite for any claim about model accuracy |
| 2 | Minutes model (starter probability, 60+ minutes) | jorgefhernandezg | V12 | Feed into expected points; validate against ledger first |
| 3 | Per-game vs per-90 methodology with a minimum-minutes cut-off | requiemalex | V12 | Avoids small-sample inflation |
| 4 | Source-health block and stale banner; last-good snapshot | JonnoMillar, avgcloudwizard | V6, Dashboard | Missing is not zero; show age of data |
| 5 | Bookmaker odds to xG and clean-sheet probability | JonnoMillar | V12 | Needs a licensed odds source, check terms first |
| 6 | Daily record of official price changes as own history | Doocey | V6 | Own data from Official FPL, no copying |
| 7 | Gated scheduled refresh (script decides if a refresh is due) | avgcloudwizard | V6 | Cuts Actions minutes; keep one scheduler |
| 8 | Free-transfer reconstruction from public history | avgcloudwizard | V6, Dashboard | Label as reconstruction, not account truth |
| 9 | Percentile (10/50/90) and head-to-head outputs; compare with own MC | ahmedrashadtxt (MIT) | MC | See MC notes below |
| 10 | Pre-deadline snapshot audit journal | ahmedrashadtxt (MIT) | V12, private reports | |
| 11 | Mini-league awards, differential and popular-captain metrics | thinesrao (MIT), j-maslin | Dashboard | Low priority |

## MC notes (fpl-iphoenk-mc)

As of 2026-10-25 the repository contains only README.md: no simulation code exists yet, so there is nothing to compare against ahmedrashadtxt's Monte Carlo. Before implementing, decide and write down in the MC repo: what the simulation outputs (percentiles, rival win probability), what is frozen at deadline, and how results are settled against actual points. Browser never runs MC; the dashboard only reads validated published outputs.

## Licence request text (post manually; this session has no access to those repositories)

Title: Licence for fpl-insights (JonnoMillar), jorgefhernandezg/fpl-dashboard, avgcloudwizard/wireless

Body:

> Hi, I maintain a private FPL dashboard and found your repository useful for research. I could not find a LICENSE file. Without one I treat the code as all rights reserved and only reimplement ideas independently, crediting you on our About page. If you are open to adding a licence (for example MIT), I could then reuse small parts with proper notice. No reply needed if you prefer to leave it as is. Thank you.

Post one issue per repository, using the repository name in the title.
