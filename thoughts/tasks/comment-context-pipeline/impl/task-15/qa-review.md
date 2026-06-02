# Task 15 QA Review - Renderer triage stream phase state

## Strengths

- The previously reported rejected-generate contradiction is fixed. In `src/renderer/hooks/use-triage-stream.ts:249-264`, rejected direct `window.forge.triage.generate(...)` calls set `generationFailed`, route through `failStreaming`, and skip the `finishStreaming` path that would set `phase` to `done`.
- Successful completion still finalizes correctly. `finishStreaming` remains the helper that owns the `done` phase, and it is still called from matching done events plus the successful direct generate path.
- Error handling is consistent across IPC error events and rejected direct generate promises: both leave the current phase/comment count intact while surfacing `errorMessage` and clearing `isStreaming`.
- The stale-run and issue-id guards remain intact. `failStreaming`, `finishStreaming`, and `handlePhase` still validate the current issue/setup version before updating hook state.
- The new regression test exercises the exact previous failure mode: it starts generation, emits a matching `generating` phase, rejects the generate promise, waits for `errorMessage`, and asserts `phase` remains `generating` rather than `done` in `tests/renderer/use-triage-stream.test.ts:463`.
- Existing phase coverage remains solid: idle/default return shape, triaging/generating transitions, done events, error events, wrong issue ids, issue-switch reset, and stale setup behavior are covered.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Drift detected

No new drift detected after the QA fix. The earlier Task 14/15 shared pattern of calling the success finalizer after rejected generation has been corrected in Task 15 without weakening the intended done-event path.

One small asymmetry remains from the broader hook design, not from this fix: chunk payloads with `done: true` still only clear `isStreaming` and do not set `phase` to `done`; done phase is owned by explicit `onDone` events and successful direct generation finalization. That is consistent with the current task reviews and tests.

## Assessment

Approved. The rejected triage generation path no longer produces `{ errorMessage, phase: 'done' }`, successful completion still reaches `done`, and the focused regression test would fail against the old implementation.

Verification run:
- `npm test -- tests/renderer/use-spec-stream.test.ts tests/renderer/use-triage-stream.test.ts` - passed, 2 files / 33 tests.
- `npm run typecheck` - passed.
