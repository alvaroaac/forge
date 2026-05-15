# Task 14 Progress

## Task
Implement IPC handlers for `linear:fetchTeamTriage` and `linear:getViewerId` with cached viewer-id behavior.

## Files Changed
- `src/main/ipc/linear.ts`
- `src/main/ipc/register.ts`
- `tests/main/ipc-linear.test.ts`
- `thoughts/tasks/add-triage/impl/task-14/progress.md`

## Validation
- Addressing QA blocking typecheck issue:
  - `npm run typecheck && npm test -- tests/main/ipc-linear.test.ts` (pass)
- Ran focused baseline test before implementation:
  - `npm test -- tests/main/ipc-linear.test.ts` (passed before edits in this worktree)
- Ran requested focused verification after implementation:
  - `npm test -- tests/main/ipc-linear.test.ts` (passes, 6 tests)

## What I Changed
- Extended `LinearDeps` to accept `fetchTriage` and `getViewerId`.
- Registered two new IPC handlers:
  - `IpcChannel.LinearFetchTeamTriage` → `deps.fetchTriage(deps.client)`
  - `IpcChannel.LinearGetViewerId` with in-memory session cache for viewer id
- Wired `getViewerId` and `fetchTriage` from existing `linear-service` helpers in `register.ts`.
- Added tests to confirm:
  - all five handlers are registered
  - team triage handler invokes `fetchTriage` once and returns mapped issues
  - viewer-id handler returns cached id and invokes `getViewerId` only once per session
- Follow-up type-safety fix:
  - Cast `linearClient` to `LinearClient` inside the `getViewerId` adapter in `register.ts` before calling `getCurrentUser()`, matching other adapter casts.

## Fix Commit
- `ad989b3` (initial implementation)
- `cd963cb` (`fix(ipc): cast linearClient before getCurrentUser in adapter`)

## Tech Debt
- None intentionally skipped for this task.
