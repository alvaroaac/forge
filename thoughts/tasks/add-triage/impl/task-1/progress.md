Status: DONE

## What I implemented
- Added a compile-time test case asserting `'triage'` is assignable to `IssueStatus` in `tests/shared/types.test.ts`.
- Extended `IssueStatus` in `src/shared/types.ts` to include `'triage'`:
  - `export type IssueStatus = 'triage' | 'todo' | 'in_progress' | 'in_review' | 'done';`

## What I tested and results
- `npm run typecheck` (Step 2): passed.
- `npm run typecheck && npm test -- tests/shared/types.test.ts` (Step 4): passed.

## Files changed
- `src/shared/types.ts`
- `tests/shared/types.test.ts`
- `thoughts/tasks/add-triage/impl/task-1/progress.md` (this report)

## Commit SHA(s)
- `025535e`

## Self-review findings
- The new test checks that `IssueStatus` can be used with `'triage'`, but does not yet assert runtime behavior because this is a type-level only change.
- No other modules were touched; change remains narrowly scoped as requested.

## Tech-debt logged
- None pending for Task 1 after dependency installation.

## Any issues or concerns
- Verification completed successfully in this run after dependencies were installed.
