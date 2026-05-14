# Task 15 QA Review (Phase 1 MVP): `checkCli`

✅ Approved

## Strengths

- `checkCli(command)` is minimal, typed, and comfortably under the cyclomatic complexity cap (single `await` + return). It delegates solely through `tryExec` and returns `r.ok` without introducing extra branching. ([auth-checker.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/auth-checker.ts:1))
- Tests for `checkCli` are straightforward and type-safe: `tryExec` is mocked via `vi.mock`, then exercised through `vi.mocked(tryExec)` without `any`, `@ts-ignore`, or suppression comments. ([auth-checker.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/auth-checker.test.ts:1))
- `checkLinearToken` behavior remains intact; Task 15 only adds `checkCli` and does not modify the existing token check logic. Verified via `git show c193be9` and current source. ([auth-checker.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/auth-checker.ts:9))
- Progress report is materially accurate: commit `c193be9` exists with the stated message and only touches `src/main/services/auth-checker.ts` + `tests/main/auth-checker.test.ts`, and the claimed verification outcomes match reruns.

## Issues

### Critical

- None.

### Important

- None.

### Minor

- Repo lint baseline still includes the pre-existing warning introduced in Task 10: unused `vi` import in [paths.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/paths.test.ts:1). This task did not introduce it, but `npm run lint` continues to emit it (warning-only, exit code 0).

## Drift detected

- Repeated (pre-existing) drift pattern confirmed from Tasks 10–14 QA reviews: the same non-fatal ESLint unused-import warning in `tests/main/paths.test.ts` remains present in “commands should pass” runs. Task 15 does not worsen or add new warnings.
- Other previously-noted drift outside Task 15 scope (Tasks 5–9): `.agents/skills/linear/reference/linear.mjs` JSDoc overpromises an `issueType` property for `fetchAssignedIssues` relative to its selection set. Not introduced or touched here, but still an open recurring note in the QA history.

## Assessment

All requested commands pass on the current working tree:

- `npx vitest run tests/main/auth-checker.test.ts`: PASS
- `npm run test`: PASS
- `npm run lint`: PASS (with 1 pre-existing warning in `tests/main/paths.test.ts`)
- `npm run typecheck`: PASS
- `npm run format:check`: PASS

No blocking code-quality issues remain in Task 15 scope.

