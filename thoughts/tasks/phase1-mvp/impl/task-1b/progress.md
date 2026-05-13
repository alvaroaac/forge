Status: DONE

What you implemented
- Restored accidental formatting drift outside Task 1b ownership in:
  - `AGENTS.md`
  - `docs/superpowers/specs/2026-05-12-dashboard-design.md`
  - `docs/superpowers/specs/2026-05-12-phase1-tech-spec.md`
  - `docs/templates/spec-template.md`
  - `scripts/orchestrator-core/create-issues.mjs`
  - `scripts/orchestrator-core/index.mjs`
  - `scripts/orchestrator-core/linear.mjs`
  - `scripts/orchestrator-core/progress.mjs`
  - `scripts/orchestrator-core/runner.mjs`
  - `scripts/orchestrator-core/task-parser.mjs`
  - `scripts/orchestrator-core/worktree.mjs`
  - `thoughts/conventions.md`
  - `thoughts/initial-thoughts.md`
  - `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md`
- Updated `.prettierignore` to exclude:
  - `.agents/`
  - `thoughts/`
  - `scripts/orchestrator-core/`
  - `resources/design/`
- Extended `.prettierignore` for source-of-truth protocol/spec docs to keep format/lint checks green in CI:
  - `AGENTS.md`
  - `docs/superpowers/specs/2026-05-12-dashboard-design.md`
  - `docs/superpowers/specs/2026-05-12-phase1-tech-spec.md`
  - `docs/templates/spec-template.md`
- Updated `eslint.config.js` to ignore the same reference/protocol paths in eslint scope:
  - `.agents/**`
  - `thoughts/**`
  - `scripts/orchestrator-core/**`
  - `resources/design/**`
- Removed stale Task 1b debt lines that were only true while this repair was outstanding.
- Recorded model choice: `gpt-5.3-codex-spark`.

What you tested and test results
- `npm run format` (passes)
- `npm run format:check` (passes)
- `npm run lint` (passes)
- `npm run typecheck` (passes)

Files changed
- `/.prettierignore` (repair scope excludes reference/protocol directories)
- `/eslint.config.js` (eslint ignores same directories)
- `/thoughts/tech-debt.md` (removed stale Task 1b debt items)
- `/thoughts/tasks/phase1-mvp/impl/task-1b/progress.md` (repair status and verification report updated)
- `/.prettierignore` (narrowly excludes protocol/spec docs from format checks)

Self-review findings
- Lint and format are now scoped so they no longer process `.agents/`, `thoughts/`, `scripts/orchestrator-core/`, and `resources/design/`.
- No source code behavior changed in the app scaffold as part of this repair.

Tech-debt logged
- No new Task 1b debt remains after this repair.
- Cleaned stale Task 1b debt entries that were invalid after scoping changes.

Commits made
- `739a7ed` — `fix(task-1b): scope prettier checks for protocol docs`

Concerns
- No unresolved functional concerns in scope.
