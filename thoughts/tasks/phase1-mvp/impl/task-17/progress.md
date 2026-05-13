Status: DONE

What you implemented
- Added `src/main/services/linear-service.ts` with `LinearClientShape`, `RawLinearIssue`, and `fetchRaw(client)`.
- Implemented `fetchRaw` to resolve viewer info via `getCurrentUser()` and then fetch assigned issues via `fetchAssignedIssues(me.id)`.
- Added `tests/main/linear-service.test.ts` with a typed, plan-aligned test that mocks a local `LinearClientShape` implementation (no `any` usage).

What you tested and test results, including initial failing test
- Ran: `npx vitest run tests/main/linear-service.test.ts` → PASS (`1 passed`).
- Red-step audit evidence (pre-fix):
  - Created a snapshot of parent commit `b97e18b73e2fd3c40ac9e9a0388ba2d8d6c0db14` under `/tmp/forge-task17-audit` (from `git archive`) and copied in only the Task 17 test file.
  - Ran `npx vitest run tests/main/linear-service.test.ts` in that snapshot and got a module-resolution failure because `src/main/services/linear-service.ts` did not exist:

    `Error: Failed to load url ../../src/main/services/linear-service ... Does the file exist?`

  - This confirms the intended red-state before commit `adce6d1`.
- Ran: `npm run test` → PASS (all tests passing).
- Ran: `npm run typecheck` → PASS.
- Ran: `npm run lint` → PASS with existing warning in `tests/main/paths.test.ts` (`vi` unused), pre-existing in workspace and unrelated to this task.
- Ran: `npm run format:check` → PASS.

Files changed
- `src/main/services/linear-service.ts`
- `tests/main/linear-service.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-17/progress.md`

Self-review findings
- `fetchRaw` is intentionally small and has low complexity (single async flow with one branch).
- Test uses local `type LinearClientShape` and `RawLinearIssue`-compatible fixture via `satisfies` to avoid `any`.
- No UI or IPC boundaries are touched; this task stays in the main-process service layer as required.

Tech-debt logged
- None.

Model Choice Audit
- Implementer model: `gpt-5.3-codex-spark`

Commits made
- `feat(main): linear-service.fetchRaw via viewer id` (`adce6d1`)
 - `chore(task-17): record red-phase audit evidence`

Concerns
- None.
