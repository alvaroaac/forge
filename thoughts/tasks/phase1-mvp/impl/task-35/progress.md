# Task 35 Progress

Status: Completed.

Model used: gpt-5.3-codex-spark

Files changed:
- src/renderer/components/issue-list-panel.tsx
- tests/renderer/issue-list-panel.test.tsx
- thoughts/tasks/phase1-mvp/impl/task-35/progress.md

TDD evidence:
- Added `tests/renderer/issue-list-panel.test.tsx` first.
- First focused run: failed because `src/renderer/components/issue-list-panel.tsx` was missing.
- Implemented `IssueListPanel` and re-ran focused tests.
- Re-ran focused tests: `npx vitest run tests/renderer/issue-list-panel.test.tsx` ✅ (7 passed)

Implementation notes:
- Added `Tab` union type and exported constants:
  - `TABS: ['Todo', 'In Progress', 'In Review', 'Done']`
  - `TAB_KEY: Record<Tab, IssueStatus>` with underscores mapping (`todo`, `in_progress`, `in_review`, `done`).
  - `GROUP_ORDER: ['Bugs', 'Urgent', 'Feature', 'Chore']`.
- Added props: `issues`, `tab`, `setTab`, `onOpen`, `activeId`, `hasSpecFor`, `onRefresh`.
- Added pure helpers:
  - `counts(issues)` for per-tab counts.
  - `groupVisible(visibleIssues)` grouping by `classifyGroup(issue)` and group order.
- Rendered `PillTab` per status with counts.
- Wired refresh button to `onRefresh` with `type="button"`.
- Rendered visible groups only, in order, passing through `onOpen`, `activeId`, and `hasSpecFor`.
- Rendered empty state string: `No issues in {tab.toLowerCase()}.`.

Validation:
- `npx vitest run tests/renderer/issue-list-panel.test.tsx` ✅
- `npm run typecheck` ✅
- `npm run lint` ✅ (existing warning remains: `tests/main/paths.test.ts: 'vi' is defined but never used`)
- `npm run format:check` ✅
- `npm run build` ✅

Self-review:
- Component complexity was decomposed into pure helpers and a simple render path.
- Uses live `issue.group` nowhere; grouping comes from `classifyGroup`.
- No protocol/reference artifacts were modified.
- No changes outside scoped files.

Tech-debt logged:
- None added.

Concerns:
- One-time `npm run lint` failure was seen earlier with a local ESLint temp-file ENOENT error before rerunning; final run succeeds with the pre-existing warning in `tests/main/paths.test.ts`.
