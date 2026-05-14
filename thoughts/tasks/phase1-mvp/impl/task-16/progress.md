Status: DONE

What you implemented
- Added `checkAll({ linearTokenPath })` to `src/main/services/auth-checker.ts`.
- `checkAll` composes auth status by running:
  - `checkLinearToken(opts.linearTokenPath)`
  - `checkCli('claude --version')`
  - `checkCli('codex --version')`
  - and returning `{ linear, claudeCode, codex }`.
- Extended `tests/main/auth-checker.test.ts` to cover composition behavior:
  - Added `checkAll` import.
  - Added a typed-mocked `tryExec` scenario using `vi.mocked(tryExec)` and existing `tryExecMock`.
  - Added assertion that token + CLI outcomes compose to `{ linear: true, claudeCode: true, codex: false }`.

What you tested and test results, including initial failing test
- `npx vitest run tests/main/auth-checker.test.ts` (with `checkAll` test added, before `checkAll` implementation): **FAIL** (`TypeError: checkAll is not a function`).
- `npx vitest run tests/main/auth-checker.test.ts` (after adding `checkAll`): PASS (6 tests).
- `npm run test`: PASS (10 files, all tests pass).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with existing warning (`tests/main/paths.test.ts` unused `vi`).
- `npm run format:check`: PASS.

Files changed
- `src/main/services/auth-checker.ts`
- `tests/main/auth-checker.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-16/progress.md`

Self-review findings
- Composition remains purely local-surface checks and introduces no auth side effects (no login calls).
- Reuses existing helpers (`checkCli`, `checkLinearToken`) and typed mocking pattern from prior task.
- Cyclomatic complexity is within constraints and no new abstractions were introduced.
- Type usage is explicit and avoids `any` casts.

Tech-debt logged
- None introduced.

Commits made
- `b97e18b` — `feat(main): compose AuthStatus across Linear/claude/codex` (files: `src/main/services/auth-checker.ts`, `tests/main/auth-checker.test.ts`)

Concerns
- If this task is run in an environment where `codex`/`claude` binaries are slow/unavailable, `checkAll` is limited to command presence and does not validate credentials depth; this is by design and aligns with existing local auth checks.

Model Choice Audit
Implementer model: gpt-5.3-codex-spark
