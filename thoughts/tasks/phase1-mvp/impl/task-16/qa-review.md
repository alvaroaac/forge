# Task 16 QA Review (Phase 1 MVP): `checkAll`

✅ Approved

## Strengths

- `checkAll` is simple, fully typed (`Promise<AuthStatus>`), and comfortably under the cyclomatic complexity cap (no branching; just `Promise.all` + return). See [auth-checker.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/auth-checker.ts:22).
- The composition is strictly “local auth checks” only: it reuses existing `checkLinearToken` + `checkCli` and probes CLI presence via `claude --version` / `codex --version` (no login/auth side effects). See [auth-checker.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/auth-checker.ts:22).
- Existing `checkCli` and `checkLinearToken` behavior remains intact; Task 16 only adds the `AuthStatus` type import and the new exported function. See [auth-checker.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/auth-checker.ts:6).
- Tests are type-safe and don’t use `any`, `@ts-ignore`, `@ts-expect-error`, or suppression comments. `tryExec` is mocked via `vi.mock` and exercised through `vi.mocked(tryExec)`; the new test asserts actual composed output. See [auth-checker.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/auth-checker.test.ts:1).
- Progress report is materially accurate (commit hash/message/files and the claimed command outcomes match the current tree).

## Issues

### Critical

- None.

### Important

- None.

### Minor

- Repo lint baseline still includes the pre-existing ESLint warning: unused `vi` import in [paths.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/paths.test.ts:1). Task 16 did not introduce or worsen this, and `npm run lint` still exits 0 (warning-only).

## Drift detected

- Repeated (pre-existing) drift pattern (Tasks 10–15 QA history): the same non-fatal ESLint unused-import warning in `tests/main/paths.test.ts` continues to appear in “commands should pass” runs. Task 16 does not add new warnings.
- Previously-noted drift outside Task 16 scope remains present: `.agents/skills/linear/reference/linear.mjs` JSDoc for `fetchAssignedIssues` still claims an `issueType` field that is not selected in the GraphQL query. See [.agents/skills/linear/reference/linear.mjs](/Users/alvarocarvalho/desenv/personal/forge/.agents/skills/linear/reference/linear.mjs:456).

## Assessment

All requested commands pass on the current working tree:

- `npx vitest run tests/main/auth-checker.test.ts`: PASS
- `npm run test`: PASS
- `npm run lint`: PASS (with 1 pre-existing warning in `tests/main/paths.test.ts`)
- `npm run typecheck`: PASS
- `npm run format:check`: PASS

No blocking code-quality issues remain in Task 16 scope.

