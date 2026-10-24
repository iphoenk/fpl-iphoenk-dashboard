# External FPL dashboard adoption registry

Updated: 2026-10-25

This registry records external repositories reviewed or adopted as implementation references. The external repositories are not decision authorities. Official FPL remains authoritative for official fields; V6 owns factual acquisition and provenance; Canonical V12 owns decision contracts; MC500K remains owned by the FPL iphoenk engine.

## Adoption policy

- Code is copied only when the source license permits it and the copied material keeps attribution and required notices.
- For repositories without a clear license, we implement the useful behavior independently and credit the repository as a reference.
- External data and models cannot overwrite Official FPL truth.
- No external repository may create a second optimizer, scheduler, or recommendation authority.
- Browser code never runs MC500K. The dashboard consumes only validated, published engine artifacts.

## Registry

| Source | Role adopted or reviewed | Target | License handling | Status |
|---|---|---|---|---|
| [Doocey/fpl-dashboard](https://github.com/Doocey/fpl-dashboard) | Price history and scheduled refresh pattern | V6, Dashboard | Reference only unless license is clarified | Reviewed |
| [thinesrao/fpl-dashboard-streamlit](https://github.com/thinesrao/fpl-dashboard-streamlit) | Mini-league awards and historical league analytics | Dashboard | MIT stated in repository | Candidate |
| [j-maslin/fpl-dashboard](https://github.com/j-maslin/fpl-dashboard) | Compact wallboard and adaptive league charts | Dashboard | Reference only unless license is clarified | Reviewed |
| [JonnoMillar/fpl-insights](https://github.com/JonnoMillar/fpl-insights) | xGI, defensive contribution, fixture, captaincy, availability and degraded evidence patterns | V6, V12, Dashboard | Reference and independent reimplementation unless license is clarified | Candidate |
| [jorgefhernandezg/fpl-dashboard](https://github.com/jorgefhernandezg/fpl-dashboard) | Public dashboard reference | Dashboard | Reference only unless license is clarified | Reviewed |
| [requiemalex/fpl-analytics-dashboard](https://github.com/requiemalex/fpl-analytics-dashboard) | Normalization, per-record validation, retries, timeout, cache, stale fallback and provenance | V6, Dashboard | Reference and independent reimplementation unless license is clarified | Candidate |
| [uixori-code/fpl-fantasy-dashboard](https://github.com/uixori-code/fpl-fantasy-dashboard) | Public Team ID UX and separated data-fetch scripts | Dashboard | Reference only unless license is clarified | Reviewed |
| [avgcloudwizard/wireless](https://github.com/avgcloudwizard/wireless) | One complete snapshot, last-good retention, freshness, net score and free-transfer reconstruction | V6, Dashboard | Reference only unless license is clarified | Candidate |
| [ahmedrashadtxt/fpl-strategic-dashboard](https://github.com/ahmedrashadtxt/fpl-strategic-dashboard) | Deterministic constraints, transfer friction and audit-journal concepts | V12, private reports | MIT stated in repository | Candidate |
| [dhruvgupta2109/fplmanager](https://github.com/dhruvgupta2109/fplmanager) | Guest Team ID, pitch, fixtures and rank-trend UX | Dashboard | MIT stated in repository | Reviewed |
| [pdamkier-del/fpl-analytics-app](https://github.com/pdamkier-del/fpl-analytics-app) | Model versioning and updater separation | Private reports | Reference only unless license is clarified | Reviewed |
| [maballouk/fplanalytic](https://github.com/maballouk/fplanalytic) | TypeScript structure and test organization | Dashboard | Reference only unless license is clarified | Reviewed |

## Internal authority map

| Capability | Owner |
|---|---|
| Official FPL facts | Official FPL through V6 |
| Source health and provenance | V6 |
| Deterministic decision and optimization contract | Canonical V12 |
| MC500K probability/evidence calculation | FPL iphoenk engine |
| Private authenticated report | fpl-reports-private |
| Public presentation | fpl-iphoenk-dashboard |
| Credits and attribution display | Dashboard About page |

Every future adoption must add a row here and a regression test or contract note when it changes runtime behavior.
