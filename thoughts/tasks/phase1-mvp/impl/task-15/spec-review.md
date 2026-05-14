# Spec Review — Task 15

Verdict: ✅

## Requirements Check

- Modify `src/main/services/auth-checker.ts` and `tests/main/auth-checker.test.ts`: ✅
  - `src/main/services/auth-checker.ts:3-8` imports `tryExec` and exports `checkCli(command)` returning `r.ok`.
  - `tests/main/auth-checker.test.ts:5-33` adds `checkCli` coverage.

- Add tests for `checkCli`: ✅
  - True when mocked `tryExec` resolves `{ ok: true }`: `tests/main/auth-checker.test.ts:24-27`.
  - False when mocked `tryExec` resolves `{ ok: false }`: `tests/main/auth-checker.test.ts:29-32`.

- Mock `../../src/main/lib/exec` `tryExec` with `vi.fn` and avoid unreasoned `any`: ✅
  - Mock: `tests/main/auth-checker.test.ts:8-10` uses `vi.mock('../../src/main/lib/exec', () => ({ tryExec: vi.fn() }))`.
  - Typed mock: `tests/main/auth-checker.test.ts:12` uses `vi.mocked(tryExec)`; no `any` usage observed in this file.

- TDD signal: initial test should fail because `checkCli` not exported: ✅ (recorded)
  - `thoughts/tasks/phase1-mvp/impl/task-15/progress.md:16` documents the pre-implementation failure (`checkCli is not a function`).

- Complexity 1: ✅
  - `checkCli` is a single `await` + return (`src/main/services/auth-checker.ts:5-8`).

- Run task test + full checks; commit message: ✅ (recorded + verified)
  - Commands recorded in `thoughts/tasks/phase1-mvp/impl/task-15/progress.md:16-22`.
  - Commit exists and matches required message: `c193be9` — `feat(main): CLI presence check via tryExec` (verified via `git show`); commit changes only:
    - `src/main/services/auth-checker.ts`
    - `tests/main/auth-checker.test.ts`

## Addendum / Conventions Check

- Phase 1 addendum (don’t rewrite reference/protocol dirs): ✅
  - Task 15 commit scope is limited to the two intended code files (no `thoughts/` formatting churn in the commit).
- Conventions (no `any` without reason): ✅ (no `any` introduced in the reviewed files).

