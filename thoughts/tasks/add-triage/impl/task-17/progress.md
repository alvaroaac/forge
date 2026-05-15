# Task 17

## Task
`use-issues` — merge team triage data into the assigned issue list and keep refresh semantics intact.

## Files Changed
- `src/renderer/hooks/use-issues.ts`
- `tests/renderer/use-issues.test.ts`
- `thoughts/tasks/add-triage/impl/task-17/progress.md`

## Implementation Notes
- Added a shared `loadAll()` path that fetches assigned issues and team triage issues in parallel via:
  - `Promise.all([window.forge.linear.refresh(), window.forge.linear.fetchTeamTriage()])`
- Merged both arrays by issue id with assigned issues inserted first, then triage entries overwrite matching ids, preserving triage precedence.
- Updated `refresh()` and mount-time refresh flow to use `loadAll()`.
- Preserved existing loading/error behavior:
  - fetch/reload still catches and suppresses errors.
  - stale refresh responses are discarded using existing `refreshIdRef` logic.

## Test Updates
- Updated `tests/renderer/use-issues.test.ts` to cover:
  - merging assigned + triage issues (including an unassigned and an assigned triage issue),
  - `refresh()` re-calling both `linear.refresh()` and `linear.fetchTeamTriage()`,
  - duplicate-id precedence where triage wins on overlapping issue id.

## Validation
- `npm test -- tests/renderer/use-issues.test.ts`
- `npm run typecheck`

## Tech Debt
- None introduced.
