Status: DONE

What you implemented
- Added `checkCli` to `src/main/services/auth-checker.ts`:
  - Uses `tryExec` from `../lib/exec`.
  - Returns `r.ok` to indicate whether the CLI command executes successfully.
- Added `checkCli` test coverage to `tests/main/auth-checker.test.ts` with typed mocking:
  - Mocks `tryExec` via `vi.mock('../../src/main/lib/exec', () => ({ tryExec: vi.fn() }))`.
  - Uses `const tryExecMock = vi.mocked(tryExec)` for typed responses.
  - Verifies `checkCli('claude --version')` returns `true` on `{ ok: true }`.
  - Verifies `checkCli('claude --version')` returns `false` on `{ ok: false }`.
  - Kept existing `checkLinearToken` tests intact.
- Ensured mocks are reset between tests with `vi.clearAllMocks()`.

What you tested and test results, including initial failing test
- Ran `npx vitest run tests/main/auth-checker.test.ts` (before implementation): FAIL — `checkCli is not a function` (expected because export was missing).
- Ran `npx vitest run tests/main/auth-checker.test.ts` (after implementation): PASS (5 tests).
- Ran `npm run test`: PASS (all test files).
- Ran `npm run typecheck`: PASS.
- Ran `npm run lint`: PASS with existing pre-existing warning in `tests/main/paths.test.ts` (`'vi' is defined but never used`).
- Ran `npm run format:check`: PASS.

Files changed
- `src/main/services/auth-checker.ts`
- `tests/main/auth-checker.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-15/progress.md`

Self-review findings
- The implementation follows existing conventions with no `any` usage.
- Mock placement and typed mocking align with no-unsafe-test expectations.
- `checkCli` is a small, side-effect free utility and keeps complexity low.
- `checkLinearToken` behavior remains unchanged.

Tech-debt logged
- None for this task.

Commits made
- `c193be9` — `feat(main): CLI presence check via tryExec` (files: `src/main/services/auth-checker.ts`, `tests/main/auth-checker.test.ts`)

Concerns
- Lint warning in `tests/main/paths.test.ts` is unrelated to this task and pre-existing in repository baseline.
- `test` suite and repo formatting checks are now green; only residual warning from unrelated file may affect future strict lint gates depending on CI configuration.

Model Choice Audit
Implementer model: gpt-5.3-codex-spark
