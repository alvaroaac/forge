# Task 7 Spec Review (Phase 1 MVP)

Verdict: ✅ Compliant

Checked inputs
- Read `thoughts/conventions.md` and enforced `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md`.
- Reviewed implementer report: `thoughts/tasks/phase1-mvp/impl/task-7/progress.md`.

Spec compliance notes (with evidence)
- Required file exists and is scoped to this task:
  - `src/main/services/linear-mapping.ts` defines only `mapPriority` (plus the required lookup table). See `src/main/services/linear-mapping.ts:3-13`.
- Implementation matches required shape exactly:
  - Imports `Priority` from `../../shared/types` (`src/main/services/linear-mapping.ts:1`).
  - Defines `PRIORITY_TABLE: Record<number, Priority>` (`src/main/services/linear-mapping.ts:3-9`).
  - Returns `PRIORITY_TABLE[n] ?? 'none'` (`src/main/services/linear-mapping.ts:12`).
- Required test file exists and covers the specified mappings:
  - `tests/main/linear-mapping.test.ts` asserts: `1 -> urgent`, `2 -> high`, `3 -> medium`, `4 -> low`, `0 -> none`, and unexpected `99 -> none`. See `tests/main/linear-mapping.test.ts:5-14`.
- Red test requirement:
  - `progress.md` explicitly reports the pre-implementation run failing with module resolution error due to the module not existing yet. (This historical failure is not directly reproducible now that the module exists.)
- Test commands / repo checks:
  - Verified locally: `npx vitest run tests/main/linear-mapping.test.ts` passes (2 tests).
  - Verified locally: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run format:check` all pass.
- Commit requirement:
  - Commit `9ab8fa3d3368ec5b6a8afcf53b75ffdf6754df79` exists with message `feat(main): map Linear priority → internal Priority` and contains only the expected added files.

Addendum enforcement
- No evidence of repo-wide formatting/linting rewrites of reference/protocol directories (`.agents/`, `thoughts/`, `resources/design/`, `scripts/orchestrator-core/`) in the Task 7 commit; only the two required files were added.

