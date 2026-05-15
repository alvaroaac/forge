# Task 18 QA Re-Review

## Status: Approved

## Reviewed Range
- Head: `8d166f4734996fb7721c70ed886cb5ca5235af51`
- Follow-up context: prior QA rejection for stale rejected `generate()` promises guarded only by issue id.

## Artifact Check
- `thoughts/tasks/add-triage/impl/task-18/progress.md` exists.
- `thoughts/tasks/add-triage/impl/task-18/spec-review.md` exists and approves the task.
- No task addendum exists.

## Findings

### Critical
- None.

### Important
- None.

### Minor
- None.

## Review Notes
- `src/renderer/hooks/use-triage-stream.ts:66` routes generate failures through `failStreaming`, which guards state mutation with `isCurrentRun(issueId, setupVersion)`.
- `src/renderer/hooks/use-triage-stream.ts:177` now uses that guarded failure path in the `catch` block, and `finally` uses the existing guarded `finishStreaming` path.
- `tests/renderer/use-triage-stream.test.ts:317` adds the requested stale-rejection regression: an old `FUL-7` generation rejects after navigation away and return to a newer `FUL-7` setup, and the stale rejection does not set `errorMessage` or stop/overwrite the fresh run.
- The hook still matches the Task 18 scope: triage streaming lifecycle parity with `use-spec-stream`, while omitting any initial persisted fetch.

## Verification
- `npm test -- tests/renderer/use-triage-stream.test.ts` passed: 6 tests.
- `npm run typecheck` passed.

## Assessment
Approved. The stale rejection issue from the prior QA review is fixed and covered by a focused regression test. I did not identify remaining Task 18 blockers.
