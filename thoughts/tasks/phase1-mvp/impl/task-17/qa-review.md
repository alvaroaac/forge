# Task 17 QA Review (Phase 1 MVP): `linear-service.fetchRaw`

✅ Approved

## Strengths

- `fetchRaw(client)` is extremely small, fully typed, and well under the cyclomatic complexity cap (straight-line async flow). See [linear-service.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/linear-service.ts:18).
- `RawLinearIssue` is an appropriately-scoped “raw transport” shape for Task 18 mapping: it mirrors the current GraphQL selection set used by the Linear skill (`id`, `identifier`, `title`, `description`, `state`, `priority`, `labels`, `url`, `updatedAt`) without pulling in extra nested objects. See [linear-service.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/linear-service.ts:6) and the upstream query in [.agents/skills/linear/reference/linear.mjs](/Users/alvarocarvalho/desenv/personal/forge/.agents/skills/linear/reference/linear.mjs:488).
- The test is meaningful and type-safe: it uses a local typed `LinearClientShape`, mocks via `vi.fn()`, and uses `satisfies RawLinearIssue` for the fixture (no `any`, no suppression comments). See [linear-service.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/linear-service.test.ts:1).
- No Task 18 mapping work is pulled forward: the module contains only `RawLinearIssue` + `fetchRaw` (no `mapIssue`/normalization helpers, no derived domain types). See [linear-service.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/linear-service.ts:1).
- Addendum/tooling-scope constraints are respected: Task 17 touches only app-owned `src/` + `tests/` plus its `thoughts/` artifact (no opportunistic churn in `.agents/`, `thoughts/` protocol folders beyond the task artifact, `resources/design/`, or `scripts/orchestrator-core/`). Verified via `git show adce6d1 --name-only`.
- Progress report is materially accurate: commit hashes/messages/files and the claimed command outcomes match the current tree, and the red-phase audit evidence is concrete (pre-fix run fails because the module did not exist).

## Issues

### Critical

- None.

### Important

- None.

### Minor

- Repo lint baseline still includes the pre-existing ESLint warning: unused `vi` import in [paths.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/paths.test.ts:1). Task 17 did not introduce or worsen this, and `npm run lint` still exits 0 (warning-only).

## Drift detected

- Repeated (pre-existing) drift pattern (Tasks 10–16 QA history): the same non-fatal ESLint unused-import warning in `tests/main/paths.test.ts` continues to appear in “commands should pass” runs. Task 17 does not add new warnings.
- Previously-noted drift outside Task 17 scope remains present: `.agents/skills/linear/reference/linear.mjs` JSDoc for `fetchAssignedIssues` still claims an `issueType` field that is not selected in the GraphQL query. See [.agents/skills/linear/reference/linear.mjs](/Users/alvarocarvalho/desenv/personal/forge/.agents/skills/linear/reference/linear.mjs:456).

## Assessment

All requested commands pass on the current working tree:

- `npx vitest run tests/main/linear-service.test.ts`: PASS
- `npm run test`: PASS
- `npm run lint`: PASS (with 1 pre-existing warning in `tests/main/paths.test.ts`)
- `npm run typecheck`: PASS
- `npm run format:check`: PASS

No blocking code-quality issues remain in Task 17 scope.
