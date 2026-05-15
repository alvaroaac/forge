## Status: DONE

## What I implemented
- Added a new `LinearTriageClientShape` interface to `src/main/services/linear-service.ts` with `fetchTeamTriage(): Promise<RawLinearIssue[]>`.
- Added and exported `fetchTriage(client: LinearTriageClientShape): Promise<Issue[]>`, which calls `client.fetchTeamTriage()` and maps each result through `mapIssue`.
- Added `tests/main/linear-service-fetchTriage.test.ts` with a red-green assertion that triage issues map to internal `Issue` and preserve `assigneeId`.

## What I tested and results
- `npm test -- tests/main/linear-service-fetchTriage.test.ts` (before implementation): failed with `fetchTriage is not a function`.
- `npm test -- tests/main/linear-service-fetchTriage.test.ts` (after implementation): passed (1 test).

## Files changed
- `src/main/services/linear-service.ts`
- `tests/main/linear-service-fetchTriage.test.ts`
- `thoughts/tasks/add-triage/impl/task-5/progress.md`

## Commit SHA(s)
- `a2c817d`

## Self-review findings
- Change is narrowly scoped and follows existing service-layer pattern used by `fetchIssues`.
- `assigneeId` handling is inherited from existing `mapIssue`, so this task does not duplicate logic.
- No schema or behavior drift beyond expected test coverage.

## Tech-debt logged
- None.

## Any issues or concerns
- None.
