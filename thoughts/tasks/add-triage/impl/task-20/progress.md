# Task 20

## Task
Add a Triage tab at the start of the issue list and a Triage-only `Mine only` toggle.

## Files Changed
- `src/renderer/components/issue-list-panel.tsx`
- `tests/renderer/issue-list-panel.test.tsx`
- `src/renderer/app.tsx`
- `thoughts/tasks/add-triage/impl/task-20/progress.md`

## Implementation
- Extended `Tab` to include `'Triage'` and updated `TABS` to start with Triage, then Todo, In Progress, In Review, Done.
- Updated tab-to-status map with `TAB_KEY.Triage = 'triage'`.
- Added `mineOnly`, `onMineOnlyChange`, and `viewerId` props to `IssueListPanel`.
- Added conditional `Mine only` checkbox in panel tools, visible only when active tab is Triage.
- Applied mine-only filter only for Triage when enabled and `viewerId` is present (`issue.assigneeId === viewerId`).
- Kept tab counts based on all issues by status and not mine-only filtered list.
- Wired parent state in `app.tsx`:
  - Added `mineOnly` state and setter passed to `IssueListPanel`.
  - Added cached `viewerId` state fetched lazily via `window.forge.linear.getViewerId()` when Triage is selected.
- Updated test fixtures and assertions to include triage issues and new behavior.

## Tests Run
- `npm test -- tests/renderer/issue-list-panel.test.tsx`
- `npm run typecheck`

## Results
- `issue-list-panel` test suite: 10 passed.
- Typecheck: passed for main, renderer, and test configs.

## Self Review
- No intentional tech debt.
