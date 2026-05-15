Status: DONE

## What I implemented
- Updated `src/main/services/linear-mapping.ts` so `STATUS_TABLE.triage` maps to `'triage'` instead of `'todo'`.
- Updated `tests/main/linear-mapping.test.ts` assertion to:
  - `expect(mapStatus({ name: 'Triage', type: 'triage' })).toBe('triage');`

## What I tested and results
- `npm test -- tests/main/linear-mapping.test.ts` (temporary pre-fix state with `triage: 'todo'`): **FAILED** at `Triage` assertion (`expected 'todo' to be 'triage'`).
- `npm test -- tests/main/linear-mapping.test.ts` (final updated state): **PASSED**, 1 file / 7 tests.

## Files changed
- `src/main/services/linear-mapping.ts`
- `tests/main/linear-mapping.test.ts`
- `thoughts/tasks/add-triage/impl/task-2/progress.md`

## Commit SHA(s)
- `0e61f61`

## Self-review findings
- Scoped change only affects mapping behavior and its corresponding unit test.
- No runtime behavior beyond `mapStatus` changed.
- Mapping table and test are consistent with Task 1’s `IssueStatus` extension.

## Tech-debt logged
- None.

## Any issues or concerns
- Test execution in the sandbox initially failed due EPERM writing Vitest cache files in repo root; reran with escalated permissions successfully.
