✅ Spec compliant

Verified current Task 1b repo state, addendum compliance, and progress report accuracy.

Progress report check:
- `thoughts/tasks/phase1-mvp/impl/task-1b/progress.md:19-33` accurately describes the current tooling scope changes in `.prettierignore` and `eslint.config.js`.
- `thoughts/tasks/phase1-mvp/impl/task-1b/progress.md:37-41` accurately reports the four verification commands as passing.
- `thoughts/tasks/phase1-mvp/impl/task-1b/progress.md:57-58` now references a real repair commit (`36162eb`, `fix(task-1b): scope prettier checks for protocol docs`), so the prior hash mismatch is resolved.

Addendum compliance:
- `.prettierignore:1-16` excludes the approved reference/protocol material so repo-wide formatting does not rewrite `.agents/`, `thoughts/`, `scripts/orchestrator-core/`, or `resources/design/`. It also excludes the protocol/spec docs now used to keep checks green.
- `eslint.config.js:8-20` ignores the addendum-scoped reference/protocol directories for linting.

Task 1b requirements remain satisfied in the current tree:
- `README.md`, `LICENSE`, `.nvmrc`, `.editorconfig`, `.gitignore`, `package.json`, `eslint.config.js`, `.prettierrc.json`, and `.prettierignore` are present and consistent with the approved Task 1b scope and prior repair.

Command verification:
- `npm run format` — passes
- `npm run format:check` — passes
- `npm run lint` — passes
- `npm run typecheck` — passes

Tech-debt accounting check:
- No unresolved skipped/deferred Task 1b requirement remains unlogged.
