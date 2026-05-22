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
