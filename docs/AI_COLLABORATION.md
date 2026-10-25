# AI collaboration and source governance

This policy applies to ChatGPT, Claude, Gemini, human contributors, and automation working on the FPL iphoenk dashboard.

## Workflow
1. Read README.md, AGENTS.md, and docs/ARCHITECTURE.md before modifying code.
2. Define a focused issue or task with expected behavior, affected files, and acceptance criteria.
3. Work on a feature branch. Assign one writer per file; other agents review or propose patches. Never overwrite parallel edits.
4. Validate factual authority, decision-engine boundaries, data provenance, and error/degraded behavior.
5. Run tests, builds, browser checks, and actual UI flows at phone, tablet, and desktop widths in both themes.
6. Open a PR describing changes, validation, screenshots where relevant, risk, and rollback. Require review before merging.
7. Deploy only with user authorization. Verify Vercel deployment status and production UI; never claim a push means live.

## No unauthorized source copying
Publicly readable code is not automatically reusable. Before using external source, code snippets, libraries, designs, images, models, or datasets:
- Identify the exact origin and repository URL, relevant version/commit, copyright owner where known, and applicable license or permission.
- Check whether the proposed use, modification, distribution, attribution, and any reciprocal obligations are permitted.
- Prefer original implementations of concepts over copying. Cosmetic rewrites of copied code are not independent implementations.
- Retain copyright notices, license texts, attribution, and modification notices whenever required.
- Review AI-generated contributions for potential unauthorized reproduction; model output does not eliminate licensing obligations.
- Record the provenance and license assessment in the PR, including any required third-party notices.
- If licensing or origin is unclear, block the affected change pending human review. Automated license scanners are supporting checks, not proof of legal clearance.

These rules apply in particular to FPLens, FPL Insights, other public FPL repositories, and any private V6/V12 code. Using public forecast data with appropriate attribution is distinct from copying a provider's source code; verify the data's terms separately.

## Pull request acceptance checklist
- [ ] Change scope and file ownership are documented.
- [ ] No unapproved third-party code, assets, models, or datasets were copied.
- [ ] External dependencies and reused materials have verified provenance and compatible licenses.
- [ ] Required notices and attribution are preserved.
- [ ] No credentials, private data, private model artifacts, or proprietary engine code are exposed.
- [ ] Official FPL facts and Canonical V12 decision boundaries are respected.
- [ ] No fabricated account state, forecasts, news, or unsupported production claims.
- [ ] Tests, builds, and relevant browser/UI acceptance checks pass.
- [ ] Reviewer approval is recorded; deployment authorization is separate.

## Access and project boundaries
Canonical repository: https://github.com/iphoenk/fpl-iphoenk-dashboard.
Public read access does not grant write access. Agents need an authorized connector, or an authorized fork and pull request. Never grant new private-service access automatically.

Keep CLAUDE.md and GEMINI.md as pointers to shared instructions. Do not copy secrets into prompts, issues, PRs, or commits. Do not upload .model-data/, environment files, or private Vercel Blob contents.

The production Vercel project is fpl-iphoenk, not the legacy project. The dashboard is a public companion; private Canonical V12 and its scheduler remain separately governed.
