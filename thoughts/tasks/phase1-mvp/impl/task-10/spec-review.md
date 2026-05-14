# Task 10 Spec Review (Phase 1 MVP)

Verdict: ✅ Compliant

I verified the required files exist and match the Task 10 requirements and the Phase 1 plan addendum constraints.

## Requirements Check

- Created files:
  - `src/main/lib/paths.ts` exists and exports `expandHome`, `forgeDir`, `configPath`, `issuesCachePath`.
  - `tests/main/paths.test.ts` exists and covers the required cases.

- Tests cover (against `homedir()` strings):
  - `expandHome('~/foo')` and `expandHome('/abs/path')` in `tests/main/paths.test.ts`.
  - `forgeDir()`, `configPath()`, `issuesCachePath()` in `tests/main/paths.test.ts`.

- TDD-first / initial failing test:
  - Implementer report states `npx vitest run tests/main/paths.test.ts` failed before implementation due to module-not-found, then passed after adding `paths.ts`. This is consistent with the workflow, but cannot be independently proven from current tree state alone.

- Implementation details (matches plan “spirit”):
  - `src/main/lib/paths.ts` imports `homedir` from `node:os` and `join` from `node:path`.
  - `expandHome` expands leading `~` using `join(homedir(), p.slice(1))`; non-`~` paths passthrough.
  - `forgeDir`, `configPath`, `issuesCachePath` are `join(...)`-based and resolve under `~/.forge`.

- Complexity:
  - `expandHome` has a single conditional (cyclomatic complexity 2). Others are straight-line (1). Meets requirement `<= 2`.

## Verification (Rerun)

- `npx vitest run tests/main/paths.test.ts`: PASS (4/4).
- `npm run test`: PASS.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with warning (does not fail task).
- `npm run format:check`: PASS.

## Commit Verification

- Commit present: `873704f` with message `feat(main): paths helper for ~/.forge resolution`.

## Notes

- ESLint warning (non-blocking for this task): unused `vi` import in `tests/main/paths.test.ts` (line 1). This does not violate the task requirements or the Phase 1 addendum, but it is worth cleaning up when an owning task covers lint hygiene.

