# Task 35 QA Review
Verdict: ✅ Approved

## Strengths
- Refresh is icon-only but now has an explicit accessible name (`aria-label="Refresh"`), and the test queries it by role+name. (`src/renderer/components/issue-list-panel.tsx`, `tests/renderer/issue-list-panel.test.tsx`)
- Tabs now expose selected state via `aria-pressed`, and tests assert pressed/unpressed for active/inactive. (`src/renderer/components/pill-tab.tsx`, `tests/renderer/issue-list-panel.test.tsx`)
- Internal constants (`TABS`, `TAB_KEY`, `GROUP_ORDER`) are module-local (no unnecessary exports). (`src/renderer/components/issue-list-panel.tsx`)
- `onOpen` forwarding is locked with an exact call-count assertion. (`tests/renderer/issue-list-panel.test.tsx`)
- Tests are true unit tests of `IssueListPanel`: `IssueGroup` is mocked to stable, test-owned DOM, and interactions are driven through real events. (`tests/renderer/issue-list-panel.test.tsx`)
- Renderer-testing posture is consistent with Tasks 33–34: strict call counts where it matters, and preference for role/name queries over brittle structure. (`thoughts/tasks/phase1-mvp/impl/task-33/qa-review.md`, `thoughts/tasks/phase1-mvp/impl/task-34/qa-review.md`)

## Critical issues
None.

## Important issues
None.

## Minor issues
- **Potential avoidable repeated work (watch item, not a bug):** `counts()` scans `issues` once per tab (4 passes), and `groupVisible()` calls `classifyGroup` once per issue per group (4x per visible issue). If the issue list grows, a single-pass accumulator for counts and a single-pass `Map<Group, Issue[]>` grouping would reduce work. (`src/renderer/components/issue-list-panel.tsx`)
- **Semantics nit (optional later):** `aria-pressed` is a reasonable minimal signal for “segmented-control tabs”, but if you want full tab semantics, consider a future refactor to `role="tablist"` / `role="tab"` + `aria-selected`. Not required for Phase 1 MVP. (`src/renderer/components/pill-tab.tsx`, `src/renderer/components/issue-list-panel.tsx`)

## Drift detected
No concerning drift.

The a11y/test improvements (explicit `aria-label` for refresh, role+name queries, `aria-pressed` state) are beneficial drift beyond the plan’s initial sketch, and align with the renderer QA posture from Tasks 32–34.

## Assessment
Task 35 is ready. The earlier QA blockers are resolved (refresh a11y/name + role query, tab selected state via `aria-pressed`, reduced exported surface, strict `onOpen` call count), and the unit tests are stable and aligned with recent renderer testing conventions.
