# Task 17 Progress

## Summary

- Extended `TriageDrawer` to accept `phase` and `commentCount` metadata from triage generation.
- Rendered triage phase text through the existing `GeneratedDocument` activity status path:
  - `Triaging {commentCount ?? '…'} comment(s)…`
  - `Generating brief…`
- Wired `TriageDrawerContainer` to forward `phase` and `commentCount` from `useTriageStream(issue.id)`.
- Added renderer coverage for triaging, unknown comment count, generating, content-hides-phase behavior, and App prop forwarding.

## Files Changed

- `src/renderer/components/triage-drawer.tsx`
- `src/renderer/app.tsx`
- `tests/renderer/triage-drawer.test.tsx`
- `tests/renderer/app.test.tsx`
- `thoughts/tasks/comment-context-pipeline/impl/task-17/progress.md`

## Verification

- RED: `npm test -- tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx`
  - Failed before production changes because triage phase text was absent and App did not forward triage phase metadata.
- GREEN: `npm test -- tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx`
  - Passed: 30 tests.
- `npm test -- tests/renderer/use-triage-stream.test.ts`
  - Passed: 15 tests.
- `npm run typecheck`
  - Passed.

## Self-Review

- The implementation mirrors Task 16's `GeneratedDocument` activity-status approach and avoids a triage drawer redesign.
- Phase statuses are only visible while the document is in the existing no-content streaming activity state; streamed markdown hides the phase status automatically.
- Existing loading behavior for persisted `triage-brief.md` remains separate and still shows `Checking triage-brief.md`.

## Tech Debt

- None logged.

## Commit

- `feat(triage-ui): show triaging/generating phase indicator`
