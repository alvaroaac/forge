Status: DONE

What you implemented
- Added `tests/main/linear-mapping.test.ts` to validate Linear numeric priority mapping and fallback behavior.
- Added `src/main/services/linear-mapping.ts` with:
  - `PRIORITY_TABLE` mapping for `1 -> urgent`, `2 -> high`, `3 -> medium`, `4 -> low`, `0 -> none`
  - `mapPriority(n: number): Priority` returning `PRIORITY_TABLE[n] ?? 'none'`.

What you tested and test results, including initial failing test
- `npx vitest run tests/main/linear-mapping.test.ts` (before implementation): failed with module resolution error (`Does the file exist?`) because `src/main/services/linear-mapping.ts` was not present yet.
- `npx vitest run tests/main/linear-mapping.test.ts` (after implementation): **PASS** (2 tests).
- `npm run test`: PASS (5 test files, 10 tests).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run format:check`: PASS.

Files changed
- `src/main/services/linear-mapping.ts`
- `tests/main/linear-mapping.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-7/progress.md`

Self-review findings
- Mapping behavior is constrained to a simple, deterministic record lookup with a default, which aligns with the task requirements.
- Complexity is minimal and within project conventions (pure function, early/default return via `??`).

Tech-debt logged
- None.

Commits made
- `9ab8fa3` (`feat(main): map Linear priority → internal Priority`)

Concerns
- None.

Model Choice Audit
- Implementer model: `gpt-5.3-codex-spark`
