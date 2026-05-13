# Task 34 Progress

Status: Completed.

Model used: gpt-5.3-codex-spark

Files changed:
- src/renderer/components/issue-group.tsx
- tests/renderer/issue-group.test.tsx
- thoughts/tasks/phase1-mvp/impl/task-34/progress.md

TDD evidence:
- Added `tests/renderer/issue-group.test.tsx` first.
- Initial run while `src/renderer/components/issue-group.tsx` was missing:
  - `Error: Failed to resolve import "../../src/renderer/components/issue-group"`
- Added `src/renderer/components/issue-group.tsx` and implemented `IssueGroup` + `intoRows`.
- Re-ran focused tests:
  - `npx vitest run tests/renderer/issue-group.test.tsx` ✅ (6 passed)

Implementation notes:
- Added typed local `META: Record<Group, { color, Icon }>` with icons `IconBug`, `IconFlame`, `IconSpark`, and `IconTerminal`.
- Added typed helper `intoRows<T>(items): [T[], T[]]` to split items into two rows.
- `IssueGroup` props are:
  - `name: Group`
  - `items: Issue[]`
  - `onOpen: (issue: Issue, which: 'spec' | 'detail') => void`
  - `activeId: string | null`
  - `hasSpecFor: (issueId: string) => boolean`
- `hasSpecFor` is applied to each `IssueCard` as `hasSpec={hasSpecFor(iss.id)}`.
- Rendered `group` structure per prototype: header and `.group-row` elements inside `.group-scroller-wrap` and `.group-scroller`.
- Omitted overflow indicator/fade/presence entirely per Phase 1 defer rule.

Validation:
- `npx vitest run tests/renderer/issue-group.test.tsx`
- `npm run typecheck`
  - passed
- `npm run lint`
  - passed with existing unrelated warning in `tests/main/paths.test.ts` (`'vi' is defined but never used`)
- `npm run format:check`
  - passed after formatting changes
- `npm run build`
  - passed

Self-review:
- Complexity of row splitting is isolated in `intoRows` and remains below the local threshold.
- No behavior drift from requested scope: no overflow indicator/fade in this task.
- No protocol files or reference directories modified.

Tech-debt logged:
- None added for this task.

Concerns:
- `tests/main/paths.test.ts` warning remains pre-existing and unrelated to Task 34.

Commits:
- `a453d70f9906935a1c0b209899e2ad3e24c10a1f` — `feat(renderer): IssueGroup 2-row scroller`

## QA Fix Pass (Issue Group test decoupling)

Status: Completed.

Files changed since prior pass:
- tests/renderer/issue-group.test.tsx
- thoughts/tasks/phase1-mvp/impl/task-34/progress.md

What changed:
- Replaced direct assertions on `IssueCard` internals with a local mock of `../../src/renderer/components/issue-card`.
- Mocked card now renders stable attributes:
  - `data-testid="issue-card"`
  - `data-issue-id`
  - `data-is-active`
  - `data-has-spec`
  and exposes stable `open-spec` / `open-detail` buttons that call `onOpen(issue, 'spec'|'detail')`.
- Added strict `hasSpecFor` call assertions:
  - called exactly once per rendered card
  - asserted call order and ids in render order for current row layout
- Added strict `onOpen` pass-through assertions:
  - exact call counts using mock-owned buttons
  - exact argument order for `spec` and `detail` actions per card.
- Added odd-length row coverage:
  - 3-item case renders `[FUL-1, FUL-3]` in first row and `[FUL-2]` in second row.

Validation:
- `npx vitest run tests/renderer/issue-group.test.tsx` ✅ (7 passed)
- `npm run typecheck` ✅
- `npm run lint` ⚠️ (existing unrelated warning remains in `tests/main/paths.test.ts`: `vi` defined but never used)
- `npm run format:check` ✅

Commits:
- `fb5abfe` — `test(renderer): decouple IssueGroup tests from IssueCard`
