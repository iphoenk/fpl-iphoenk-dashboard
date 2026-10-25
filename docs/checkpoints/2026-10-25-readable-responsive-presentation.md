# Readable responsive presentation

Issue #205. Owned presentation code, no copied external UI or runtime reference-app dependency.

The final presentation.css sheet is included in both ordered builds. It keeps
the approved green pitch, sidebar/dock navigation, light/dark theme tokens and
page structure. Shared paragraphs use 14px, tables 13px, pitch data labels at
least 12px, and mobile inputs 16px to avoid automatic text zoom. Section headings
use a restrained 20–26px scale. Dense tables scroll inside their container;
Awards cards and long names reflow rather than shrinking text.

Pitch portraits and jersey fallbacks reserve proportional media sizes. Tablet
planner cards stack when the available width is insufficient. Form, card and
section spacing is shared across the 17 routes. Reduced motion is respected.

Browser coverage: 393/768/1440, both themes, all 17 routes; plus the existing
Overview breakpoint, league/Awards and six-player Compare flows. Assertions
check actual computed text sizes, document containment and core-panel overlap.
The harness waits for DOM readiness, populated picks and stable geometry;
unrelated remote font/image load completion is not an app readiness condition.

The initial baseline had 294 passing JavaScript tests and one 1024px dark browser
load timeout among 30 tests. The baseline screenshot/font inventory is retained
in the owner-local QA folder. Screenshots use frozen public fixtures and are not
proof of current live scores or physical-device Safari acceptance.

Final local validation: 294 JavaScript tests and all 36 browser tests passed.
The latter includes 102 route/viewport/theme combinations, Overview breakpoints,
league pagination/partial errors, Compare selection and missing statistics.
Both builds, browser syntax and whitespace checks passed. A fresh-context review
found no Important/Critical issue in the presentation diff. CI links are recorded
on the focused PR. No production
promotion, model weights, scores, account settings or scheduler changes here.
