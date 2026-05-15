# Task 21

## Task
Route triage issues to `TriageDrawer` from `App` and remove spec drawer rendering for triage state.

## Files Changed
- `src/renderer/app.tsx`
- `tests/renderer/app.test.tsx`
- `thoughts/tasks/add-triage/impl/task-21/progress.md`

## Implementation
- Imported `TriageDrawer` and `useTriageStream` in `app.tsx`.
- Kept existing `useSpecStream`/spec drawer flow intact for non-triage issues.
- Added triage stream state (`brief`, `streaming`, `isStreaming`, `errorMessage`, `generate`) for the drawer issue id.
- Added branch in render: when `drawer?.issue.status === 'triage'`, render `TriageDrawer` with `brief`, `streaming`, `isStreaming`, `errorMessage`, `onGenerate={() => void generate()}`, `canGenerate={auth.computron}`, and `onClose`.
- Left default tab behavior unchanged (`Todo` initial tab in `App`).
- Updated app test to include `triage` fixture, mock `TriageDrawer`, mock `useTriageStream`, and assert triage issues render `TriageDrawer` while spec drawer props are not used.
- Drawer mocks now only capture state when `issue` is present to avoid initial-null-drawer assertions.

## Tests Run
- `npm test -- tests/renderer/app.test.tsx`
- `npm run typecheck`

## Results
- App test suite: 9 passed.
- Typecheck: passed (main, renderer, and test typecheck).

## Commit
- Not committed yet.

## Tech Debt
- None logged for this task.
