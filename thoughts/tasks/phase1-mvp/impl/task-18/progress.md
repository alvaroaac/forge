Status: DONE

Model Choice Audit: gpt-5.3-codex-spark

What you implemented
- Added `mapIssue` export in `src/main/services/linear-service.ts`.
- Implemented mapping from `RawLinearIssue` to shared `Issue` via `mapPriority`, `mapStatus`, and `isBug`.
- Added `fetchIssues` that calls `fetchRaw` and returns `raw.map(mapIssue)`.
- Extended `tests/main/linear-service.test.ts` with `mapIssue` coverage for full mapping and null-description normalization.

What you tested and test results, including initial failing test
- Ran parent snapshot validation (pre-implementation) to prove the red-step:
  - Used parent commit `14b1ecd^` (`1e54c4b1cc14fcd75c8ba6fffa14761f708c5c6b`) in temporary snapshot `/tmp/forge-task18-parent-RipK0C`.
  - Replaced only `tests/main/linear-service.test.ts` there with the Task 18 update and ran:
    `npx vitest run tests/main/linear-service.test.ts`
  - Result: FAIL as expected because `mapIssue` was not exported yet.
  - Concrete failure: both Task 18 tests failed with `TypeError: mapIssue is not a function`.
- Ran `npx vitest run tests/main/linear-service.test.ts` on current tree: PASS (3 tests).
- Ran `npm run test`: PASS (11 files, 34 tests).
- Ran `npm run typecheck`: PASS.
- Ran `npm run lint`: PASS with existing pre-existing warning (`tests/main/paths.test.ts`: `vi` unused).
- Ran `npm run format:check`: PASS.

Files changed
- `src/main/services/linear-service.ts`
- `tests/main/linear-service.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-18/progress.md`

Self-review findings
- Mapping behavior matches the expected translation for status, priority, label extraction, bug detection, and null description handling.
- No additional service behavior was introduced; only raw-to-domain mapping plus array mapping in `fetchIssues` were added, consistent with Task 18 scope.
- Complexity stays low for both new functions.

Tech-debt logged
- No new technical debt introduced.

Commits made
- `14b1ecd` — `feat(main): map raw Linear → internal Issue`
- `5918fb8` — `docs(task-18): record red-step evidence`
- `644abc7` — `docs(task-18): include commit audit entry`

Concerns
- Warning in existing lint output is unrelated to this task and pre-existing.
