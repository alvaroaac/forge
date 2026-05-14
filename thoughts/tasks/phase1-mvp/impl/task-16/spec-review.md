# Task 16 — Spec Review (Phase 1 MVP)

Verdict: ✅

All Task 16 requirements appear satisfied based on repo state + `progress.md` evidence.

## Requirements Check

### 1) Modify `src/main/services/auth-checker.ts` and `tests/main/auth-checker.test.ts`
- `src/main/services/auth-checker.ts`: `checkAll` added/exported. (`src/main/services/auth-checker.ts:22-29`)
- `tests/main/auth-checker.test.ts`: `checkAll` imported and new composition test added. (`tests/main/auth-checker.test.ts:5, 51-60`)

### 2) Add test for `checkAll` composing Linear + claude + codex into `AuthStatus`
Meets the described scenario:
- Mocks `tryExec` first as ok=true (claude), then ok=false (codex). (`tests/main/auth-checker.test.ts:53-55`)
- Writes Linear token file (`access_token`). (`tests/main/auth-checker.test.ts:56-58`)
- Calls `checkAll({ linearTokenPath: p })`. (`tests/main/auth-checker.test.ts:58`)
- Expects `{ linear: true, claudeCode: true, codex: false }`. (`tests/main/auth-checker.test.ts:59`)

### 3) Final test avoids unreasoned `any`
- No `any` usage found in the added test; mock is typed via `vi.mocked(tryExec)`. (`tests/main/auth-checker.test.ts:12`)

### 4) Initial test should fail because `checkAll` not exported/function
- Not directly verifiable from git history (the failing state isn’t committed), but the implementer recorded the expected failure:
  - “FAIL (`TypeError: checkAll is not a function`)” when running the test before implementing `checkAll`. (`thoughts/tasks/phase1-mvp/impl/task-16/progress.md`)

### 5) Implementation details: import `AuthStatus`, export `checkAll(opts)` using `Promise.all`
- Imports `AuthStatus` type. (`src/main/services/auth-checker.ts:4`)
- Exports `checkAll(opts)` and uses `Promise.all` over:
  - `checkLinearToken(opts.linearTokenPath)`
  - `checkCli('claude --version')`
  - `checkCli('codex --version')`
  (`src/main/services/auth-checker.ts:22-27`)
- Returns `{ linear, claudeCode, codex }`. (`src/main/services/auth-checker.ts:28`)

### 6) Complexity 1
- `checkAll` is a single `Promise.all` + return; no branching. (`src/main/services/auth-checker.ts:22-29`)

### 7) Must not attempt login/auth side effects
- `checkAll` only checks token file presence/shape and CLI command availability; no login/auth mutation or side-effectful flows introduced. (Implementation: `src/main/services/auth-checker.ts:11-29`)

### 8) Run task test + full checks; commit message
- I verified current full test run passes: `npm test` PASS (10 files / 31 tests).
- Commit exists with required message:
  - `b97e18b feat(main): compose AuthStatus across Linear/claude/codex`
  - Includes the two required code files. (`git show --stat b97e18b`)

## Addendum Compliance
- No evidence of repo-wide formatting/linting changes to reference/protocol dirs as part of the task commit (`b97e18b` only touches the two code files above).

