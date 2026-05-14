# Task 8: Linear mapping — bug detection

Status: DONE

Model Choice Audit: Implementer model: `gpt-5.3-codex-spark`.

What you implemented:
- Added `isBug` tests to `tests/main/linear-mapping.test.ts` (case-insensitive label matching, issue type fallback, false negative cases).
- Added `BUG_RX` and exported `isBug(input)` to `src/main/services/linear-mapping.ts`.
- Kept mapping behavior unchanged and complexity under the project threshold by using early return.

What you tested and test results, including initial failing test:
- `npx vitest run tests/main/linear-mapping.test.ts`
  - Initial run: failed with `TypeError: isBug is not a function` (expected, since function was not yet exported).
  - Post-implementation run: passed (5 tests).
- `npm run test` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.

Files changed:
- `src/main/services/linear-mapping.ts`
- `tests/main/linear-mapping.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-8/progress.md`

Self-review findings:
- `isBug` implementation is minimal and aligns with requested behavior:
  - labels are checked with `/^bug$/i`
  - issue type fallback is checked when labels do not match
- No nested branching beyond early return + final expression (low complexity).
- Importing `isBug` in tests is straightforward and mirrors existing test style.

Tech-debt logged:
- None introduced.

Commits made:
- `77f06b866813a5450ec55ad6aa5f2c75e9925b7e`

Concerns:
- None.
