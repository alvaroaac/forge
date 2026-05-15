# Task 21

## Task
Route triage issues to `TriageDrawer` from `App` and remove spec drawer rendering for triage state.

## Files Changed
- `src/renderer/app.tsx`
- `tests/renderer/app.test.tsx`
- `thoughts/tasks/add-triage/impl/task-21/progress.md`

## Implementation
- Added a `TriageDrawerContainer` in `src/renderer/app.tsx` to own `useTriageStream(issue.id)`.
- `TriageDrawerContainer` now passes `brief`, `streaming`, `isStreaming`, `errorMessage`, `onGenerate={() => void generate()}`, `canGenerate`, `issue`, and `onClose` into `TriageDrawer`.
- Removed `useTriageStream` ownership from `App` and switched triage rendering to use `TriageDrawerContainer`.
- Kept non-triage rendering through `SpecDrawer` unchanged and preserved default tab `Todo` behavior.
- Updated app test path remains the same; no behavior changes were needed beyond compatibility with the containerized triage stream ownership.

## Tests Run
- `npm test -- tests/renderer/app.test.tsx`
- `npm run typecheck`

## Results
- App test suite: 9 passed.
- Typecheck: passed (main, renderer, and test typecheck).

## Commit
- `2fc3fad`

## Tech Debt
- None logged for this task.
