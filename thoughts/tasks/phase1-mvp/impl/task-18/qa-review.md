# Task 18 QA Review (Phase 1 MVP): `mapIssue` + `fetchIssues`

✅ Approved

## Strengths

- `mapIssue` and `fetchIssues` are simple, fully typed, and well under the cyclomatic complexity cap (straight-line functions). See `src/main/services/linear-service.ts`.
- Mapping behavior is correct and composes the Task 7–9 helpers (`mapPriority`, `mapStatus`, `isBug`) rather than duplicating mapping logic. See `src/main/services/linear-service.ts:1-45` and `src/main/services/linear-mapping.ts`.
- Null-description normalization is handled explicitly (`raw.description ?? ''`) and covered by a focused test case. See `src/main/services/linear-service.ts:32` and `tests/main/linear-service.test.ts:35-51`.
- Existing `fetchRaw` behavior remains intact (same typed client shape, same `getCurrentUser()` then `fetchAssignedIssues(me.id)` sequence). Compared current implementation against the pre-Task-18 version (commit `adce6d1`).
- The test additions are meaningful:
  - One full mapping assertion (status/priority/labels/isBug/updatedAt/url passthrough).
  - One null-description case that also asserts status/priority/isBug defaults.
  See `tests/main/linear-service.test.ts`.
- Progress report is accurate enough for audit and includes concrete red-step evidence (parent snapshot run failing with `TypeError: mapIssue is not a function`) plus a complete command list with outcomes. See `thoughts/tasks/phase1-mvp/impl/task-18/progress.md`.
- Addendum/tooling-scope constraint appears respected: Task 18 work is confined to app-owned `src/` + `tests/` plus the task artifact (no opportunistic rewrites to `.agents/`, `thoughts/` protocol dirs beyond task artifacts, `resources/design/`, or `scripts/orchestrator-core/`).

## Issues

### Critical

- None.

### Important

- None.

### Minor

- There is no direct unit test for `fetchIssues` (it is a trivial `raw.map(mapIssue)`, so this is not a blocker, but adding one would tighten regression coverage if/when `fetchIssues` grows behavior).
- Repo lint baseline still includes the pre-existing warning from Task 10: unused `vi` import in `tests/main/paths.test.ts` (`npm run lint` exits 0 with 1 warning). Task 18 does not introduce or worsen it.

## Drift detected

- Repeated (pre-existing) drift pattern (Tasks 10–17 QA history): the same non-fatal ESLint unused-import warning in `tests/main/paths.test.ts` continues to appear in “commands should pass” runs. Task 18 does not add new warnings.
- Previously-noted drift outside Task 18 scope remains present and untouched: `.agents/skills/linear/reference/linear.mjs` JSDoc for `fetchAssignedIssues` still claims an `issueType` field that is not selected in the GraphQL query (not introduced here).

## Assessment

I re-ran the requested command set on the current working tree; all pass:

- `npx vitest run tests/main/linear-service.test.ts`
- `npm run test`
- `npm run lint` (passes with 1 pre-existing warning in `tests/main/paths.test.ts`)
- `npm run typecheck`
- `npm run format:check`

No blocking code-quality issues remain in Task 18 scope.

