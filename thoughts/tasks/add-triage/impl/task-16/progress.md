# Task 16

## Task
Preload + `ForgeApi` type exposure for triage workflow and linear viewer/triage helpers.

## Files Changed
- `src/shared/forge-api.ts`
- `src/main/preload.ts`
- `tests/main/preload.test.ts`
- `tests/renderer/app.test.tsx`
- `tests/renderer/use-auth-status.test.ts`
- `tests/renderer/use-issues.test.ts`
- `tests/renderer/use-spec-stream.test.ts`

## Validation
- Ran before implementation:
  - `npm test -- tests/main/preload.test.ts` (failed to provide baseline after code changes)
- Ran after implementation:
  - `npm run typecheck`
  - `npm test -- tests/main/preload.test.ts`

## What I Implemented
- Extended `ForgeApi`:
  - `linear` now includes `fetchTeamTriage()` and `getViewerId()`.
  - Added `triage` namespace with `generate`, `write`, `onChunk`, `onDone`, and `onError` typed using shared triage payloads.
- Wired preload API to IPC channels:
  - `LinearFetchTeamTriage`, `LinearGetViewerId`.
  - `TriageGenerate`, `TriageWrite` with `overwrite: opts?.overwrite ?? false`.
  - `TriageStreamChunk`, `TriageGenerateDone`, `TriageGenerateError` event subscriptions with returned unsubscribe.
- Expanded preload tests to assert exact IPC channel usage and subscription/unsubscription behavior.
- Updated affected renderer test mocks to include the newly required `linear` and `triage` API fields so typecheck remains green.

## Tech Debt
- None introduced.
