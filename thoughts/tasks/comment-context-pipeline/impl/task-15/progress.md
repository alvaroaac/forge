# Task 15 Progress - Renderer triage stream phase state

## Summary

- Added triage stream hook state for `phase` and `commentCount`.
- Subscribed to `window.forge.triage.onPhase` with the existing issue-id and setup-version guards.
- Updated the hook to reset phase state on issue changes and mark phase `done` on matching done events.
- Added renderer hook tests for idle, triaging, generating, done, error, different-issue, and stale-setup phase behavior.
- Updated existing hook return-shape expectations to include `phase` and `commentCount`.

## Files Changed

- `src/renderer/hooks/use-triage-stream.ts`
- `tests/renderer/use-triage-stream.test.ts`
- `thoughts/tasks/comment-context-pipeline/impl/task-15/progress.md`

## Tests Run

- RED: `npm test -- tests/renderer/use-triage-stream.test.ts` failed because the hook did not yet return or track `phase` / `commentCount`.
- GREEN: `npm test -- tests/renderer/use-triage-stream.test.ts` passed, 14 tests.

## Self-Review

- Phase events are ignored unless both the payload issue id and current setup version match.
- Error events keep the current phase unchanged while still surfacing the existing error state.
- Issue switches reset phase to `idle` and clear `commentCount`.
- Phase subscription cleanup runs with the existing chunk, done, and error cleanups.

## Tech Debt

- None logged.

## Commit

- `feat(use-triage-stream): track triage/generate phase + commentCount`
