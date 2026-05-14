# Task 35 Spec Review
Verdict: ✅ Spec compliant

## Missing requirements

None.

## Extras / scope drift

None (implementation and tests are scoped to the Task 35 surface; the only additional touched file is `pill-tab.tsx` for the `aria-pressed` QA fix).

## Misunderstandings

None.

## Addendum-rule check

- Protected/reference dirs (`.agents/`, `thoughts/`, `resources/design/`, `scripts/orchestrator-core/`) were not reformatted or rewritten by Task 35. The two Task 35 commits only touch renderer/test files plus the Task 35 `progress.md` (see commit file lists below).
- This review does not require/expect the later docs-only progress-edit commit `55103c5` to be recorded in Task 35 `progress.md` (acceptable per review instructions).

## Tech-debt-accounting check

- Task 35 `progress.md` states “Tech-debt logged: None added.” and there is no `[Task 35]` entry in `thoughts/tech-debt.md`; consistent with the declared scope.

## Evidence

- Prototype parity target: `resources/design/forge/project/forge/dashboard.jsx:168-214` for `IssueListPanel` structure (tabs, refresh control, grouped rendering, empty state). See [dashboard.jsx](/Users/alvarocarvalho/desenv/personal/forge/resources/design/forge/project/forge/dashboard.jsx:168) and [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:48).
- Exported `Tab` union: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:8).
- `TABS` order: `['Todo', 'In Progress', 'In Review', 'Done']`: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:10).
- `TAB_KEY` maps to `todo` / `in_progress` / `in_review` / `done`: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:12).
- `GROUP_ORDER` is `['Bugs', 'Urgent', 'Feature', 'Chore']`: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:19).
- Group derivation uses `classifyGroup(issue)` (not `issue.group`): [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:41).
- Props include exactly the required surface (`issues`, `tab`, `setTab`, `onOpen`, `activeId`, `hasSpecFor`, `onRefresh`): [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:21).
- Uses `PillTab` with counts and active/pressed state:
  - Render with `count={issueCounts[item]}` + `active={tab === item}`: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:65).
  - `PillTab` sets `aria-pressed={active}`: [pill-tab.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/pill-tab.tsx:10).
- Refresh button is `type="button"`, wired to `onRefresh`, and is queryable by role/name: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:77) and test [issue-list-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/issue-list-panel.test.tsx:303).
- `IssueGroup` rendered only for non-empty visible groups in `GROUP_ORDER` and passed through `onOpen`, `activeId`, `hasSpecFor`:
  - Non-empty filter: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:41).
  - Pass-through props: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:93).
  - Tests assert group order + classifier-derived grouping: [issue-list-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/issue-list-panel.test.tsx:187).
  - Tests assert pass-throughs + onOpen call count: [issue-list-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/issue-list-panel.test.tsx:275).
- Empty state string: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:90) and test [issue-list-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/issue-list-panel.test.tsx:321).
- Helpers extracted: `counts(issues)` and `groupVisible(visibleIssues)`: [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:31) and [issue-list-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/issue-list-panel.tsx:41).
- Task 35 commit scope (for addendum protected-dir check):
  - `2cd34134d4625a7e84fa74abf1585733cbba3851` touched only `src/renderer/components/issue-list-panel.tsx`, `tests/renderer/issue-list-panel.test.tsx`, and Task 35 `progress.md`.
  - `738bbb9fc379defa1cade25fc572bd53f731e61c` touched only `src/renderer/components/issue-list-panel.tsx`, `src/renderer/components/pill-tab.tsx`, `tests/renderer/issue-list-panel.test.tsx`, and Task 35 `progress.md`.
