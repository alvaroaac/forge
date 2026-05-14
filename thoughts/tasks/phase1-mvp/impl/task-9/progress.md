Status: DONE

Model Choice Audit: Implementer model: gpt-5.3-codex-spark

What you implemented
- Added `mapStatus` tests to `tests/main/linear-mapping.test.ts` to assert Linear state-type mapping and unknown-type fallback behavior.
- Extended `src/main/services/linear-mapping.ts` with:
  - `IssueStatus` import from `../../shared/types`.
  - `STATUS_TABLE` mapping: `triage/backlog/unstarted → todo`, `started → in_progress`, `review → in_review`, `completed/canceled → done`.
  - `mapStatus(state)` implementation returning `STATUS_TABLE[state.type] ?? 'todo'`.

What you tested and test results, including initial failing test
- `npx vitest run tests/main/linear-mapping.test.ts`
  - Initial run: failed (2 failed tests) because `mapStatus` was not yet implemented (`TypeError: mapStatus is not a function`).
  - Post-implementation run: PASS (7/7).
- `npm run test` — PASS.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run format:check` — PASS.

Files changed
- `src/main/services/linear-mapping.ts`
- `tests/main/linear-mapping.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-9/progress.md`

Self-review findings
- Mapping is deterministic and intentionally minimal, matching requested state-type rules and fallback behavior.
- Complexity is low (table lookup with default), aligned with project complexity policy.
- Existing Task 7 and 8 behaviors remain unchanged.

Tech-debt logged
- None.

Commits made
- `8c41460` (`feat(main): map Linear state.type → IssueStatus`)

Concerns
- None.
