# Task 14 Progress - Renderer hook phase state

## Summary

- Added `phase` and `commentCount` state to `useSpecStream`.
- Subscribed to `window.forge.spec.onPhase`, filtering events through the existing issue id and setup-version guards.
- Reset phase state to `idle` with undefined `commentCount` on issue changes/null issue.
- Marked phase as `done` only from matching done events.
- Left phase unchanged for matching error events.
- Returned `phase` and `commentCount` from the hook.
- Updated renderer hook tests to cover phase transitions, stale phase handlers, issue-id filtering, error behavior, and the expanded hook return shape.

## Files Changed

- `src/renderer/hooks/use-spec-stream.ts`
- `tests/renderer/use-spec-stream.test.ts`
- `thoughts/tasks/comment-context-pipeline/impl/task-14/progress.md`

## Tests Run

- RED: `npm test -- tests/renderer/use-spec-stream.test.ts` failed as expected before implementation, with missing `phase` / `commentCount` hook fields.
- GREEN: `npm test -- tests/renderer/use-spec-stream.test.ts` passed, 17 tests.

## Commit

- `feat(use-spec-stream): track triage/generate phase + commentCount`

## Self-Review

- Scope is limited to the Task 14 hook, tests, and progress artifact.
- Existing issue/run filtering is reused for phase events.
- Cleanup unsubscribes `onPhase` alongside chunk/done/error subscriptions.

## Tech Debt

- None logged.

## QA Fix - 2026-05-22

- Fixed the rejected `generate()` path so caught spec generation failures set `errorMessage` and stop streaming without forcing `phase` to `done`.
- Added regression coverage proving a rejected spec generation promise leaves the current phase unchanged (`generating`) while setting `errorMessage` and `isStreaming: false`.
- Verification: `npm test -- tests/renderer/use-spec-stream.test.ts tests/renderer/use-triage-stream.test.ts` passed, 33 tests.
