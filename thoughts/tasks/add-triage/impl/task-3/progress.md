Status: DONE

What I implemented
- Updated `Issue` shape in `src/shared/types.ts` to include `assigneeId: string | null`.
- Extended `RawLinearIssue` and `mapIssue` in `src/main/services/linear-service.ts` to thread `assignee?.id` through as `assigneeId`.
- Updated renderer fixtures in requested test files to include `assigneeId: null` in `Issue` literals.
- Updated additional test fixtures that surfaced in typecheck/test failures (`tests/main/ipc-linear.test.ts`, `tests/main/ipc-spec-generate.test.ts`, `tests/main/issues-cache.test.ts`, `tests/main/linear-service.test.ts`, `tests/main/spec-prompt.test.ts`, `tests/renderer/classify.test.ts`, `tests/renderer/use-issues.test.ts`).

What I tested and results
- `npm run typecheck`
- `npm test`

Files changed
- `src/shared/types.ts`
- `src/main/services/linear-service.ts`
- `tests/main/ipc-linear.test.ts`
- `tests/main/ipc-spec-generate.test.ts`
- `tests/main/issues-cache.test.ts`
- `tests/main/linear-service.test.ts`
- `tests/main/spec-prompt.test.ts`
- `tests/renderer/app.test.tsx`
- `tests/renderer/classify.test.ts`
- `tests/renderer/detail-tab.test.tsx`
- `tests/renderer/issue-card.test.tsx`
- `tests/renderer/issue-group.test.tsx`
- `tests/renderer/issue-list-panel.test.tsx`
- `tests/renderer/spec-drawer.test.tsx`
- `tests/renderer/spec-tab.test.tsx`
- `tests/renderer/use-issues.test.ts`
- `thoughts/tasks/add-triage/impl/task-3/progress.md`

Commit SHA(s)
- d0441fa

Self-review findings
- `mapIssue` now returns `assigneeId: null` when `assignee` is absent and the actual assignee id when present.
- No functional behavior changes beyond data-shape propagation.

Tech-debt logged
- None.

Any issues or concerns
- Full typecheck and full test suite pass after updating all affected fixtures.
