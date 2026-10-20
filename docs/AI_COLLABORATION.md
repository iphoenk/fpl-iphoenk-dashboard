# AI collaboration

1. Read AGENTS.md and architecture before changes.
2. Open a focused issue with expected behavior and acceptance checks.
3. Work on a feature branch; one writer per file. Other AIs can review the PR or provide a patch without Vercel credentials.
4. Test data guards and user flows. Check desktop, tablet and phone, light and dark themes, missing-data and network-error states.
5. Open a PR describing the problem, final behavior, validation and screenshots. Review changes before merging.
6. Deploy only with user authorization and verify the production URL. Never claim a local change is live.

Keep model-specific guidance in CLAUDE.md and GEMINI.md as pointers to the shared rules. Do not copy credentials into prompts, issues or commits. Do not automatically give an AI new access to private services.


Canonical public repository: https://github.com/iphoenk/fpl-iphoenk-dashboard. Public read access does not grant write access: Claude/Gemini must use an authorized connector or fork and pull request. Coordinate the task, branch and changed-file list before edits; one writer owns each file. Python xP changes belong to the focused feature branch until reviewed and merged. Never upload `.model-data/`, environment files or private Blob contents to the public repository. Production belongs to the existing `fpl-iphoenk` Vercel project, not the legacy project.
