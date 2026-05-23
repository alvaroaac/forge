# Task 14 QA Review - Renderer spec stream phase state

## Strengths

- The previously reported rejected-generate contradiction is fixed. In `src/renderer/hooks/use-spec-stream.ts:259-273`, rejected direct `window.forge.spec.generate(...)` calls set `generationFailed`, route through `failStreaming`, and skip the `finishStreaming` path that would set `phase` to `done`.
- Successful completion still finalizes correctly. `finishStreaming` remains the only helper that sets `phase` to `done`, and it is still called from matching done events plus the successful direct generate path.
- Error handling is now consistent across both error sources. IPC error events and rejected direct generate promises set `errorMessage` and clear `isStreaming` without overwriting the current phase.
- The stale-run and issue-id guards remain intact. `failStreaming`, `finishStreaming`, and `handlePhase` all still check the current issue/setup version before mutating state.
- The new regression test is focused on the real failure mode: it starts generation, emits a matching `generating` phase, rejects the generate promise, waits for `errorMessage`, and asserts `phase` remains `generating` rather than `done` in `tests/renderer/use-spec-stream.test.ts:500`.
- Existing phase coverage is still strong: idle/default return shape, triaging/generating transitions, done events, error events, wrong issue ids, issue switch reset, stale phase handlers, and unsubscribe behavior are all covered.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Drift detected

No new drift detected after the QA fix. The earlier Task 14/15 shared pattern of using the success finalizer after rejected generation has been corrected in Task 14 without changing the intended done-event behavior.

One small asymmetry remains from the broader hook design, not from this fix: chunk payloads with `done: true` still only clear `isStreaming` and do not set `phase` to `done`; done phase is owned by explicit `onDone` events and successful direct generation finalization. That is consistent with the current task reviews and tests.

## Assessment

Approved. The rejected spec generation path no longer produces `{ errorMessage, phase: 'done' }`, the finalizer is still used for successful completion, and the focused regression test would fail against the old implementation.

Verification run:
- `npm test -- tests/renderer/use-spec-stream.test.ts tests/renderer/use-triage-stream.test.ts` - passed, 2 files / 33 tests.
- `npm run typecheck` - passed.
