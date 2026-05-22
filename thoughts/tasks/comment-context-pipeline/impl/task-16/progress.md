# Task 16 Progress

## Summary

- Extended the spec drawer/tab prop path with `phase?: GenerationPhase` and `commentCount?: number`.
- Wired `phase: specPhase` and `commentCount: specCommentCount` from `useSpecStream(drawerIssueId)` into `SpecDrawer`, then `SpecTab`.
- Rendered the phase indicator through `GeneratedDocument` activity status so it uses the existing activity styling and hides once generated content/chunks exist.
- Added focused renderer coverage for `SpecTab`, `SpecDrawer`, and `App` phase propagation.

## Files Changed

- `src/renderer/app.tsx`
- `src/renderer/components/spec-drawer.tsx`
- `src/renderer/components/spec-tab.tsx`
- `tests/renderer/app.test.tsx`
- `tests/renderer/spec-drawer.test.tsx`
- `tests/renderer/spec-tab.test.tsx`
- `thoughts/tasks/comment-context-pipeline/impl/task-16/progress.md`

## Tests Run

- `npm test -- tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/app.test.tsx` — pass
- `npm run typecheck` — pass

## Visual Verification

- Dev server was not started per task instruction; no visual verification performed.

## Tech Debt

- None logged.

## Self-Review

- Confirmed phase status only affects the empty streaming activity surface; rendered markdown content continues to take precedence.
- Confirmed existing unrelated untracked review/plan artifacts were left untouched.
