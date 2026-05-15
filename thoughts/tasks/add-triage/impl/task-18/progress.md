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

## Tests
- Added `tests/renderer/use-triage-stream.test.ts` with coverage for:
  - `generate()` accumulation from `onChunk` deltas and `onDone` completion.
  - `onError` updating `errorMessage` and stopping streaming.
  - state reset and subscription cleanup when `issueId` changes.
  - stale-run guarding across issue changes.
  - unhandled rejection suppression on `generate()` failure.
- Command run: `npm test -- tests/renderer/use-triage-stream.test.ts`

## Validation
- Command run: `npm test -- tests/renderer/use-triage-stream.test.ts` ✅
- Command run: `npm run typecheck` ✅

## Self Review
- No functional regressions identified for this task slice.
- No intentional tech debt introduced.
