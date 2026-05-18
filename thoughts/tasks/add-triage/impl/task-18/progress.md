# Task 18

## Task
Implement `use-triage-stream` renderer hook with streaming lifecycle parity to `use-spec-stream`, excluding initial persisted spec retrieval.

## Files Changed
- `src/renderer/hooks/use-triage-stream.ts`
- `tests/renderer/use-triage-stream.test.ts`
- `thoughts/tasks/add-triage/impl/task-18/progress.md`

## Implementation Notes
- Added `useTriageStream(issueId)` with state `{ brief, streaming, isStreaming, errorMessage, generate }`.
- Subscriptions are established on `issueId` changes and cleaned up on teardown.
- Current-run guards (`currentIssueIdRef`, `setupVersionRef`) reject stale `onChunk`, `onDone`, `onError`, and `generate` completions.
- `generate()` invokes `window.forge.triage.generate`, clears/starts streaming state, and writes `brief` via `{ issueId, content, generatedAt: new Date().toISOString() }`.
- `onDone` and chunk `done` both stop streaming; `onError` sets `errorMessage` and stops streaming.
- No persisted `triage` fetch on mount/setup.
- QA follow-up fix: stale rejected `generate()` promises now also use `isCurrentRun(issueId, setupVersion)` in `catch`, preventing old run rejections from writing `errorMessage` or stopping a newer/current generation after issue navigation.

## Tests
- Updated `tests/renderer/use-triage-stream.test.ts` with:
  - `generate()` accumulation from `onChunk` deltas and `onDone` completion.
  - `onError` updating `errorMessage` and stopping streaming.
  - state reset and subscription cleanup when `issueId` changes.
  - stale-run guarding across issue changes.
  - unhandled rejection suppression on `generate()` failure.
  - stale rejected `generate()` regression: an old generation rejected after returning to the same issue with a newer setup does not set `errorMessage` nor stop the active run.
- Command run: `npm test -- tests/renderer/use-triage-stream.test.ts`

## Validation
- Command run: `npm test -- tests/renderer/use-triage-stream.test.ts` ✅
- Follow-up command run: `npm run typecheck` ✅

## QA Fix Commit
- `0efc467`

## Self Review
- No functional regressions identified for this task slice.
- No intentional tech debt introduced.
